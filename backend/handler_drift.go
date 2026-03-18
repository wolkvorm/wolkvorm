package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

func driftListHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	checks := dbGetLatestDriftChecks()
	if checks == nil {
		checks = []DriftCheck{}
	}

	// Enrich with resource info
	type DriftInfo struct {
		DriftCheck
		ResourceName string `json:"resource_name"`
		SchemaID     string `json:"schema_id"`
		Env          string `json:"env"`
		Region       string `json:"region"`
	}

	var result []DriftInfo
	for _, c := range checks {
		info := DriftInfo{DriftCheck: c}
		res := dbGetResource(c.ResourceID)
		if res != nil {
			info.ResourceName = res.Name
			info.SchemaID = res.SchemaID
			info.Env = res.Env
			info.Region = res.Region
		}
		result = append(result, info)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func driftDetailHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	resourceID := strings.TrimPrefix(r.URL.Path, "/api/drift/")
	if resourceID == "" {
		http.Error(w, "Missing resource ID", 400)
		return
	}

	// Handle check action
	if strings.HasSuffix(resourceID, "/check") {
		resourceID = strings.TrimSuffix(resourceID, "/check")
		if r.Method == "POST" {
			resource := dbGetResource(resourceID)
			if resource == nil {
				http.Error(w, "Resource not found", 404)
				return
			}
			check := RunDriftCheck(resource)
			logAudit("drift_check", "resource", resourceID, map[string]any{"status": check.Status}, r)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(check)
			return
		}
	}

	checks := dbGetDriftChecksByResource(resourceID)
	if checks == nil {
		checks = []DriftCheck{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(checks)
}

func driftCheckAllHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	go runAllDriftChecks()
	logAudit("drift_check_all", "system", "", nil, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func driftSettingsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		config := GetDriftConfig()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(config)
		return
	}

	if r.Method == "POST" {
		var config DriftConfig
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}

		if err := SetDriftConfig(config); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		if config.Enabled && config.IntervalHours > 0 {
			StartDriftScheduler(config.IntervalHours)
		} else {
			StartDriftScheduler(0) // stop
		}

		logAudit("settings_change", "drift", "", map[string]any{"enabled": config.Enabled, "interval": config.IntervalHours}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	http.Error(w, "Method not allowed", 405)
}
