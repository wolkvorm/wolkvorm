package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// SchemaInput represents a single input field in a resource schema.
type SchemaInput struct {
	Name        string   `json:"name"`
	Label       string   `json:"label"`
	Type        string   `json:"type"` // string, number, boolean, select, multiline, sg_rules
	Required    bool     `json:"required,omitempty"`
	Default     any      `json:"default,omitempty"`
	Placeholder string   `json:"placeholder,omitempty"`
	Description string   `json:"description,omitempty"`
	Options     []string `json:"options,omitempty"`
	Advanced    bool     `json:"advanced,omitempty"`
	AWSResource string   `json:"aws_resource,omitempty"` // vpc, subnet, security-group, key-pair, ami
	Multi       bool     `json:"multi,omitempty"`        // true for multi-select fields
	Block       string   `json:"block,omitempty"`        // if set, field is nested inside a HCL block of this name
}

// SchemaModule holds the Terraform module source info.
type SchemaModule struct {
	Source  string `json:"source"`
	Version string `json:"version,omitempty"`
}

// SchemaCommonInputs flags for region/environment/tags.
type SchemaCommonInputs struct {
	Region      bool `json:"region"`
	Environment bool `json:"environment"`
	Tags        bool `json:"tags"`
}

// ResourceSchema represents a full resource definition loaded from JSON.
type ResourceSchema struct {
	ID           string             `json:"id"`
	Name         string             `json:"name"`
	Description  string             `json:"description"`
	Provider     string             `json:"provider"`
	Icon         string             `json:"icon"`
	Category     string             `json:"category"`
	Module       SchemaModule       `json:"module"`
	ResourceType string             `json:"resource_type,omitempty"` // if set, generates a resource block instead of a module block
	Inputs       []SchemaInput      `json:"inputs"`
	CommonInputs SchemaCommonInputs `json:"common_inputs"`
	PathTemplate string             `json:"path_template"`
}

// SchemaListItem is a lightweight representation for listing available schemas.
type SchemaListItem struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Provider    string        `json:"provider"`
	Icon        string        `json:"icon"`
	Category    string        `json:"category"`
	Inputs      []SchemaInput `json:"inputs"`
}

var (
	schemasCache map[string]*ResourceSchema
	schemasOnce  sync.Once
)

// loadSchemaFile reads and parses a single JSON schema file.
func loadSchemaFile(filePath string, schemas map[string]*ResourceSchema) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		fmt.Printf("Warning: cannot read schema file %s: %v\n", filePath, err)
		return
	}

	var schema ResourceSchema
	if err := json.Unmarshal(data, &schema); err != nil {
		fmt.Printf("Warning: cannot parse schema file %s: %v\n", filePath, err)
		return
	}

	schemas[schema.ID] = &schema
	fmt.Printf("Loaded schema: %s (%s)\n", schema.Name, schema.ID)
}

// loadSchemas reads all JSON schema files from the schemas directory.
// Supports two layouts:
//   - Nested: schemas/aws/ec2.json (Docker / local dev with provider subdirectories)
//   - Flat:   schemas/ec2.json     (Kubernetes ConfigMap mount)
func loadSchemas(schemasDir string) (map[string]*ResourceSchema, error) {
	schemas := make(map[string]*ResourceSchema)

	entries, err := os.ReadDir(schemasDir)
	if err != nil {
		return nil, fmt.Errorf("cannot read schemas dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			// Nested layout: scan provider subdirectory for .json files
			providerDir := filepath.Join(schemasDir, entry.Name())
			files, err := os.ReadDir(providerDir)
			if err != nil {
				continue
			}
			for _, file := range files {
				if filepath.Ext(file.Name()) == ".json" {
					loadSchemaFile(filepath.Join(providerDir, file.Name()), schemas)
				}
			}
		} else if filepath.Ext(entry.Name()) == ".json" {
			// Flat layout: .json files directly in schemas dir (ConfigMap mount)
			loadSchemaFile(filepath.Join(schemasDir, entry.Name()), schemas)
		}
	}

	return schemas, nil
}

// getSchemas returns the cached schemas, loading them on first call.
func getSchemas() map[string]*ResourceSchema {
	schemasOnce.Do(func() {
		dir := getSchemasDir()
		var err error
		schemasCache, err = loadSchemas(dir)
		if err != nil {
			fmt.Printf("Error loading schemas: %v\n", err)
			schemasCache = make(map[string]*ResourceSchema)
		}
	})
	return schemasCache
}

// getSchema returns a single schema by ID.
func getSchema(id string) (*ResourceSchema, bool) {
	schemas := getSchemas()
	s, ok := schemas[id]
	return s, ok
}

// getSchemasDir determines the schemas directory path.
func getSchemasDir() string {
	if dir := os.Getenv("SCHEMAS_DIR"); dir != "" {
		return dir
	}
	return "../schemas"
}
