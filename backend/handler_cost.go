package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
)

// CostEstimate represents the Infracost estimation result.
type CostEstimate struct {
	MonthlyCost   string `json:"monthly_cost"`
	Currency      string `json:"currency"`
	ResourceCount int    `json:"resource_count"`
	Available     bool   `json:"available"`
	Error         string `json:"error,omitempty"`
	Details       string `json:"details,omitempty"`
}

// costEstimateHandler runs Infracost on the generated HCL to estimate costs.
// POST /api/cost-estimate
func costEstimateHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	var req PlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	schema, ok := getSchema(req.SchemaID)
	if !ok {
		http.Error(w, "Unknown schema", http.StatusBadRequest)
		return
	}

	hcl := GenerateHCL(schema, req.Inputs, req.Env, req.Region)

	// Write HCL to temp dir for Infracost
	costDir := "/tmp/wolkvorm-cost"
	os.RemoveAll(costDir)
	os.MkdirAll(costDir, 0755)
	os.WriteFile(costDir+"/main.tf", []byte(hcl), 0644)

	// Check if Infracost API key is configured (settings first, then env)
	apiKey := GetInfracostKey()
	if apiKey == "" {
		apiKey = os.Getenv("INFRACOST_API_KEY")
	}
	if apiKey == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(CostEstimate{
			Available: false,
			Error:     "INFRACOST_API_KEY not configured. Get a free key at https://www.infracost.io/",
		})
		return
	}

	// Get region from request
	region := req.Region
	if region == "" {
		region = "us-east-1"
	}

	// Get AWS credentials for region-aware pricing
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

	// Build env vars for infracost
	costEnvVars := map[string]string{
		"INFRACOST_API_KEY":  apiKey,
		"AWS_DEFAULT_REGION": region,
	}
	if !useIAMRole && accessKey != "" && secretKey != "" {
		costEnvVars["AWS_ACCESS_KEY_ID"] = accessKey
		costEnvVars["AWS_SECRET_ACCESS_KEY"] = secretKey
	}

	var stdout []byte
	var stderrStr string
	var err error

	if getExecutionMode() == "kubernetes" {
		hclContent, _ := os.ReadFile(costDir + "/main.tf")
		stdoutStr, stderrOut, kerr := RunKubeJobForCost("infracost/infracost:latest", costEnvVars, string(hclContent))
		stdout = []byte(stdoutStr)
		stderrStr = stderrOut
		err = kerr
	} else {
		// Docker mode
		args := []string{
			"run", "--rm",
			"--platform", "linux/amd64",
			"-e", "INFRACOST_API_KEY=" + apiKey,
			"-e", "AWS_DEFAULT_REGION=" + region,
		}
		if accessKey != "" && secretKey != "" {
			args = append(args, "-e", "AWS_ACCESS_KEY_ID="+accessKey)
			args = append(args, "-e", "AWS_SECRET_ACCESS_KEY="+secretKey)
		}
		args = append(args,
			"-v", costDir+":/workspace",
			"infracost/infracost:latest",
			"breakdown",
			"--path", "/workspace",
			"--format", "json",
		)
		cmd := exec.Command("docker", args...)

		var stdoutBuf, stderrBuf bytes.Buffer
		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stderrBuf

		err = cmd.Run()
		stdout = stdoutBuf.Bytes()
		stderrStr = stderrBuf.String()
	}

	if err != nil {
		fmt.Printf("Infracost error: %v\nstderr: %s\n", err, stderrStr)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(CostEstimate{
			Available: false,
			Error:     "Infracost failed: " + stderrStr,
			Details:   string(stdout),
		})
		return
	}

	fmt.Printf("Infracost stdout length: %d, stderr: %s\n", len(stdout), stderrStr)

	// Parse Infracost JSON output (stdout only, not stderr)
	var infracostResult struct {
		TotalMonthlyCost string `json:"totalMonthlyCost"`
		Currency         string `json:"currency"`
		Projects         []struct {
			Breakdown struct {
				Resources []struct{} `json:"resources"`
			} `json:"breakdown"`
		} `json:"projects"`
	}

	if err := json.Unmarshal(stdout, &infracostResult); err != nil {
		fmt.Printf("Infracost parse error: %v\nraw output: %s\n", err, string(stdout[:min(len(stdout), 500)]))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(CostEstimate{
			Available: false,
			Error:     "Could not parse Infracost output",
			Details:   stderrStr,
		})
		return
	}

	resourceCount := 0
	for _, p := range infracostResult.Projects {
		resourceCount += len(p.Breakdown.Resources)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CostEstimate{
		Available:     true,
		MonthlyCost:   infracostResult.TotalMonthlyCost,
		Currency:      infracostResult.Currency,
		ResourceCount: resourceCount,
	})
}
