package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

// schemasListHandler returns a list of all available resource schemas.
// GET /api/schemas
func schemasListHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	schemas := getSchemas()

	var list []SchemaListItem
	for _, s := range schemas {
		list = append(list, SchemaListItem{
			ID:          s.ID,
			Name:        s.Name,
			Description: s.Description,
			Provider:    s.Provider,
			Icon:        s.Icon,
			Category:    s.Category,
			Inputs:      s.Inputs,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// schemaDetailHandler returns a full schema by ID.
// GET /api/schemas/{id}
func schemaDetailHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	// Extract ID from path: /api/schemas/s3 -> s3
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Schema ID required", http.StatusBadRequest)
		return
	}
	id := parts[len(parts)-1]

	schema, ok := getSchema(id)
	if !ok {
		http.Error(w, "Schema not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(schema)
}
