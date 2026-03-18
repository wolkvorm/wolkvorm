package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// PolicyViolation represents a policy check result.
type PolicyViolation struct {
	PolicyID   string `json:"policy_id"`
	PolicyName string `json:"policy_name"`
	Severity   string `json:"severity"`
	Message    string `json:"message"`
}

// EvaluatePolicies checks all active policies against the given inputs.
// Uses a simple rule engine (JSON-based conditions) instead of full OPA.
func EvaluatePolicies(schemaID string, inputs map[string]any, region, env string) []PolicyViolation {
	policies := dbGetActivePolicies()
	if len(policies) == 0 {
		return nil
	}

	var violations []PolicyViolation

	for _, p := range policies {
		// Parse the policy rules (stored as JSON in rego_content field)
		var rules []PolicyRule
		if err := json.Unmarshal([]byte(p.RegoContent), &rules); err != nil {
			// Try as a single rule
			var single PolicyRule
			if err := json.Unmarshal([]byte(p.RegoContent), &single); err != nil {
				continue
			}
			rules = []PolicyRule{single}
		}

		for _, rule := range rules {
			if violated, msg := checkRule(rule, schemaID, inputs, region, env); violated {
				violations = append(violations, PolicyViolation{
					PolicyID:   p.ID,
					PolicyName: p.Name,
					Severity:   p.Severity,
					Message:    msg,
				})
			}
		}
	}

	return violations
}

// PolicyRule defines a single policy check.
type PolicyRule struct {
	// Scope: which schemas this applies to ("*" for all, or comma-separated IDs)
	Schemas string `json:"schemas"`
	// Field to check
	Field string `json:"field"`
	// Operator: "equals", "not_equals", "contains", "not_contains", "in", "not_in", "regex", "required"
	Operator string `json:"operator"`
	// Value to compare against
	Value any `json:"value"`
	// Message when violated
	Message string `json:"message"`
}

func checkRule(rule PolicyRule, schemaID string, inputs map[string]any, region, env string) (bool, string) {
	// Check schema scope
	if rule.Schemas != "" && rule.Schemas != "*" {
		schemas := strings.Split(rule.Schemas, ",")
		found := false
		for _, s := range schemas {
			if strings.TrimSpace(s) == schemaID {
				found = true
				break
			}
		}
		if !found {
			return false, ""
		}
	}

	// Get field value
	var fieldValue any
	switch rule.Field {
	case "_region":
		fieldValue = region
	case "_env":
		fieldValue = env
	case "_schema":
		fieldValue = schemaID
	default:
		fieldValue = inputs[rule.Field]
	}

	fieldStr := fmt.Sprintf("%v", fieldValue)
	valueStr := fmt.Sprintf("%v", rule.Value)

	msg := rule.Message
	if msg == "" {
		msg = fmt.Sprintf("Policy violation: field '%s' %s '%v'", rule.Field, rule.Operator, rule.Value)
	}

	switch rule.Operator {
	case "equals":
		if fieldStr == valueStr {
			return true, msg
		}
	case "not_equals":
		if fieldStr != valueStr {
			return true, msg
		}
	case "contains":
		if strings.Contains(fieldStr, valueStr) {
			return true, msg
		}
	case "not_contains":
		if !strings.Contains(fieldStr, valueStr) {
			return true, msg
		}
	case "in":
		// Value should be a comma-separated list
		allowed := strings.Split(valueStr, ",")
		found := false
		for _, a := range allowed {
			if strings.TrimSpace(a) == fieldStr {
				found = true
				break
			}
		}
		if !found {
			return true, msg
		}
	case "not_in":
		denied := strings.Split(valueStr, ",")
		for _, d := range denied {
			if strings.TrimSpace(d) == fieldStr {
				return true, msg
			}
		}
	case "required":
		if fieldValue == nil || fieldStr == "" || fieldStr == "<nil>" {
			return true, msg
		}
	}

	return false, ""
}
