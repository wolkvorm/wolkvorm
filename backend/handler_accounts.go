package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func accountsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		accounts := dbGetAWSAccounts()
		if accounts == nil {
			accounts = []AWSAccount{}
		}
		for i := range accounts {
			accounts[i].RoleARNPreview = maskRoleARN(accounts[i].RoleARN)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(accounts)
		return
	}

	if r.Method == "POST" {
		var req struct {
			Name          string `json:"name"`
			RoleARN       string `json:"role_arn"`
			ExternalID    string `json:"external_id"`
			DefaultRegion string `json:"default_region"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 400, "Invalid JSON")
			return
		}
		if req.Name == "" || req.RoleARN == "" {
			writeError(w, 400, "Name and role_arn are required")
			return
		}
		if !strings.HasPrefix(req.RoleARN, "arn:aws:iam::") {
			writeError(w, 400, "Invalid Role ARN format (expected arn:aws:iam::<account-id>:role/<role-name>)")
			return
		}
		if req.DefaultRegion == "" {
			req.DefaultRegion = "us-east-1"
		}

		acc := AWSAccount{
			ID:            fmt.Sprintf("acc-%d", time.Now().UnixNano()),
			Name:          req.Name,
			AuthMethod:    "role",
			RoleARN:       req.RoleARN,
			ExternalID:    req.ExternalID,
			DefaultRegion: req.DefaultRegion,
			CreatedAt:     time.Now().Format("2006-01-02 15:04:05"),
		}

		existing := dbGetAWSAccounts()
		if len(existing) == 0 {
			acc.IsDefault = 1
		}

		if err := dbInsertAWSAccount(acc); err != nil {
			writeError(w, 500, err.Error())
			return
		}

		logAudit("account_create", "aws_account", acc.ID, map[string]any{"name": req.Name, "role_arn": maskRoleARN(req.RoleARN)}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "created", "id": acc.ID})
		return
	}

	writeError(w, 405, "Method not allowed")
}

func accountDetailHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/accounts/"), "/")
	id := parts[0]

	if len(parts) > 1 && parts[1] == "default" && r.Method == "POST" {
		if err := dbSetDefaultAWSAccount(id); err != nil {
			writeError(w, 500, err.Error())
			return
		}
		logAudit("account_set_default", "aws_account", id, nil, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	if len(parts) > 1 && parts[1] == "verify" && r.Method == "POST" {
		acc := dbGetAWSAccount(id)
		if acc == nil {
			writeError(w, 404, "Account not found")
			return
		}
		if acc.RoleARN == "" {
			writeError(w, 400, "No Role ARN configured for this account")
			return
		}

		accountID, err := verifyAccountRole(acc.RoleARN, acc.ExternalID, acc.DefaultRegion)
		if err != nil {
			writeError(w, 400, fmt.Sprintf("Role verification failed: %v", err))
			return
		}

		// Save the discovered account ID
		acc.AccountID = accountID
		dbUpdateAWSAccount(*acc)

		logAudit("account_verify", "aws_account", id, map[string]any{"aws_account_id": accountID}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":     "verified",
			"account_id": accountID,
		})
		return
	}

	if r.Method == "PUT" {
		var req struct {
			Name          string `json:"name"`
			RoleARN       string `json:"role_arn"`
			ExternalID    string `json:"external_id"`
			DefaultRegion string `json:"default_region"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 400, "Invalid JSON")
			return
		}

		acc := dbGetAWSAccount(id)
		if acc == nil {
			writeError(w, 404, "Account not found")
			return
		}

		if req.Name != "" {
			acc.Name = req.Name
		}
		if req.RoleARN != "" {
			acc.RoleARN = req.RoleARN
			acc.AccountID = ""
		}
		if req.ExternalID != "" {
			acc.ExternalID = req.ExternalID
		}
		if req.DefaultRegion != "" {
			acc.DefaultRegion = req.DefaultRegion
		}

		if err := dbUpdateAWSAccount(*acc); err != nil {
			writeError(w, 500, err.Error())
			return
		}

		logAudit("account_update", "aws_account", id, map[string]any{"name": acc.Name}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
		return
	}

	if r.Method == "DELETE" {
		if err := dbDeleteAWSAccount(id); err != nil {
			writeError(w, 500, err.Error())
			return
		}
		logAudit("account_delete", "aws_account", id, nil, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
		return
	}

	writeError(w, 405, "Method not allowed")
}

// maskRoleARN returns a masked version of a role ARN for display.
func maskRoleARN(arn string) string {
	if arn == "" {
		return ""
	}
	// arn:aws:iam::123456789012:role/MyRole -> arn:aws:iam::1234...9012:role/MyRole
	parts := strings.Split(arn, ":")
	if len(parts) >= 5 {
		acctID := parts[4]
		if len(acctID) > 8 {
			parts[4] = acctID[:4] + "..." + acctID[len(acctID)-4:]
		}
		return strings.Join(parts, ":")
	}
	if len(arn) > 20 {
		return arn[:12] + "..." + arn[len(arn)-8:]
	}
	return arn
}
