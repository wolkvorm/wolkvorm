package main

import (
	"encoding/base64"
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
		// Add key previews
		for i := range accounts {
			keyBytes, err := base64.StdEncoding.DecodeString(accounts[i].AccessKeyIDEnc)
			if err == nil {
				decrypted, err := decrypt(keyBytes)
				if err == nil {
					key := string(decrypted)
					if len(key) > 8 {
						accounts[i].KeyPreview = key[:4] + "..." + key[len(key)-4:]
					} else {
						accounts[i].KeyPreview = "****"
					}
				}
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(accounts)
		return
	}

	if r.Method == "POST" {
		var req struct {
			Name            string `json:"name"`
			AccessKeyID     string `json:"access_key_id"`
			SecretAccessKey string `json:"secret_access_key"`
			DefaultRegion   string `json:"default_region"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if req.Name == "" || req.AccessKeyID == "" || req.SecretAccessKey == "" {
			http.Error(w, "Name, access_key_id, and secret_access_key are required", 400)
			return
		}
		if req.DefaultRegion == "" {
			req.DefaultRegion = "us-east-1"
		}

		// Encrypt credentials
		encKey, err := encrypt([]byte(req.AccessKeyID))
		if err != nil {
			http.Error(w, "Encryption failed", 500)
			return
		}
		encSecret, err := encrypt([]byte(req.SecretAccessKey))
		if err != nil {
			http.Error(w, "Encryption failed", 500)
			return
		}

		acc := AWSAccount{
			ID:                 fmt.Sprintf("acc-%d", time.Now().UnixNano()),
			Name:               req.Name,
			AccessKeyIDEnc:     base64.StdEncoding.EncodeToString(encKey),
			SecretAccessKeyEnc: base64.StdEncoding.EncodeToString(encSecret),
			DefaultRegion:      req.DefaultRegion,
			CreatedAt:          time.Now().Format("2006-01-02 15:04:05"),
		}

		// First account is default
		existing := dbGetAWSAccounts()
		if len(existing) == 0 {
			acc.IsDefault = 1
		}

		if err := dbInsertAWSAccount(acc); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("account_create", "aws_account", acc.ID, map[string]any{"name": req.Name}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "created", "id": acc.ID})
		return
	}

	http.Error(w, "Method not allowed", 405)
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
			http.Error(w, err.Error(), 500)
			return
		}
		logAudit("account_set_default", "aws_account", id, nil, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	if len(parts) > 1 && parts[1] == "verify" && r.Method == "GET" {
		acc := dbGetAWSAccount(id)
		if acc == nil {
			http.Error(w, "Account not found", 404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"status": "ok", "account_id": acc.AccountID})
		return
	}

	if r.Method == "PUT" {
		var req struct {
			Name            string `json:"name"`
			AccessKeyID     string `json:"access_key_id"`
			SecretAccessKey string `json:"secret_access_key"`
			DefaultRegion   string `json:"default_region"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}

		acc := dbGetAWSAccount(id)
		if acc == nil {
			http.Error(w, "Account not found", 404)
			return
		}

		if req.Name != "" {
			acc.Name = req.Name
		}
		if req.DefaultRegion != "" {
			acc.DefaultRegion = req.DefaultRegion
		}
		if req.AccessKeyID != "" {
			encKey, _ := encrypt([]byte(req.AccessKeyID))
			acc.AccessKeyIDEnc = base64.StdEncoding.EncodeToString(encKey)
		}
		if req.SecretAccessKey != "" {
			encSecret, _ := encrypt([]byte(req.SecretAccessKey))
			acc.SecretAccessKeyEnc = base64.StdEncoding.EncodeToString(encSecret)
		}

		if err := dbUpdateAWSAccount(*acc); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("account_update", "aws_account", id, map[string]any{"name": acc.Name}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
		return
	}

	if r.Method == "DELETE" {
		if err := dbDeleteAWSAccount(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		logAudit("account_delete", "aws_account", id, nil, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
		return
	}

	http.Error(w, "Method not allowed", 405)
}
