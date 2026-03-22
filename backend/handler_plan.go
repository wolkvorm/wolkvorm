package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// PlanRequest is the request body for running a terraform command.
type PlanRequest struct {
	SchemaID   string         `json:"schemaId"`
	Inputs     map[string]any `json:"inputs"`
	Region     string         `json:"region"`
	Env        string         `json:"env"`
	ResourceID string         `json:"resourceId,omitempty"`
}

// PlanRecord stores a single execution result.
type PlanRecord struct {
	ID         string         `json:"id"`
	SchemaID   string         `json:"schema_id"`
	SchemaName string         `json:"schema_name"`
	Action     string         `json:"action"` // "plan", "apply", "destroy"
	Env        string         `json:"env"`
	Region     string         `json:"region"`
	Inputs     map[string]any `json:"inputs"`
	Status     string         `json:"status"` // "running", "success", "error"
	Logs       string         `json:"logs"`
	CreatedAt  string         `json:"created_at"`
	Duration   string         `json:"duration"`
}

var (
	lastLogs    = ""
	planHistory []PlanRecord
	planMu      sync.RWMutex
)

// getResourceName extracts a human-readable name from inputs based on schema type.
func getResourceName(schemaID string, inputs map[string]any) string {
	// Try common name fields (covers all schema types)
	for _, field := range []string{
		"name", "bucket", "key_name", "role_name", "function_name",
		"cluster_name", "db_name", "domain_name", "identifier",
		"repository_name", "replication_group_id", "zone_name", "comment",
	} {
		if v, ok := inputs[field]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
		}
	}
	return fmt.Sprintf("%s-%d", schemaID, time.Now().Unix())
}

// runTerragrunt is a shared helper that runs a terraform command in Docker.
func runTerragrunt(req PlanRequest, action string, tgCommand string) (string, string) {
	schema, ok := getSchema(req.SchemaID)
	if !ok {
		return "error", "Unknown schema: " + req.SchemaID
	}

	// For apply/destroy, use remote state if available
	resourceName := getResourceName(req.SchemaID, req.Inputs)
	stateKey := GenerateStateKey(req.SchemaID, resourceName, req.Env)

	opts := HCLOptions{
		Region: req.Region,
	}

	// Check if state backend is initialized for apply/destroy
	if action == "apply" || action == "destroy" {
		stateInfo := GetStateBackendInfo()
		if stateInfo != nil {
			opts.StateKey = stateKey
		}
	}

	// For plan, also use remote state if a resource exists (so plan shows accurate diff)
	if action == "plan" {
		existing := dbGetResourceByStateKey(stateKey)
		if existing != nil {
			stateInfo := GetStateBackendInfo()
			if stateInfo != nil {
				opts.StateKey = stateKey
			}
		}
	}

	hcl := GenerateHCLWithOptions(schema, req.Inputs, req.Env, opts)
	fmt.Printf("Running %s for %s (env: %s, region: %s)\n", action, schema.Name, req.Env, req.Region)

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
			accessKey = getEnvDefault("AWS_ACCESS_KEY_ID", "")
		}
		if secretKey == "" {
			secretKey = getEnvDefault("AWS_SECRET_ACCESS_KEY", "")
		}
		if accessKey == "" {
			accessKey = "TESTKEY"
			fmt.Println("Warning: Using test AWS credentials.")
		}
		if secretKey == "" {
			secretKey = "TESTSECRET"
		}
	}

	recordID := fmt.Sprintf("%s-%d", action, time.Now().UnixMilli())
	record := PlanRecord{
		ID:         recordID,
		SchemaID:   req.SchemaID,
		SchemaName: schema.Name,
		Action:     action,
		Env:        req.Env,
		Region:     req.Region,
		Inputs:     req.Inputs,
		Status:     "running",
		CreatedAt:  time.Now().Format("2006-01-02 15:04:05"),
	}

	planMu.Lock()
	planHistory = append([]PlanRecord{record}, planHistory...)
	planMu.Unlock()

	// Persist to database
	dbInsertRecord(record)

	startTime := time.Now()

	var output []byte
	var err error

	if getExecutionMode() == "kubernetes" {
		// Kubernetes Job mode
		envVars := map[string]string{
			"AWS_DEFAULT_REGION": req.Region,
		}
		if !useIAMRole {
			envVars["AWS_ACCESS_KEY_ID"] = accessKey
			envVars["AWS_SECRET_ACCESS_KEY"] = secretKey
		}

		jobName := fmt.Sprintf("wolkvorm-%s-%d", action, time.Now().UnixMilli())
		logs, kerr := RunKubeJob(KubeJobOpts{
			Name:       jobName,
			Image:      getRunnerImage(),
			Command:    []string{"/bin/sh"},
			Args:       []string{"-c", "cd /workspace && " + iacBinary() + " init && " + tgCommand},
			EnvVars:    envVars,
			HCLContent: hcl,
		})
		output = []byte(logs)
		err = kerr
	} else {
		// Docker mode (local development)
		args := []string{"run", "--rm"}
		if !useIAMRole {
			args = append(args, "-e", "AWS_ACCESS_KEY_ID="+accessKey)
			args = append(args, "-e", "AWS_SECRET_ACCESS_KEY="+secretKey)
		}
		args = append(args,
			"-e", "AWS_DEFAULT_REGION="+req.Region,
			"-v", runDir+":/workspace",
			"wolkvorm-runner",
			"-c", "cd /workspace && " + iacBinary() + " init && "+tgCommand,
		)
		cmd := exec.Command("docker", args...)
		output, err = cmd.CombinedOutput()
	}

	lastLogs = string(output)
	duration := time.Since(startTime).Round(time.Second).String()

	status := "success"
	if err != nil {
		status = "error"
		fmt.Printf("%s error: %v\n", action, err)
	}

	planMu.Lock()
	for i := range planHistory {
		if planHistory[i].ID == recordID {
			planHistory[i].Logs = lastLogs
			planHistory[i].Status = status
			planHistory[i].Duration = duration
			break
		}
	}
	planMu.Unlock()

	// Persist to database
	dbUpdateRecord(recordID, status, lastLogs, duration)

	// Track resource in resources table
	if status == "success" && action == "apply" {
		existing := dbGetResourceByStateKey(stateKey)
		if existing != nil {
			// Update existing resource
			dbUpdateResource(existing.ID, req.Inputs, "active", recordID)
		} else {
			// Create new resource entry
			resID := fmt.Sprintf("res-%d", time.Now().UnixMilli())
			now := time.Now().Format("2006-01-02 15:04:05")
			dbInsertResource(ManagedResource{
				ID:          resID,
				Name:        resourceName,
				SchemaID:    req.SchemaID,
				SchemaName:  schema.Name,
				Env:         req.Env,
				Region:      req.Region,
				Inputs:      req.Inputs,
				StateKey:    stateKey,
				Status:      "active",
				CreatedAt:   now,
				UpdatedAt:   now,
				LastApplyID: recordID,
			})
			fmt.Printf("Resource tracked: %s (%s)\n", resourceName, resID)
		}
		// Extract outputs
		var outputBytes []byte
		if getExecutionMode() == "kubernetes" {
			envVars := map[string]string{
				"AWS_DEFAULT_REGION": req.Region,
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
				"-e", "AWS_DEFAULT_REGION="+req.Region,
				"-v", runDir+":/workspace",
				"wolkvorm-runner",
				"-c", "cd /workspace && terraform output -json",
			)
			cmd := exec.Command("docker", args...)
			outputBytes, _ = cmd.CombinedOutput()
		}

		// Parse the output JSON
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
			}
		} else {
			fmt.Printf("Warning: No JSON found in terraform output: %s\n", rawOutput)
		}

		if existing != nil {
			dbUpdateResourceOutputs(existing.ID, outputs)
		} else {
			// Find the newly created resource ID based on StateKey to update its outputs
			newRes := dbGetResourceByStateKey(stateKey)
			if newRes != nil {
				dbUpdateResourceOutputs(newRes.ID, outputs)
			}
		}
	}

	if status == "error" && action == "apply" {
		existing := dbGetResourceByStateKey(stateKey)
		if existing == nil {
			resID := fmt.Sprintf("res-%d", time.Now().UnixMilli())
			now := time.Now().Format("2006-01-02 15:04:05")
			dbInsertResource(ManagedResource{
				ID:          resID,
				Name:        resourceName,
				SchemaID:    req.SchemaID,
				SchemaName:  schema.Name,
				Env:         req.Env,
				Region:      req.Region,
				Inputs:      req.Inputs,
				StateKey:    stateKey,
				Status:      "failed",
				CreatedAt:   now,
				UpdatedAt:   now,
				LastApplyID: recordID,
			})
			fmt.Printf("Resource tracked as failed: %s (%s)\n", resourceName, resID)
		}
	}

	if status == "success" && action == "destroy" {
		// First try: use resourceId directly if provided (from edit mode)
		if req.ResourceID != "" {
			dbUpdateResourceStatus(req.ResourceID, "destroyed")
			fmt.Printf("Resource destroyed (by ID): %s\n", req.ResourceID)
		} else {
			// Second try: lookup by stateKey
			existing := dbGetResourceByStateKey(stateKey)
			if existing != nil {
				dbUpdateResourceStatus(existing.ID, "destroyed")
				fmt.Printf("Resource destroyed: %s\n", existing.Name)
			} else {
				// Fallback: find active resources matching schema and env
				allResources := dbGetResources(false)
				for _, r := range allResources {
					if r.SchemaID == req.SchemaID && r.Env == req.Env && (r.Status == "active" || r.Status == "unknown" || r.Status == "failed") {
						formName := getResourceName(req.SchemaID, req.Inputs)
						storedName := getResourceName(r.SchemaID, r.Inputs)
						if formName == storedName || r.Name == formName {
							dbUpdateResourceStatus(r.ID, "destroyed")
							fmt.Printf("Resource destroyed (fallback match): %s\n", r.Name)
							break
						}
					}
				}
			}
		}
	}

	return status, recordID
}

// terraformHandler is the generic handler for plan/apply/destroy.
func terragruntHandler(w http.ResponseWriter, r *http.Request, action string, tgCommand string) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	var req PlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if _, ok := getSchema(req.SchemaID); !ok {
		http.Error(w, "Unknown schema: "+req.SchemaID, http.StatusBadRequest)
		return
	}

	// Check if approval is required for apply/destroy
	if (action == "apply" || action == "destroy") && IsApprovalRequired() {
		resourceName := getResourceName(req.SchemaID, req.Inputs)
		approvalID := createApprovalRequest(req.SchemaID, resourceName, action, req.Env, req.Region, "", req.Inputs, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":      "approval_required",
			"approval_id": approvalID,
			"message":     fmt.Sprintf("Approval required for %s. Request created.", action),
		})
		return
	}

	status, recordID := runTerragrunt(req, action, tgCommand)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  status,
		"plan_id": recordID,
	})
}

func planHandler(w http.ResponseWriter, r *http.Request) {
	terragruntHandler(w, r, "plan", iacCommand("terraform plan"))
}

func applyHandler(w http.ResponseWriter, r *http.Request) {
	terragruntHandler(w, r, "apply", iacCommand("terraform apply -auto-approve"))
}

func destroyHandler(w http.ResponseWriter, r *http.Request) {
	terragruntHandler(w, r, "destroy", iacCommand("terraform destroy -auto-approve"))
}

// logsHandler returns the latest logs.
// GET /api/plan/logs
func logsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	w.Write([]byte(lastLogs))
}

// planHistoryHandler returns the execution history.
// GET /api/plan/history?schemaId=s3 (optional filter)
func planHistoryHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	schemaFilter := r.URL.Query().Get("schemaId")

	// Try database first
	if dbRecords := dbGetHistory(schemaFilter, 50); dbRecords != nil {
		// Merge with in-memory running records
		planMu.RLock()
		var running []PlanRecord
		for _, p := range planHistory {
			if p.Status == "running" && (schemaFilter == "" || p.SchemaID == schemaFilter) {
				running = append(running, p)
			}
		}
		planMu.RUnlock()

		result := append(running, dbRecords...)
		for i := range result {
			if len(result[i].Logs) > 500 {
				result[i].Logs = result[i].Logs[:500] + "\n... (truncated, click to expand)"
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}

	// Fallback to in-memory
	planMu.RLock()
	defer planMu.RUnlock()

	var result []PlanRecord
	for _, p := range planHistory {
		if schemaFilter == "" || p.SchemaID == schemaFilter {
			summary := p
			if len(summary.Logs) > 500 {
				summary.Logs = summary.Logs[:500] + "\n... (truncated, click to expand)"
			}
			result = append(result, summary)
		}
	}

	if result == nil {
		result = []PlanRecord{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// planDetailHandler returns a single record with full logs.
// GET /api/plan/history/{id}
func planDetailHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	planID := r.URL.Path[len("/api/plan/history/"):]

	// Try database first
	if rec := dbGetRecord(planID); rec != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rec)
		return
	}

	// Fallback to in-memory
	planMu.RLock()
	defer planMu.RUnlock()

	for _, p := range planHistory {
		if p.ID == planID {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(p)
			return
		}
	}

	http.Error(w, "Record not found", http.StatusNotFound)
}

// statsHandler returns execution statistics for the dashboard.
// GET /api/stats
func statsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	stats := dbGetStats()
	if stats == nil {
		stats = map[string]any{
			"total": len(planHistory), "success": 0, "errors": 0,
			"plans": 0, "applies": 0, "destroys": 0,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func getEnvDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
