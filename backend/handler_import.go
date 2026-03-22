package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type DiscoveredResource struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Type     string            `json:"type"`
	Region   string            `json:"region"`
	Details  map[string]string `json:"details"`
	SchemaID string            `json:"schema_id"`
}

func importScanHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		writeError(w, 405, "Method not allowed")
		return
	}

	var req struct {
		ResourceType string `json:"resource_type"`
		Region       string `json:"region"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid JSON")
		return
	}

	creds := GetAWSCredentials()
	if creds.AccessKeyID == "" && creds.AuthMethod != "iam_role" {
		writeError(w, 400, "AWS credentials not configured")
		return
	}

	region := req.Region
	if region == "" {
		region = creds.DefaultRegion
	}
	if region == "" {
		region = "us-east-1"
	}

	var resources []DiscoveredResource
	var scanErr error

	switch req.ResourceType {
	case "ec2":
		resources, scanErr = scanEC2Instances(region)
	case "s3":
		resources, scanErr = scanS3Buckets(region)
	case "vpc":
		resources, scanErr = scanVPCs(region)
	case "security-group":
		resources, scanErr = scanSecurityGroups(region)
	default:
		writeError(w, 400, "Unsupported resource type: "+req.ResourceType)
		return
	}

	if scanErr != nil {
		writeError(w, 500, "Scan failed: "+scanErr.Error())
		return
	}

	// Filter out already managed resources
	managed := dbGetResources(false)
	managedNames := map[string]bool{}
	for _, m := range managed {
		managedNames[m.Name] = true
	}

	var unmanaged []DiscoveredResource
	for _, r := range resources {
		if !managedNames[r.Name] {
			unmanaged = append(unmanaged, r)
		}
	}

	logAudit("import_scan", "system", req.ResourceType, map[string]any{
		"found":     len(resources),
		"unmanaged": len(unmanaged),
		"region":    region,
	}, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"resources":     unmanaged,
		"total_found":   len(resources),
		"already_managed": len(resources) - len(unmanaged),
	})
}

func importExecuteHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		writeError(w, 405, "Method not allowed")
		return
	}

	var req struct {
		Resources []DiscoveredResource `json:"resources"`
		Env       string               `json:"env"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid JSON")
		return
	}

	if req.Env == "" {
		req.Env = "imported"
	}

	imported := 0
	for _, res := range req.Resources {
		now := time.Now().Format("2006-01-02 15:04:05")
		stateKey := GenerateStateKey(res.SchemaID, res.Name, req.Env)

		mr := ManagedResource{
			ID:         fmt.Sprintf("imp-%d", time.Now().UnixNano()),
			Name:       res.Name,
			SchemaID:   res.SchemaID,
			SchemaName: res.Type,
			Env:        req.Env,
			Region:     res.Region,
			Inputs:     map[string]any{},
			StateKey:   stateKey,
			Status:     "imported",
			CreatedAt:  now,
			UpdatedAt:  now,
		}

		// Copy details as inputs
		for k, v := range res.Details {
			mr.Inputs[k] = v
		}

		if err := dbInsertResource(mr); err != nil {
			continue
		}
		imported++
	}

	logAudit("import_execute", "system", "", map[string]any{
		"imported": imported,
		"env":      req.Env,
	}, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"imported": imported,
		"total":    len(req.Resources),
	})
}

// Scanner functions

func scanEC2Instances(region string) ([]DiscoveredResource, error) {
	client, err := getEC2Client(region)
	if err != nil {
		return nil, err
	}

	output, err := client.DescribeInstances(context.TODO(), &ec2.DescribeInstancesInput{})
	if err != nil {
		return nil, err
	}

	var resources []DiscoveredResource
	for _, reservation := range output.Reservations {
		for _, inst := range reservation.Instances {
			name := aws.ToString(inst.InstanceId)
			for _, tag := range inst.Tags {
				if aws.ToString(tag.Key) == "Name" {
					name = aws.ToString(tag.Value)
				}
			}
			resources = append(resources, DiscoveredResource{
				ID:       aws.ToString(inst.InstanceId),
				Name:     name,
				Type:     "EC2 Instance",
				Region:   region,
				SchemaID: "ec2",
				Details: map[string]string{
					"instance_id":   aws.ToString(inst.InstanceId),
					"instance_type": string(inst.InstanceType),
					"state":         string(inst.State.Name),
					"vpc_id":        aws.ToString(inst.VpcId),
				},
			})
		}
	}
	return resources, nil
}

func scanS3Buckets(region string) ([]DiscoveredResource, error) {
	cfg, err := getAWSConfig(region)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(cfg)

	output, err := client.ListBuckets(context.TODO(), &s3.ListBucketsInput{})
	if err != nil {
		return nil, err
	}

	var resources []DiscoveredResource
	for _, bucket := range output.Buckets {
		resources = append(resources, DiscoveredResource{
			ID:       aws.ToString(bucket.Name),
			Name:     aws.ToString(bucket.Name),
			Type:     "S3 Bucket",
			Region:   region,
			SchemaID: "s3",
			Details: map[string]string{
				"bucket":     aws.ToString(bucket.Name),
				"created_at": bucket.CreationDate.Format("2006-01-02"),
			},
		})
	}
	return resources, nil
}

func scanVPCs(region string) ([]DiscoveredResource, error) {
	client, err := getEC2Client(region)
	if err != nil {
		return nil, err
	}

	output, err := client.DescribeVpcs(context.TODO(), &ec2.DescribeVpcsInput{})
	if err != nil {
		return nil, err
	}

	var resources []DiscoveredResource
	for _, vpc := range output.Vpcs {
		name := aws.ToString(vpc.VpcId)
		for _, tag := range vpc.Tags {
			if aws.ToString(tag.Key) == "Name" {
				name = aws.ToString(tag.Value)
			}
		}
		resources = append(resources, DiscoveredResource{
			ID:       aws.ToString(vpc.VpcId),
			Name:     name,
			Type:     "VPC",
			Region:   region,
			SchemaID: "vpc",
			Details: map[string]string{
				"vpc_id":     aws.ToString(vpc.VpcId),
				"cidr_block": aws.ToString(vpc.CidrBlock),
				"state":      string(vpc.State),
			},
		})
	}
	return resources, nil
}

func scanSecurityGroups(region string) ([]DiscoveredResource, error) {
	client, err := getEC2Client(region)
	if err != nil {
		return nil, err
	}

	output, err := client.DescribeSecurityGroups(context.TODO(), &ec2.DescribeSecurityGroupsInput{})
	if err != nil {
		return nil, err
	}

	var resources []DiscoveredResource
	for _, sg := range output.SecurityGroups {
		resources = append(resources, DiscoveredResource{
			ID:       aws.ToString(sg.GroupId),
			Name:     aws.ToString(sg.GroupName),
			Type:     "Security Group",
			Region:   region,
			SchemaID: "security-group",
			Details: map[string]string{
				"group_id":    aws.ToString(sg.GroupId),
				"group_name":  aws.ToString(sg.GroupName),
				"description": aws.ToString(sg.Description),
				"vpc_id":      aws.ToString(sg.VpcId),
			},
		})
	}
	return resources, nil
}
