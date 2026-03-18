package main

import (
	"fmt"
	"strings"
)

// HCLOptions holds optional configuration for HCL generation.
type HCLOptions struct {
	Region   string
	StateKey string // if set, adds S3 backend block
}

// GenerateHCL produces a main.tf file content from a schema and user inputs.
func GenerateHCL(schema *ResourceSchema, inputs map[string]any, env string, region ...string) string {
	opts := HCLOptions{}
	if len(region) > 0 && region[0] != "" {
		opts.Region = region[0]
	}
	return GenerateHCLWithOptions(schema, inputs, env, opts)
}

// GenerateHCLWithOptions produces a main.tf with full options including remote state.
func GenerateHCLWithOptions(schema *ResourceSchema, inputs map[string]any, env string, opts HCLOptions) string {
	var b strings.Builder

	reg := opts.Region
	if reg == "" {
		reg = "eu-central-1"
	}

	// Terraform backend block (if state backend is configured)
	stateInfo := GetStateBackendInfo()
	if stateInfo != nil && opts.StateKey != "" {
		b.WriteString("terraform {\n")
		b.WriteString("  backend \"s3\" {\n")
		b.WriteString(fmt.Sprintf("    bucket         = \"%s\"\n", stateInfo.Bucket))
		b.WriteString(fmt.Sprintf("    key            = \"%s\"\n", opts.StateKey))
		b.WriteString(fmt.Sprintf("    region         = \"%s\"\n", stateInfo.Region))
		b.WriteString("    encrypt        = true\n")
		b.WriteString(fmt.Sprintf("    dynamodb_table = \"%s\"\n", stateInfo.LockTable))
		b.WriteString("  }\n")
		b.WriteString("}\n\n")
	}

	// Provider block
	provider := schema.Provider
	if provider == "" {
		provider = "aws"
	}
	switch provider {
	case "aws":
		b.WriteString(fmt.Sprintf("provider \"aws\" {\n  region = \"%s\"\n}\n\n", reg))
	case "azurerm":
		b.WriteString("provider \"azurerm\" {\n  features {}\n}\n\n")
	case "google":
		b.WriteString(fmt.Sprintf("provider \"google\" {\n  region = \"%s\"\n}\n\n", reg))
	case "digitalocean":
		b.WriteString("provider \"digitalocean\" {}\n\n")
	case "huaweicloud":
		b.WriteString(fmt.Sprintf("provider \"huaweicloud\" {\n  region = \"%s\"\n}\n\n", reg))
	default:
		b.WriteString(fmt.Sprintf("provider \"%s\" {}\n\n", provider))
	}

	// Resource or Module block
	if schema.ResourceType != "" {
		// Direct resource block (e.g. azurerm_virtual_network)
		b.WriteString(fmt.Sprintf("resource \"%s\" \"this\" {\n", schema.ResourceType))
	} else {
		// Module block
		b.WriteString("module \"this\" {\n")
		b.WriteString(fmt.Sprintf("  source  = \"%s\"\n", schema.Module.Source))
		if schema.Module.Version != "" {
			b.WriteString(fmt.Sprintf("  version = \"%s\"\n", schema.Module.Version))
		}
		b.WriteString("\n")
	}

	// Collect block fields separately so we can group them
	type blockField struct {
		blockName string
		fieldName string
		fieldType string
		val       any
	}
	var blockFields []blockField

	for _, field := range schema.Inputs {
		val, exists := inputs[field.Name]
		if !exists {
			if field.Default != nil {
				val = field.Default
			} else {
				continue
			}
		}

		// Skip empty string values for optional fields — sending "" to Terraform
		// causes validation errors for fields like acceleration_status that expect
		// specific enum values or nothing at all.
		if strVal, ok := val.(string); ok && strVal == "" {
			continue
		}

		// If field belongs to a nested block, collect it for later
		if field.Block != "" {
			blockFields = append(blockFields, blockField{field.Block, field.Name, field.Type, val})
			continue
		}

		// Handle multi/list string fields — always output as HCL list
		if field.Type == "string" && isListField(field) {
			strVal := fmt.Sprintf("%v", val)
			if strVal != "" {
				parts := strings.Split(strVal, ",")
				var quoted []string
				for _, p := range parts {
					p = strings.TrimSpace(p)
					if p != "" {
						quoted = append(quoted, fmt.Sprintf("\"%s\"", p))
					}
				}
				b.WriteString(fmt.Sprintf("  %s = [%s]\n", field.Name, strings.Join(quoted, ", ")))
			}
			continue
		}

		b.WriteString(formatHCLValue(field.Name, field.Type, val))
	}

	// Write nested block fields grouped by block name
	if len(blockFields) > 0 {
		// Gather unique block names in order
		seen := map[string]bool{}
		var blockOrder []string
		for _, bf := range blockFields {
			if !seen[bf.blockName] {
				seen[bf.blockName] = true
				blockOrder = append(blockOrder, bf.blockName)
			}
		}
		for _, blockName := range blockOrder {
			b.WriteString(fmt.Sprintf("\n  %s {\n", blockName))
			for _, bf := range blockFields {
				if bf.blockName == blockName {
					line := formatHCLValue(bf.fieldName, bf.fieldType, bf.val)
					// re-indent: add two more spaces
					for _, l := range strings.Split(strings.TrimRight(line, "\n"), "\n") {
						b.WriteString("  " + l + "\n")
					}
				}
			}
			b.WriteString("  }\n")
		}
	}

	// tags
	if schema.CommonInputs.Tags {
		b.WriteString("\n  tags = {\n")
		b.WriteString(fmt.Sprintf("    Environment = \"%s\"\n", env))
		b.WriteString("    ManagedBy   = \"Wolkvorm\"\n")
		b.WriteString("  }\n")
	}

	b.WriteString("}\n")

	// Generate output blocks for module outputs (not applicable to direct resource blocks)
	if schema.ResourceType == "" && len(schema.Module.Outputs) > 0 {
		b.WriteString("\n")
		for _, outName := range schema.Module.Outputs {
			b.WriteString(fmt.Sprintf("output \"%s\" {\n", outName))
			b.WriteString(fmt.Sprintf("  value = module.this.%s\n", outName))
			b.WriteString("}\n")
		}
	}

	return b.String()
}

// getInputInt safely extracts an integer from a map with a default value.

// isListField checks if a schema field should be rendered as an HCL list.
func isListField(field SchemaInput) bool {
	if field.Multi {
		return true
	}
	// Common suffixes that indicate list-type Terraform variables
	name := field.Name
	listSuffixes := []string{"_ids", "_cidrs", "_subnets", "_arns", "_types", "_names", "_exports"}
	for _, suffix := range listSuffixes {
		if strings.HasSuffix(name, suffix) {
			return true
		}
	}
	return false
}
func getInputInt(inputs map[string]any, key string, def int) int {
	v, ok := inputs[key]
	if !ok {
		return def
	}
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	default:
		return def
	}
}

// getInputStr safely extracts a string from a map with a default value.
func getInputStr(inputs map[string]any, key string, def string) string {
	v, ok := inputs[key]
	if !ok {
		return def
	}
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return def
}

// formatHCLValue formats a single key-value pair for HCL.
func formatHCLValue(name string, fieldType string, value any) string {
	switch fieldType {
	case "boolean":
		boolVal := false
		switch v := value.(type) {
		case bool:
			boolVal = v
		case string:
			boolVal = v == "true"
		}
		if boolVal {
			return fmt.Sprintf("  %s = true\n", name)
		}
		return fmt.Sprintf("  %s = false\n", name)

	case "number":
		switch v := value.(type) {
		case float64:
			if v == float64(int(v)) {
				return fmt.Sprintf("  %s = %d\n", name, int(v))
			}
			return fmt.Sprintf("  %s = %g\n", name, v)
		default:
			return fmt.Sprintf("  %s = %v\n", name, v)
		}

	case "select", "string":
		strVal := fmt.Sprintf("%v", value)
		// Handle comma-separated lists as HCL lists
		if strings.Contains(strVal, ",") && fieldType == "string" {
			parts := strings.Split(strVal, ",")
			var quoted []string
			for _, p := range parts {
				quoted = append(quoted, fmt.Sprintf("\"%s\"", strings.TrimSpace(p)))
			}
			return fmt.Sprintf("  %s = [%s]\n", name, strings.Join(quoted, ", "))
		}
		return fmt.Sprintf("  %s = \"%s\"\n", name, strVal)

	case "multiline":
		strVal := fmt.Sprintf("%v", value)
		// Use heredoc for multi-line values (e.g. JSON policy documents)
		if strings.Contains(strVal, "\n") {
			var b strings.Builder
			b.WriteString(fmt.Sprintf("  %s = <<-EOT\n", name))
			for _, line := range strings.Split(strVal, "\n") {
				b.WriteString("    " + line + "\n")
			}
			b.WriteString("  EOT\n")
			return b.String()
		}
		return fmt.Sprintf("  %s = \"%s\"\n", name, strVal)

	case "hcl":
		return formatHCLRaw(name, value)

	case "list":
		return formatHCLList(name, value)

	case "sg_rules":
		return formatSGRules(name, value)

	default:
		return fmt.Sprintf("  %s = \"%v\"\n", name, value)
	}
}

// formatHCLRaw writes a raw HCL block value directly into the inputs section.
// The value is expected to be a string containing valid HCL.
func formatHCLRaw(name string, value any) string {
	strVal := fmt.Sprintf("%v", value)
	strVal = strings.TrimSpace(strVal)
	if strVal == "" {
		return ""
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("  %s = ", name))

	// Indent each line of the HCL block
	lines := strings.Split(strVal, "\n")
	for i, line := range lines {
		if i == 0 {
			b.WriteString(line + "\n")
		} else {
			if strings.TrimSpace(line) == "" {
				b.WriteString("\n")
			} else {
				b.WriteString("  " + line + "\n")
			}
		}
	}
	return b.String()
}

// formatHCLList formats a newline-separated string as an HCL list of strings.
func formatHCLList(name string, value any) string {
	strVal := fmt.Sprintf("%v", value)
	strVal = strings.TrimSpace(strVal)
	if strVal == "" {
		return fmt.Sprintf("  %s = []\n", name)
	}

	lines := strings.Split(strVal, "\n")
	var items []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			items = append(items, line)
		}
	}

	if len(items) == 0 {
		return fmt.Sprintf("  %s = []\n", name)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("  %s = [\n", name))
	for _, item := range items {
		b.WriteString(fmt.Sprintf("    \"%s\",\n", item))
	}
	b.WriteString("  ]\n")
	return b.String()
}

// formatSGRules formats security group rules as HCL list of maps.
// Input is a JSON array of rule objects with from_port, to_port, protocol, cidr, description.
func formatSGRules(name string, value any) string {
	rules, ok := value.([]any)
	if !ok {
		return fmt.Sprintf("  %s = []\n", name)
	}

	if len(rules) == 0 {
		return fmt.Sprintf("  %s = []\n", name)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("  %s = [\n", name))

	for _, r := range rules {
		ruleMap, ok := r.(map[string]any)
		if !ok {
			continue
		}

		fromPort := 0
		toPort := 0
		protocol := "tcp"
		cidr := "0.0.0.0/0"
		desc := ""

		if v, ok := ruleMap["from_port"]; ok {
			switch fv := v.(type) {
			case float64:
				fromPort = int(fv)
			case int:
				fromPort = fv
			case string:
				fmt.Sscanf(fv, "%d", &fromPort)
			}
		}
		if v, ok := ruleMap["to_port"]; ok {
			switch tv := v.(type) {
			case float64:
				toPort = int(tv)
			case int:
				toPort = tv
			case string:
				fmt.Sscanf(tv, "%d", &toPort)
			}
		}
		if v, ok := ruleMap["protocol"].(string); ok && v != "" {
			protocol = v
		}
		if v, ok := ruleMap["cidr"].(string); ok && v != "" {
			cidr = v
			// Auto-fix CIDR if missing subnet mask
			if !strings.Contains(cidr, "/") {
				if cidr == "0.0.0.0" {
					cidr = "0.0.0.0/0"
				} else {
					cidr = cidr + "/32"
				}
			}
		}
		if v, ok := ruleMap["description"].(string); ok {
			desc = v
		}

		// Handle "all" protocol for "All traffic" rules
		if protocol == "all" {
			protocol = "-1"
		}

		b.WriteString("    {\n")
		b.WriteString(fmt.Sprintf("      from_port   = %d\n", fromPort))
		b.WriteString(fmt.Sprintf("      to_port     = %d\n", toPort))
		b.WriteString(fmt.Sprintf("      protocol    = \"%s\"\n", protocol))
		b.WriteString(fmt.Sprintf("      cidr_blocks = \"%s\"\n", cidr))
		if desc != "" {
			b.WriteString(fmt.Sprintf("      description = \"%s\"\n", desc))
		}
		b.WriteString("    },\n")
	}

	b.WriteString("  ]\n")
	return b.String()
}

// GenerateStateKey creates a unique S3 key for a resource's terraform state.
func GenerateStateKey(schemaID string, resourceName string, env string) string {
	return fmt.Sprintf("%s/%s/%s/terraform.tfstate", env, schemaID, resourceName)
}

// ResolvePath fills in the path template with actual values.
func ResolvePath(template string, inputs map[string]any, env string) string {
	result := template
	result = strings.ReplaceAll(result, "{env}", env)

	for key, val := range inputs {
		placeholder := fmt.Sprintf("{%s}", key)
		result = strings.ReplaceAll(result, placeholder, fmt.Sprintf("%v", val))
	}

	return result
}
