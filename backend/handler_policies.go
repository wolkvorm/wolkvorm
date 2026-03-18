package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func policiesHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		policies := dbGetPolicies()
		if policies == nil {
			policies = []Policy{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(policies)
		return
	}

	if r.Method == "POST" {
		var p Policy
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if p.Name == "" {
			http.Error(w, "Name is required", 400)
			return
		}
		if p.RegoContent == "" {
			http.Error(w, "Rules content is required", 400)
			return
		}
		if p.Severity == "" {
			p.Severity = "warning"
		}
		p.ID = fmt.Sprintf("pol-%d", time.Now().UnixNano())
		p.CreatedAt = time.Now().Format("2006-01-02 15:04:05")
		if p.IsActive == 0 {
			p.IsActive = 1
		}

		if err := dbInsertPolicy(p); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("policy_create", "policy", p.ID, map[string]any{"name": p.Name}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(p)
		return
	}

	http.Error(w, "Method not allowed", 405)
}

func policyDetailHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/policies/")
	// Handle /api/policies/validate
	if id == "validate" {
		policyValidateHandler(w, r)
		return
	}

	if r.Method == "PUT" {
		var p Policy
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		p.ID = id
		if err := dbUpdatePolicy(p); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("policy_update", "policy", id, map[string]any{"name": p.Name}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
		return
	}

	if r.Method == "DELETE" {
		if err := dbDeletePolicy(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("policy_delete", "policy", id, nil, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
		return
	}

	http.Error(w, "Method not allowed", 405)
}

func policyValidateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req struct {
		SchemaID string         `json:"schema_id"`
		Inputs   map[string]any `json:"inputs"`
		Region   string         `json:"region"`
		Env      string         `json:"env"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", 400)
		return
	}

	violations := EvaluatePolicies(req.SchemaID, req.Inputs, req.Region, req.Env)
	if violations == nil {
		violations = []PolicyViolation{}
	}

	hasErrors := false
	for _, v := range violations {
		if v.Severity == "error" {
			hasErrors = true
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"violations": violations,
		"passed":     len(violations) == 0,
		"has_errors": hasErrors,
	})
}

// getPolicyTemplates returns pre-built policy templates.
func policyTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	templates := []map[string]any{
		{
			"name":        "No Public S3 Buckets",
			"description": "Prevent creating S3 buckets with public ACL",
			"severity":    "error",
			"rules": `[{"schemas":"s3","field":"acl","operator":"not_in","value":"public-read,public-read-write","message":"S3 bucket ACL cannot be public"}]`,
		},
		{
			"name":        "Restrict EC2 Instance Types",
			"description": "Only allow specific EC2 instance types",
			"severity":    "error",
			"rules": `[{"schemas":"ec2","field":"instance_type","operator":"in","value":"t2.micro,t2.small,t3.micro,t3.small,t3.medium","message":"Instance type not allowed. Use t2.micro, t2.small, t3.micro, t3.small, or t3.medium"}]`,
		},
		{
			"name":        "Require Environment Tag",
			"description": "All resources must specify an environment",
			"severity":    "warning",
			"rules": `[{"schemas":"*","field":"_env","operator":"required","message":"Environment must be specified"}]`,
		},
		{
			"name":        "Deny US Regions",
			"description": "Restrict deployments to EU regions only",
			"severity":    "error",
			"rules": `[{"schemas":"*","field":"_region","operator":"not_contains","value":"eu-","message":"Only EU regions are allowed"}]`,
		},
		{
			"name":        "RDS Must Be Encrypted",
			"description": "RDS instances must have encryption enabled",
			"severity":    "error",
			"rules": `[{"schemas":"rds","field":"storage_encrypted","operator":"equals","value":"true","message":"RDS storage encryption must be enabled"}]`,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(templates)
}
