package main

import (
	"fmt"
	"strings"
)

// HCLOptions holds optional configuration for HCL generation.
type HCLOptions struct {
	Region   string
	StateKey string // if set, adds remote_state block
}

// GenerateHCL produces a terragrunt.hcl file content from a schema and user inputs.
func GenerateHCL(schema *ResourceSchema, inputs map[string]any, env string, region ...string) string {
	opts := HCLOptions{}
	if len(region) > 0 && region[0] != "" {
		opts.Region = region[0]
	}
	return GenerateHCLWithOptions(schema, inputs, env, opts)
}

// GenerateHCLWithOptions produces a terragrunt.hcl with full options including remote state.
func GenerateHCLWithOptions(schema *ResourceSchema, inputs map[string]any, env string, opts HCLOptions) string {
	var b strings.Builder

	reg := opts.Region
	if reg == "" {
		reg = "eu-central-1"
	}

	// Generate provider block with explicit region
	b.WriteString("generate \"provider\" {\n")
	b.WriteString("  path      = \"provider.tf\"\n")
	b.WriteString("  if_exists = \"overwrite_terragrunt\"\n")
	b.WriteString("  contents  = <<EOF\n")
	b.WriteString(fmt.Sprintf("provider \"aws\" {\n  region = \"%s\"\n}\nEOF\n", reg))
	b.WriteString("}\n\n")

	// Generate S3 backend block (if state backend is configured)
	stateInfo := GetStateBackendInfo()
	if stateInfo != nil && opts.StateKey != "" {
		b.WriteString("generate \"backend\" {\n")
		b.WriteString("  path      = \"backend.tf\"\n")
		b.WriteString("  if_exists = \"overwrite_terragrunt\"\n")
		b.WriteString("  contents  = <<EOF\n")
		b.WriteString("terraform {\n")
		b.WriteString("  backend \"s3\" {\n")
		b.WriteString(fmt.Sprintf("    bucket         = \"%s\"\n", stateInfo.Bucket))
		b.WriteString(fmt.Sprintf("    key            = \"%s\"\n", opts.StateKey))
		b.WriteString(fmt.Sprintf("    region         = \"%s\"\n", stateInfo.Region))
		b.WriteString("    encrypt        = true\n")
		b.WriteString(fmt.Sprintf("    dynamodb_table = \"%s\"\n", stateInfo.LockTable))
		b.WriteString("  }\n")
		b.WriteString("}\n")
		b.WriteString("EOF\n")
		b.WriteString("}\n\n")
	}

	// terraform block
	b.WriteString("terraform {\n")
	b.WriteString(fmt.Sprintf("  source = \"%s\"\n", schema.Module.Source))
	b.WriteString("}\n\n")

	// inputs block
	b.WriteString("inputs = {\n")

	// EKS node group fields that need to be merged into eks_managed_node_group_defaults
	eksNodeFields := map[string]bool{
		"node_desired_size":   true,
		"node_min_size":       true,
		"node_max_size":       true,
		"node_instance_types": true,
		"node_capacity_type":  true,
		"node_ami_type":       true,
		"node_disk_size":      true,
	}

	for _, field := range schema.Inputs {
		// Skip EKS node fields — they'll be merged below
		if eksNodeFields[field.Name] {
			continue
		}

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

	// Merge EKS node group fields into eks_managed_node_group_defaults
	if schema.ID == "eks" {
		desiredSize := getInputInt(inputs, "node_desired_size", 2)
		minSize := getInputInt(inputs, "node_min_size", 1)
		maxSize := getInputInt(inputs, "node_max_size", 4)
		instanceType := getInputStr(inputs, "node_instance_types", "t3.large")
		capacityType := getInputStr(inputs, "node_capacity_type", "ON_DEMAND")
		amiType := getInputStr(inputs, "node_ami_type", "AL2023_x86_64_STANDARD")
		diskSize := getInputInt(inputs, "node_disk_size", 50)

		// Check if there's already a custom eks_managed_node_group_defaults from HCL field
		existingDefaults := ""
		if v, ok := inputs["eks_managed_node_group_defaults"]; ok {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				existingDefaults = strings.TrimSpace(s)
			}
		}

		b.WriteString("\n  eks_managed_node_group_defaults = {\n")
		b.WriteString(fmt.Sprintf("    desired_size    = %d\n", desiredSize))
		b.WriteString(fmt.Sprintf("    min_size        = %d\n", minSize))
		b.WriteString(fmt.Sprintf("    max_size        = %d\n", maxSize))
		b.WriteString(fmt.Sprintf("    instance_types  = [\"%s\"]\n", instanceType))
		b.WriteString(fmt.Sprintf("    capacity_type   = \"%s\"\n", capacityType))
		b.WriteString(fmt.Sprintf("    ami_type        = \"%s\"\n", amiType))
		b.WriteString(fmt.Sprintf("    disk_size       = %d\n", diskSize))

		// Merge in any extra config from the HCL field (strip outer braces)
		if existingDefaults != "" {
			inner := existingDefaults
			if strings.HasPrefix(inner, "{") && strings.HasSuffix(inner, "}") {
				inner = inner[1 : len(inner)-1]
			}
			inner = strings.TrimSpace(inner)
			if inner != "" {
				b.WriteString("\n")
				for _, line := range strings.Split(inner, "\n") {
					b.WriteString("    " + strings.TrimSpace(line) + "\n")
				}
			}
		}
		b.WriteString("  }\n")

		// Auto-generate a default node group if eks_managed_node_groups is empty
		hasCustomGroups := false
		if v, ok := inputs["eks_managed_node_groups"]; ok {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				hasCustomGroups = true
			}
		}
		if !hasCustomGroups {
			subnetIDs := getInputStr(inputs, "subnet_ids", "")
			b.WriteString("\n  eks_managed_node_groups = {\n")
			b.WriteString("    default = {\n")
			if subnetIDs != "" {
				parts := strings.Split(subnetIDs, ",")
				var quoted []string
				for _, p := range parts {
					p = strings.TrimSpace(p)
					if p != "" {
						quoted = append(quoted, fmt.Sprintf("\"%s\"", p))
					}
				}
				b.WriteString(fmt.Sprintf("      subnet_ids = [%s]\n", strings.Join(quoted, ", ")))
			}
			b.WriteString("    }\n")
			b.WriteString("  }\n")
		}
	}

	// tags
	if schema.CommonInputs.Tags {
		b.WriteString("\n  tags = {\n")
		b.WriteString(fmt.Sprintf("    Environment = \"%s\"\n", env))
		b.WriteString("    ManagedBy   = \"GrandForm\"\n")
		b.WriteString("  }\n")
	}

	b.WriteString("}\n")

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
		// Multiline is stored as-is (special handling per resource)
		return fmt.Sprintf("  %s = \"%s\"\n", name, fmt.Sprintf("%v", value))

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
