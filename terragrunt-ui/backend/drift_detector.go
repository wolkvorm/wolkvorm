package main

import (
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"
)

var (
	driftMu        sync.Mutex
	driftRunning   bool
	driftScheduler *time.Ticker
	driftStopCh    chan struct{}
)

// RunDriftCheck runs a terraform plan on a resource to check for drift.
func RunDriftCheck(resource *ManagedResource) DriftCheck {
	check := DriftCheck{
		ID:         fmt.Sprintf("drift-%d", time.Now().UnixNano()),
		ResourceID: resource.ID,
		Status:     "clean",
		CheckedAt:  time.Now().Format("2006-01-02 15:04:05"),
	}

	creds := GetAWSCredentials()
	useIAMRole := creds.AuthMethod == "iam_role"
	if !useIAMRole && creds.AccessKeyID == "" {
		check.Status = "error"
		check.DiffOutput = "AWS credentials not configured"
		dbInsertDriftCheck(check)
		return check
	}

	// Find the schema
	schemas := getSchemas()
	var schema *ResourceSchema
	for _, s := range schemas {
		if s.ID == resource.SchemaID {
			schema = s
			break
		}
	}
	if schema == nil {
		check.Status = "error"
		check.DiffOutput = "Schema not found: " + resource.SchemaID
		dbInsertDriftCheck(check)
		return check
	}

	// Generate HCL
	opts := HCLOptions{Region: resource.Region, StateKey: resource.StateKey}
	hcl := GenerateHCLWithOptions(schema, resource.Inputs, resource.Env, opts)

	tgCmd := "cd /workspace && terraform init -no-color 2>&1 && terraform plan -no-color -detailed-exitcode 2>&1"
	envVars := map[string]string{
		"AWS_DEFAULT_REGION": resource.Region,
	}
	if !useIAMRole {
		envVars["AWS_ACCESS_KEY_ID"] = creds.AccessKeyID
		envVars["AWS_SECRET_ACCESS_KEY"] = creds.SecretAccessKey
	}

	var outputStr string
	var err error

	if getExecutionMode() == "kubernetes" {
		jobName := fmt.Sprintf("wolkvorm-drift-%d", time.Now().UnixMilli())
		outputStr, err = RunKubeJob(KubeJobOpts{
			Name:       jobName,
			Image:      getRunnerImage(),
			Command:    []string{"bash"},
			Args:       []string{"-c", tgCmd},
			EnvVars:    envVars,
			HCLContent: hcl,
		})
	} else {
		tmpDir := "/tmp/wolkvorm-drift-" + resource.ID
		exec.Command("mkdir", "-p", tmpDir).Run()
		exec.Command("bash", "-c", fmt.Sprintf("cat > %s/main.tf << 'HCLEOF'\n%s\nHCLEOF", tmpDir, hcl)).Run()

		args := []string{"run", "--rm", "-v", tmpDir + ":/workspace"}
		if !useIAMRole {
			args = append(args, "-e", "AWS_ACCESS_KEY_ID="+creds.AccessKeyID)
			args = append(args, "-e", "AWS_SECRET_ACCESS_KEY="+creds.SecretAccessKey)
		}
		args = append(args,
			"-e", "AWS_DEFAULT_REGION="+resource.Region,
			"wolkvorm-runner",
			"bash", "-c", tgCmd,
		)
		cmd := exec.Command("docker", args...)
		output, cerr := cmd.CombinedOutput()
		outputStr = string(output)
		err = cerr

		exec.Command("rm", "-rf", tmpDir).Run()
	}

	// Exit code 0 = no changes, 1 = error, 2 = changes detected
	if err != nil {
		exitErr, ok := err.(*exec.ExitError)
		if ok && exitErr.ExitCode() == 2 {
			check.Status = "drifted"
			check.DiffOutput = extractDriftDiff(outputStr)
		} else {
			check.Status = "error"
			check.DiffOutput = outputStr
		}
	} else {
		check.Status = "clean"
		check.DiffOutput = "No changes detected"
	}

	dbInsertDriftCheck(check)
	return check
}

func extractDriftDiff(output string) string {
	// Extract the plan diff section
	lines := strings.Split(output, "\n")
	inDiff := false
	var diff []string
	for _, line := range lines {
		if strings.Contains(line, "Terraform will perform the following actions") ||
			strings.Contains(line, "resource") && strings.Contains(line, "will be") {
			inDiff = true
		}
		if inDiff {
			diff = append(diff, line)
		}
		if strings.Contains(line, "Plan:") {
			diff = append(diff, line)
			break
		}
	}
	if len(diff) > 0 {
		return strings.Join(diff, "\n")
	}
	return output
}

// StartDriftScheduler starts periodic drift checks.
func StartDriftScheduler(intervalHours int) {
	driftMu.Lock()
	defer driftMu.Unlock()

	// Stop existing scheduler
	if driftScheduler != nil {
		driftScheduler.Stop()
		close(driftStopCh)
	}

	if intervalHours <= 0 {
		return
	}

	driftScheduler = time.NewTicker(time.Duration(intervalHours) * time.Hour)
	driftStopCh = make(chan struct{})

	go func() {
		for {
			select {
			case <-driftScheduler.C:
				runAllDriftChecks()
			case <-driftStopCh:
				return
			}
		}
	}()

	fmt.Printf("Drift detection scheduler started (every %d hours)\n", intervalHours)
}

func runAllDriftChecks() {
	driftMu.Lock()
	if driftRunning {
		driftMu.Unlock()
		return
	}
	driftRunning = true
	driftMu.Unlock()

	defer func() {
		driftMu.Lock()
		driftRunning = false
		driftMu.Unlock()
	}()

	resources := dbGetResources(false)
	driftedCount := 0
	for _, res := range resources {
		if res.Status != "active" && res.Status != "unknown" {
			continue
		}
		check := RunDriftCheck(&res)
		if check.Status == "drifted" {
			driftedCount++
		}
	}

	if driftedCount > 0 {
		SendNotification("drift_detected",
			fmt.Sprintf("Drift Detected: %d resources", driftedCount),
			fmt.Sprintf("%d resources have drifted from their desired state", driftedCount),
			map[string]string{"Drifted": fmt.Sprintf("%d", driftedCount)})
	}
}
