package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func apiKeysHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		keys := dbGetAPIKeys()
		if keys == nil {
			keys = []APIKey{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(keys)
		return
	}

	if r.Method == "POST" {
		var req struct {
			Name string `json:"name"`
			Role string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if req.Name == "" {
			http.Error(w, "Name is required", 400)
			return
		}
		if req.Role == "" {
			req.Role = "viewer"
		}
		if req.Role != "admin" && req.Role != "operator" && req.Role != "viewer" {
			http.Error(w, "Invalid role (admin/operator/viewer)", 400)
			return
		}

		// Generate random API key
		rawKey := make([]byte, 32)
		rand.Read(rawKey)
		apiKey := "tf_" + hex.EncodeToString(rawKey)

		// Store hash
		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(apiKey)))

		key := APIKey{
			ID:        fmt.Sprintf("key-%d", time.Now().UnixNano()),
			Name:      req.Name,
			KeyHash:   hash,
			Role:      req.Role,
			CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
			IsActive:  1,
		}

		if err := dbInsertAPIKey(key); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("apikey_create", "api_key", key.ID, map[string]any{"name": req.Name, "role": req.Role}, r)

		// Return the key only once - it can't be retrieved later
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"id":   key.ID,
			"name": key.Name,
			"role": key.Role,
			"key":  apiKey,
		})
		return
	}

	http.Error(w, "Method not allowed", 405)
}

func apiKeyDeleteHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "DELETE" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/api-keys/")
	if id == "" {
		http.Error(w, "Missing key ID", 400)
		return
	}

	if err := dbDeleteAPIKey(id); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	logAudit("apikey_revoke", "api_key", id, nil, r)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "revoked"})
}
