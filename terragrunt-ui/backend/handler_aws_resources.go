package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"
)

// --- In-memory cache ---

type cacheEntry struct {
	data      any
	expiresAt time.Time
}

var (
	resourceCache   = map[string]cacheEntry{}
	resourceCacheMu sync.RWMutex
	cacheTTL        = 60 * time.Second
)

func getCached(key string) (any, bool) {
	resourceCacheMu.RLock()
	defer resourceCacheMu.RUnlock()
	entry, ok := resourceCache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

func setCache(key string, data any) {
	resourceCacheMu.Lock()
	defer resourceCacheMu.Unlock()
	resourceCache[key] = cacheEntry{data: data, expiresAt: time.Now().Add(cacheTTL)}
}

// --- Response types ---

type AWSVpc struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CIDR      string `json:"cidr"`
	IsDefault bool   `json:"is_default"`
}

type AWSSubnet struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	AvailabilityZone string `json:"az"`
	CIDR             string `json:"cidr"`
	VpcID            string `json:"vpc_id"`
	Public           bool   `json:"public"`
}

type AWSSecurityGroup struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	VpcID       string `json:"vpc_id"`
}

type AWSKeyPair struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type AWSAMI struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Architecture string `json:"architecture"`
}

// --- Helper ---

func getEC2Client(region string) (*ec2.Client, error) {
	cfg, err := getAWSConfig(region)
	if err != nil {
		return nil, err
	}
	return ec2.NewFromConfig(cfg), nil
}

func getNameTag(tags []ec2types.Tag) string {
	for _, t := range tags {
		if aws.ToString(t.Key) == "Name" {
			return aws.ToString(t.Value)
		}
	}
	return ""
}

func writeJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// --- Handlers ---

// awsVpcsHandler lists VPCs in the given region.
// GET /api/aws/vpcs?region=us-east-1
func awsVpcsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	region := r.URL.Query().Get("region")
	cacheKey := fmt.Sprintf("vpcs:%s", region)
	if cached, ok := getCached(cacheKey); ok {
		writeJSON(w, cached)
		return
	}

	client, err := getEC2Client(region)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	result, err := client.DescribeVpcs(context.Background(), &ec2.DescribeVpcsInput{})
	if err != nil {
		writeError(w, 500, fmt.Sprintf("Failed to list VPCs: %v", err))
		return
	}

	vpcs := make([]AWSVpc, 0, len(result.Vpcs))
	for _, v := range result.Vpcs {
		vpcs = append(vpcs, AWSVpc{
			ID:        aws.ToString(v.VpcId),
			Name:      getNameTag(v.Tags),
			CIDR:      aws.ToString(v.CidrBlock),
			IsDefault: aws.ToBool(v.IsDefault),
		})
	}

	// Sort: default VPC first, then by name
	sort.Slice(vpcs, func(i, j int) bool {
		if vpcs[i].IsDefault != vpcs[j].IsDefault {
			return vpcs[i].IsDefault
		}
		return vpcs[i].Name < vpcs[j].Name
	})

	setCache(cacheKey, vpcs)
	writeJSON(w, vpcs)
}

// awsSubnetsHandler lists subnets, optionally filtered by VPC.
// GET /api/aws/subnets?region=us-east-1&vpc=vpc-123
func awsSubnetsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	region := r.URL.Query().Get("region")
	vpcFilter := r.URL.Query().Get("vpc")
	cacheKey := fmt.Sprintf("subnets:%s:%s", region, vpcFilter)
	if cached, ok := getCached(cacheKey); ok {
		writeJSON(w, cached)
		return
	}

	client, err := getEC2Client(region)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	input := &ec2.DescribeSubnetsInput{}
	if vpcFilter != "" {
		input.Filters = []ec2types.Filter{
			{Name: aws.String("vpc-id"), Values: []string{vpcFilter}},
		}
	}

	result, err := client.DescribeSubnets(context.Background(), input)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("Failed to list subnets: %v", err))
		return
	}

	subnets := make([]AWSSubnet, 0, len(result.Subnets))
	for _, s := range result.Subnets {
		subnets = append(subnets, AWSSubnet{
			ID:               aws.ToString(s.SubnetId),
			Name:             getNameTag(s.Tags),
			AvailabilityZone: aws.ToString(s.AvailabilityZone),
			CIDR:             aws.ToString(s.CidrBlock),
			VpcID:            aws.ToString(s.VpcId),
			Public:           aws.ToBool(s.MapPublicIpOnLaunch),
		})
	}

	// Sort by AZ then by name
	sort.Slice(subnets, func(i, j int) bool {
		if subnets[i].AvailabilityZone != subnets[j].AvailabilityZone {
			return subnets[i].AvailabilityZone < subnets[j].AvailabilityZone
		}
		return subnets[i].Name < subnets[j].Name
	})

	setCache(cacheKey, subnets)
	writeJSON(w, subnets)
}

// awsSecurityGroupsHandler lists security groups, optionally filtered by VPC.
// GET /api/aws/security-groups?region=us-east-1&vpc=vpc-123
func awsSecurityGroupsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	region := r.URL.Query().Get("region")
	vpcFilter := r.URL.Query().Get("vpc")
	cacheKey := fmt.Sprintf("sgs:%s:%s", region, vpcFilter)
	if cached, ok := getCached(cacheKey); ok {
		writeJSON(w, cached)
		return
	}

	client, err := getEC2Client(region)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	input := &ec2.DescribeSecurityGroupsInput{}
	if vpcFilter != "" {
		input.Filters = []ec2types.Filter{
			{Name: aws.String("vpc-id"), Values: []string{vpcFilter}},
		}
	}

	result, err := client.DescribeSecurityGroups(context.Background(), input)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("Failed to list security groups: %v", err))
		return
	}

	sgs := make([]AWSSecurityGroup, 0, len(result.SecurityGroups))
	for _, sg := range result.SecurityGroups {
		sgs = append(sgs, AWSSecurityGroup{
			ID:          aws.ToString(sg.GroupId),
			Name:        aws.ToString(sg.GroupName),
			Description: aws.ToString(sg.Description),
			VpcID:       aws.ToString(sg.VpcId),
		})
	}

	sort.Slice(sgs, func(i, j int) bool {
		return sgs[i].Name < sgs[j].Name
	})

	setCache(cacheKey, sgs)
	writeJSON(w, sgs)
}

// awsKeyPairsHandler lists EC2 key pairs.
// GET /api/aws/key-pairs?region=us-east-1
func awsKeyPairsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	region := r.URL.Query().Get("region")
	cacheKey := fmt.Sprintf("keypairs:%s", region)
	if cached, ok := getCached(cacheKey); ok {
		writeJSON(w, cached)
		return
	}

	client, err := getEC2Client(region)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	result, err := client.DescribeKeyPairs(context.Background(), &ec2.DescribeKeyPairsInput{})
	if err != nil {
		writeError(w, 500, fmt.Sprintf("Failed to list key pairs: %v", err))
		return
	}

	keys := make([]AWSKeyPair, 0, len(result.KeyPairs))
	for _, k := range result.KeyPairs {
		keyType := "rsa"
		if k.KeyType == ec2types.KeyTypeEd25519 {
			keyType = "ed25519"
		}
		keys = append(keys, AWSKeyPair{
			Name: aws.ToString(k.KeyName),
			Type: keyType,
		})
	}

	sort.Slice(keys, func(i, j int) bool {
		return keys[i].Name < keys[j].Name
	})

	setCache(cacheKey, keys)
	writeJSON(w, keys)
}

// awsAmisHandler lists popular AMIs (Amazon Linux, Ubuntu).
// GET /api/aws/amis?region=us-east-1
func awsAmisHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	region := r.URL.Query().Get("region")
	cacheKey := fmt.Sprintf("amis:%s", region)
	if cached, ok := getCached(cacheKey); ok {
		writeJSON(w, cached)
		return
	}

	client, err := getEC2Client(region)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	// Fetch Amazon Linux 2023 and Ubuntu 24.04 AMIs
	input := &ec2.DescribeImagesInput{
		Owners: []string{"amazon", "099720109477"}, // Amazon + Canonical (Ubuntu)
		Filters: []ec2types.Filter{
			{Name: aws.String("state"), Values: []string{"available"}},
			{Name: aws.String("architecture"), Values: []string{"x86_64", "arm64"}},
			{Name: aws.String("virtualization-type"), Values: []string{"hvm"}},
			{Name: aws.String("root-device-type"), Values: []string{"ebs"}},
		},
	}

	result, err := client.DescribeImages(context.Background(), input)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("Failed to list AMIs: %v", err))
		return
	}

	// Filter for popular/recent AMIs only
	amis := make([]AWSAMI, 0)
	for _, img := range result.Images {
		name := aws.ToString(img.Name)
		desc := aws.ToString(img.Description)

		// Only include popular AMI patterns
		isAmazonLinux := strings.Contains(name, "al2023-ami-") && !strings.Contains(name, "minimal")
		isUbuntu := strings.Contains(name, "ubuntu/images/hvm-ssd") && (strings.Contains(name, "24.04") || strings.Contains(name, "22.04"))

		if !isAmazonLinux && !isUbuntu {
			continue
		}

		arch := "x86_64"
		if img.Architecture == ec2types.ArchitectureValuesArm64 {
			arch = "arm64"
		}

		// Build a friendly description
		friendlyDesc := desc
		if friendlyDesc == "" {
			friendlyDesc = name
		}
		if len(friendlyDesc) > 80 {
			friendlyDesc = friendlyDesc[:80] + "..."
		}

		amis = append(amis, AWSAMI{
			ID:           aws.ToString(img.ImageId),
			Name:         name,
			Description:  friendlyDesc,
			Architecture: arch,
		})
	}

	// Sort by name descending (newest first since AMI names contain dates)
	sort.Slice(amis, func(i, j int) bool {
		return amis[i].Name > amis[j].Name
	})

	// Limit to top 30 most recent
	if len(amis) > 30 {
		amis = amis[:30]
	}

	setCache(cacheKey, amis)
	writeJSON(w, amis)
}
