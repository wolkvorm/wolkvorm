package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// resourcesListHandler returns all active managed resources.
// GET /api/resources
func resourcesListHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	includeDestroyed := r.URL.Query().Get("all") == "true"
	resources := dbGetResources(includeDestroyed)
	if resources == nil {
		resources = []ManagedResource{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resources)
}

// resourceDetailHandler returns a single resource.
// GET /api/resources/{id}
func resourceDetailHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/resources/")
	if id == "" {
		http.Error(w, "Resource ID required", http.StatusBadRequest)
		return
	}

	resource := dbGetResource(id)
	if resource == nil {
		http.Error(w, "Resource not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resource)
}

// stateInitHandler initializes the remote state backend.
// POST /api/state/init
func stateInitHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	var body struct {
		Region string `json:"region"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		// Use default region
		creds := GetAWSCredentials()
		body.Region = creds.DefaultRegion
	}
	if body.Region == "" {
		body.Region = "us-east-1"
	}

	info, err := EnsureStateBucket(body.Region)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Failed to initialize state backend: %v", err),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

// stateStatusHandler returns the current state backend status.
// GET /api/state
func stateStatusHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	info := GetStateBackendInfo()
	if info == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"ready": false,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}
