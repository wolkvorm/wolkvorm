package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

// resourcesListHandler returns all active managed resources.
// GET /api/resources
func resourcesListHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	includeDestroyed := r.URL.Query().Get("all") == "true"
	resources := dbGetResources(includeDestroyed)
	if resources == nil {
		resources = []ManagedResource{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resources)
}

// resourceDetailHandler returns a single resource.
// GET /api/resources/{id}
func resourceDetailHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/resources/")
	// Strip any sub-paths
	parts := strings.Split(id, "/")
	id = parts[0]
	
	if id == "" {
		http.Error(w, "Resource ID required", http.StatusBadRequest)
		return
	}

	resource := dbGetResource(id)
	if resource == nil {
		http.Error(w, "Resource not found", http.StatusNotFound)
		return
	}

	// Check if this is a refresh-outputs request (POST /api/resources/{id}/refresh-outputs)
	if len(parts) > 1 && parts[1] == "refresh-outputs" && r.Method == "POST" {
		refreshOutputsHandler(w, r)
		return
	}

	// Check if this is an outputs request (e.g. /api/resources/{id}/outputs)
	if len(parts) > 1 && parts[1] == "outputs" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resource.Outputs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resource)
}

// stateInitHandler initializes the remote state backend.
// POST /api/state/init
func stateInitHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	var body struct {
		Region string `json:"region"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		// Use default region
		creds := GetAWSCredentials()
		body.Region = creds.DefaultRegion
	}
	if body.Region == "" {
		body.Region = "us-east-1"
	}

	info, err := EnsureStateBucket(body.Region)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Failed to initialize state backend: %v", err),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

// stateStatusHandler returns the current state backend status.
// GET /api/state
func stateStatusHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	info := GetStateBackendInfo()
	if info == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"ready": false,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

// refreshOutputsHandler fetches terraform outputs for an existing resource.
// POST /api/resources/{id}/refresh-outputs
func refreshOutputsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/resources/")
	id = strings.TrimSuffix(id, "/refresh-outputs")

	resource := dbGetResource(id)
	if resource == nil {
		http.Error(w, "Resource not found", http.StatusNotFound)
		return
	}

	schema, ok := getSchema(resource.SchemaID)
	if !ok {
		http.Error(w, "Schema not found", http.StatusInternalServerError)
		return
	}

	// Reconstruct HCL for this resource
	resourceName := resource.Name
	stateKey := GenerateStateKey(resource.SchemaID, resourceName, resource.Env)
	opts := HCLOptions{
		Region:   resource.Region,
		StateKey: stateKey,
	}
	hcl := GenerateHCLWithOptions(schema, resource.Inputs, resource.Env, opts)

	runDir := "/tmp/wolkvorm-run"
	os.RemoveAll(runDir)
	os.MkdirAll(runDir, 0755)
	os.WriteFile(runDir+"/main.tf", []byte(hcl), 0644)

	awsCreds := GetAWSCredentials()
	accessKey := awsCreds.AccessKeyID
	secretKey := awsCreds.SecretAccessKey
	useIAMRole := awsCreds.AuthMethod == "iam_role"

	if !useIAMRole {
		if accessKey == "" {
			accessKey = os.Getenv("AWS_ACCESS_KEY_ID")
		}
		if secretKey == "" {
			secretKey = os.Getenv("AWS_SECRET_ACCESS_KEY")
		}
	}

	fmt.Printf("Refreshing outputs for resource %s (%s)\n", resource.Name, resource.ID)

	var outputBytes []byte
	if getExecutionMode() == "kubernetes" {
		envVars := map[string]string{
			"AWS_DEFAULT_REGION": resource.Region,
		}
		if !useIAMRole {
			envVars["AWS_ACCESS_KEY_ID"] = accessKey
			envVars["AWS_SECRET_ACCESS_KEY"] = secretKey
		}
		jobName := fmt.Sprintf("wolkvorm-out-%d", time.Now().UnixMilli())
		logs, _ := RunKubeJob(KubeJobOpts{
			Name:       jobName,
			Image:      getRunnerImage(),
			Command:    []string{"/bin/sh"},
			Args:       []string{"-c", "cd /workspace && terraform output -json"},
			EnvVars:    envVars,
			HCLContent: hcl,
		})
		outputBytes = []byte(logs)
	} else {
		args := []string{"run", "--rm"}
		if !useIAMRole {
			args = append(args, "-e", "AWS_ACCESS_KEY_ID="+accessKey)
			args = append(args, "-e", "AWS_SECRET_ACCESS_KEY="+secretKey)
		}
		args = append(args,
			"-e", "AWS_DEFAULT_REGION="+resource.Region,
			"-v", runDir+":/workspace",
			"wolkvorm-runner",
			"-c", "cd /workspace && terraform output -json",
		)
		cmd := exec.Command("docker", args...)
		outputBytes, _ = cmd.CombinedOutput()
	}

	// Extract JSON from terraform output
	rawOutput := string(outputBytes)
	jsonStart := strings.Index(rawOutput, "{")
	jsonEnd := strings.LastIndex(rawOutput, "}")
	
	var rawOutputs map[string]struct {
		Sensitive bool `json:"sensitive"`
		Type      any  `json:"type"`
		Value     any  `json:"value"`
	}

	outputs := make(map[string]any)
	
	if jsonStart >= 0 && jsonEnd > jsonStart {
		jsonStr := rawOutput[jsonStart : jsonEnd+1]
		if err := json.Unmarshal([]byte(jsonStr), &rawOutputs); err == nil {
			for k, v := range rawOutputs {
				outputs[k] = v.Value
			}
		} else {
			fmt.Printf("Warning: Failed to parse terraform outputs: %v\nJSON was: %s\n", err, jsonStr)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": fmt.Sprintf("Failed to parse outputs: %v", err),
				"raw":   jsonStr,
			})
			return
		}
	} else {
		fmt.Printf("Warning: No JSON found in terraform output: %s\n", rawOutput)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "No JSON found in terraform output",
			"raw":   rawOutput,
		})
		return
	}

	dbUpdateResourceOutputs(resource.ID, outputs)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(outputs)
}
