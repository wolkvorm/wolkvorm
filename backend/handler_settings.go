package main

import (
	"encoding/json"
	"net/http"
)

// settingsStatusHandler returns which credentials are configured.
// GET /api/settings
func settingsStatusHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(GetSettingsStatus())
}

// awsSettingsHandler handles GET/POST for AWS credentials.
// GET /api/settings/aws -> returns status
// POST /api/settings/aws -> saves credentials
func awsSettingsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		status := GetSettingsStatus()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status.AWS)
		return
	}

	if r.Method == "POST" {
		var creds AWSCredentials
		if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		if creds.DefaultRegion == "" {
			creds.DefaultRegion = "eu-central-1"
		}

		if creds.AuthMethod == "iam_role" {
			// IAM Role mode: no keys needed, just save region and method
			creds.AccessKeyID = ""
			creds.SecretAccessKey = ""
		} else {
			// Access Key mode: keys required
			creds.AuthMethod = "access_key"
			if creds.AccessKeyID == "" || creds.SecretAccessKey == "" {
				http.Error(w, "Access Key ID and Secret Access Key are required", http.StatusBadRequest)
				return
			}
		}

		if err := SetAWSCredentials(creds); err != nil {
			http.Error(w, "Failed to save credentials", http.StatusInternalServerError)
			return
		}

		resp := map[string]any{
			"status":      "saved",
			"auth_method": creds.AuthMethod,
		}
		if creds.AuthMethod == "access_key" {
			resp["preview"] = maskSecret(creds.AccessKeyID)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// githubSettingsHandler handles GET/POST for GitHub App configuration.
// GET /api/settings/github -> returns status
// POST /api/settings/github -> saves config
func githubSettingsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		status := GetSettingsStatus()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status.GitHub)
		return
	}

	if r.Method == "POST" {
		var config GitHubAppConfig
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Validate based on auth method
		if config.AuthMethod == "pat" || config.PAT != "" {
			if config.PAT == "" {
				http.Error(w, "Personal Access Token is required", http.StatusBadRequest)
				return
			}
			config.AuthMethod = "pat"
			// Clear App fields if switching to PAT
			config.AppID = ""
			config.PrivateKey = ""
		} else {
			if config.AppID == "" || config.PrivateKey == "" {
				http.Error(w, "App ID and Private Key are required", http.StatusBadRequest)
				return
			}
			config.AuthMethod = "app"
			config.PAT = ""
		}

		if err := SetGitHubConfig(config); err != nil {
			http.Error(w, "Failed to save config", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":      "saved",
			"auth_method": config.AuthMethod,
		})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// infracostSettingsHandler handles GET/POST for Infracost API key.
// GET /api/settings/infracost -> returns status
// POST /api/settings/infracost -> saves key
func infracostSettingsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		status := GetSettingsStatus()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status.Infracost)
		return
	}

	if r.Method == "POST" {
		var body struct {
			APIKey string `json:"api_key"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		if body.APIKey == "" {
			http.Error(w, "API key is required", http.StatusBadRequest)
			return
		}

		if err := SetInfracostKey(body.APIKey); err != nil {
			http.Error(w, "Failed to save key", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":  "saved",
			"preview": maskSecret(body.APIKey),
		})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
