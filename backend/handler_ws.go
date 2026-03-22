package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// wsRunHandler handles WebSocket connections for real-time log streaming.
// WS /api/ws/run?token=<jwt>
func wsRunHandler(w http.ResponseWriter, r *http.Request) {
	// Authenticate via query param token (WebSocket can't set headers)
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, `{"error":"Authentication required"}`, 401)
		return
	}
	claims, err := validateToken(token)
	if err != nil {
		http.Error(w, `{"error":"Invalid token"}`, 401)
		return
	}
	// Require deployer+ role for executing commands via WebSocket
	if roleLevel[claims.Role] < roleLevel["deployer"] {
		http.Error(w, `{"error":"Insufficient permissions"}`, 403)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("WebSocket upgrade error:", err)
		return
	}
	defer conn.Close()

	// Read the command request from the client
	var req struct {
		SchemaID string         `json:"schemaId"`
		Inputs   map[string]any `json:"inputs"`
		Region   string         `json:"region"`
		Env      string         `json:"env"`
		Action   string         `json:"action"` // "plan", "apply", "destroy"
	}

	if err := conn.ReadJSON(&req); err != nil {
		conn.WriteJSON(map[string]string{"type": "error", "data": "Invalid request"})
		return
	}

	schema, ok := getSchema(req.SchemaID)
	if !ok {
		conn.WriteJSON(map[string]string{"type": "error", "data": "Unknown schema: " + req.SchemaID})
		return
	}

	var tgCommand string
	switch req.Action {
	case "apply":
		tgCommand = iacCommand("terraform apply -auto-approve")
	case "destroy":
		tgCommand = iacCommand("terraform destroy -auto-approve")
	default:
		req.Action = "plan"
		tgCommand = iacCommand("terraform plan")
	}

	// Check if approval is required for apply/destroy
	if (req.Action == "apply" || req.Action == "destroy") && IsApprovalRequired() {
		resourceName := getResourceName(req.SchemaID, req.Inputs)
		approvalID := createApprovalRequest(req.SchemaID, resourceName, req.Action, req.Env, req.Region, "", req.Inputs, nil)
		conn.WriteJSON(map[string]any{
			"type":        "approval_required",
			"approval_id": approvalID,
			"data":        fmt.Sprintf("Approval required for %s. Request created (ID: %s). Please wait for approval on the Approvals page.", req.Action, approvalID),
		})
		return
	}

	// Build HCL with remote state if available
	resourceName := getResourceName(req.SchemaID, req.Inputs)
	stateKey := GenerateStateKey(req.SchemaID, resourceName, req.Env)

	opts := HCLOptions{Region: req.Region}
	if req.Action == "apply" || req.Action == "destroy" {
		if stateInfo := GetStateBackendInfo(); stateInfo != nil {
			opts.StateKey = stateKey
		}
	}
	if req.Action == "plan" {
		if existing := dbGetResourceByStateKey(stateKey); existing != nil {
			if stateInfo := GetStateBackendInfo(); stateInfo != nil {
				opts.StateKey = stateKey
			}
		}
	}

	hcl := GenerateHCLWithOptions(schema, req.Inputs, req.Env, opts)
	fmt.Printf("[WS] Running %s for %s (env: %s, region: %s)\n", req.Action, schema.Name, req.Env, req.Region)

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
		}
		if secretKey == "" {
			secretKey = "TESTSECRET"
		}
	}

	// Create history record
	recordID := fmt.Sprintf("%s-%d", req.Action, time.Now().UnixMilli())
	record := PlanRecord{
		ID:         recordID,
		SchemaID:   req.SchemaID,
		SchemaName: schema.Name,
		Action:     req.Action,
		Env:        req.Env,
		Region:     req.Region,
		Inputs:     req.Inputs,
		Status:     "running",
		CreatedAt:  time.Now().Format("2006-01-02 15:04:05"),
	}

	planMu.Lock()
	planHistory = append([]PlanRecord{record}, planHistory...)
	planMu.Unlock()
	dbInsertRecord(record)

	conn.WriteJSON(map[string]string{"type": "started", "data": recordID})

	startTime := time.Now()

	var allLogs string
	var status string

	if getExecutionMode() == "kubernetes" {
		// Kubernetes Job mode with streaming
		logCh := make(chan string, 100)
		done := make(chan struct{})

		go func() {
			for line := range logCh {
				allLogs += line + "\n"
				conn.WriteJSON(map[string]string{"type": "log", "data": line})
			}
			close(done)
		}()

		envVars := map[string]string{
			"AWS_DEFAULT_REGION": req.Region,
		}
		if !useIAMRole {
			envVars["AWS_ACCESS_KEY_ID"] = accessKey
			envVars["AWS_SECRET_ACCESS_KEY"] = secretKey
		}

		jobName := fmt.Sprintf("wolkvorm-%s-%d", req.Action, time.Now().UnixMilli())
		kerr := RunKubeJobStreaming(KubeJobOpts{
			Name:       jobName,
			Image:      getRunnerImage(),
			Command:    []string{"/bin/sh"},
			Args:       []string{"-c", "cd /workspace && " + iacBinary() + " init && " + tgCommand},
			EnvVars:    envVars,
			HCLContent: hcl,
		}, logCh)
		close(logCh)
		<-done

		status = "success"
		if kerr != nil {
			status = "error"
		}
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

		// Create pipes for stdout and stderr
		stdout, _ := cmd.StdoutPipe()
		stderr, _ := cmd.StderrPipe()

		if err := cmd.Start(); err != nil {
			errMsg := fmt.Sprintf("Failed to start: %v", err)
			conn.WriteJSON(map[string]string{"type": "log", "data": errMsg})
			conn.WriteJSON(map[string]string{"type": "done", "status": "error"})

			dur := time.Since(startTime).Round(time.Second).String()
			planMu.Lock()
			for i := range planHistory {
				if planHistory[i].ID == recordID {
					planHistory[i].Logs = errMsg
					planHistory[i].Status = "error"
					planHistory[i].Duration = dur
					break
				}
			}
			planMu.Unlock()
			dbUpdateRecord(recordID, "error", errMsg, dur)
			return
		}

		logCh := make(chan string, 100)
		done := make(chan struct{})

		streamReader := func(reader io.Reader) {
			scanner := bufio.NewScanner(reader)
			scanner.Buffer(make([]byte, 64*1024), 1024*1024)
			for scanner.Scan() {
				line := scanner.Text()
				logCh <- line
			}
		}

		go streamReader(stdout)
		go streamReader(stderr)

		go func() {
			for line := range logCh {
				allLogs += line + "\n"
				conn.WriteJSON(map[string]string{"type": "log", "data": line})
			}
			close(done)
		}()

		err = cmd.Wait()
		close(logCh)
		<-done

		status = "success"
		if err != nil {
			status = "error"
		}
	}

	duration := time.Since(startTime).Round(time.Second).String()

	// Update last logs for fallback polling
	lastLogs = allLogs

	// Update history record
	planMu.Lock()
	for i := range planHistory {
		if planHistory[i].ID == recordID {
			planHistory[i].Logs = allLogs
			planHistory[i].Status = status
			planHistory[i].Duration = duration
			break
		}
	}
	planMu.Unlock()
	dbUpdateRecord(recordID, status, allLogs, duration)

	// Track resource
	if status == "success" && req.Action == "apply" {
		existing := dbGetResourceByStateKey(stateKey)
		if existing != nil {
			dbUpdateResource(existing.ID, req.Inputs, "active", recordID)
		} else {
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
		}

		// Extract terraform outputs (ARN, IDs, etc.)
		conn.WriteJSON(map[string]string{"type": "log", "data": "Fetching outputs..."})
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
			outArgs := []string{"run", "--rm"}
			if !useIAMRole {
				outArgs = append(outArgs, "-e", "AWS_ACCESS_KEY_ID="+accessKey)
				outArgs = append(outArgs, "-e", "AWS_SECRET_ACCESS_KEY="+secretKey)
			}
			outArgs = append(outArgs,
				"-e", "AWS_DEFAULT_REGION="+req.Region,
				"-v", runDir+":/workspace",
				"wolkvorm-runner",
				"-c", "cd /workspace && terraform output -json",
			)
			outCmd := exec.Command("docker", outArgs...)
			outputBytes, _ = outCmd.CombinedOutput()
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
				fmt.Printf("[WS] Warning: Failed to parse outputs: %v\n", err)
			}
		}

		res := dbGetResourceByStateKey(stateKey)
		if res != nil {
			dbUpdateResourceOutputs(res.ID, outputs)
			fmt.Printf("[WS] Outputs saved for resource %s\n", res.Name)
		}
	}
	if status == "error" && req.Action == "apply" {
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
			fmt.Printf("[WS] Resource tracked as failed: %s (%s)\n", resourceName, resID)
		}
	}
	if status == "success" && req.Action == "destroy" {
		if existing := dbGetResourceByStateKey(stateKey); existing != nil {
			dbUpdateResourceStatus(existing.ID, "destroyed")
		}
	}

	conn.WriteJSON(map[string]string{
		"type":     "done",
		"status":   status,
		"duration": duration,
		"plan_id":  recordID,
	})
}
