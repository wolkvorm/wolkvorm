package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

type GraphNode struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Status   string `json:"status"`
	Env      string `json:"env"`
	Region   string `json:"region"`
	SchemaID string `json:"schema_id"`
	Group    string `json:"group"`
}

type GraphEdge struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Label string `json:"label"`
}

// Map schema IDs to AWS service groups
func schemaToGroup(schemaID string) string {
	groups := map[string]string{
		"vpc":              "VPC / Networking",
		"subnet":           "VPC / Networking",
		"security-group":   "VPC / Networking",
		"alb":              "VPC / Networking",
		"api-gateway":      "VPC / Networking",
		"ec2":              "EC2",
		"key-pair":         "EC2",
		"s3":               "S3",
		"rds":              "RDS",
		"dynamodb":         "DynamoDB",
		"elasticache":      "ElastiCache",
		"lambda":           "Lambda",
		"eks":              "EKS",
		"eks-addons":       "EKS",
		"iam-policy":       "IAM",
		"iam-role":         "IAM",
		"ecr-repository":   "ECR",
		"sns-topic":        "Messaging",
		"sqs-queue":        "Messaging",
		"acm-certificate":  "Security",
		"msk-connector":    "MSK",
		"msk-custom-plugin":"MSK",
		"msk-worker-config":"MSK",
	}
	if g, ok := groups[schemaID]; ok {
		return g
	}
	return "Other"
}

// Fields that reference other resources
var referenceFields = map[string]string{
	"vpc_id":                 "vpc",
	"subnet_id":              "subnet",
	"subnet_ids":             "subnet",
	"vpc_security_group_ids": "security-group",
	"security_groups":        "security-group",
	"key_name":               "key-pair",
	"target_group_arn":       "alb",
	"db_subnet_group_name":   "rds",
	"cluster_name":           "eks",
}

func graphHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	resources := dbGetResources(false)

	nodes := []GraphNode{}
	edges := []GraphEdge{}

	// Build node map for lookup
	nodeByValue := map[string]string{} // "value" -> resource ID

	for _, res := range resources {
		if res.Status == "destroyed" {
			continue
		}

		nodes = append(nodes, GraphNode{
			ID:       res.ID,
			Name:     res.Name,
			Type:     res.SchemaID,
			Status:   res.Status,
			Env:      res.Env,
			Region:   res.Region,
			SchemaID: res.SchemaID,
			Group:    schemaToGroup(res.SchemaID),
		})

		// Index by name and other identifiable values
		nodeByValue[res.Name] = res.ID
		if inputs := res.Inputs; inputs != nil {
			// Store VPC ID, SG ID etc from outputs if available
			for _, key := range []string{"vpc_id", "name", "bucket", "cluster_name"} {
				if v, ok := inputs[key]; ok {
					nodeByValue[toString(v)] = res.ID
				}
			}
		}
	}

	// Build edges from reference fields
	for _, res := range resources {
		if res.Status == "destroyed" || res.Inputs == nil {
			continue
		}

		for field, targetType := range referenceFields {
			val, ok := res.Inputs[field]
			if !ok || val == nil {
				continue
			}

			// Handle string and array values
			refs := extractRefs(val)
			for _, ref := range refs {
				// Find target by value
				if targetID, ok := nodeByValue[ref]; ok && targetID != res.ID {
					edges = append(edges, GraphEdge{
						From:  res.ID,
						To:    targetID,
						Label: field,
					})
				} else {
					// Find target by schema type
					for _, target := range resources {
						if target.SchemaID == targetType && target.ID != res.ID && target.Env == res.Env {
							edges = append(edges, GraphEdge{
								From:  res.ID,
								To:    target.ID,
								Label: field,
							})
							break
						}
					}
				}
			}
		}

		// Special case: same-env resources of known patterns
		_ = targetType(res.SchemaID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"nodes": nodes,
		"edges": edges,
	})
}

func extractRefs(val any) []string {
	switch v := val.(type) {
	case string:
		if v == "" {
			return nil
		}
		// Could be comma-separated
		if strings.Contains(v, ",") {
			parts := strings.Split(v, ",")
			refs := []string{}
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					refs = append(refs, p)
				}
			}
			return refs
		}
		return []string{v}
	case []any:
		refs := []string{}
		for _, item := range v {
			refs = append(refs, toString(item))
		}
		return refs
	case []string:
		return v
	}
	return nil
}

func targetType(schemaID string) string {
	return schemaID
}

func toString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
