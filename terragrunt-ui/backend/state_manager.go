package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	dynamotypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

// StateBackendInfo holds information about the remote state backend.
type StateBackendInfo struct {
	Bucket    string `json:"bucket"`
	LockTable string `json:"lock_table"`
	Region    string `json:"region"`
	AccountID string `json:"account_id"`
	Ready     bool   `json:"ready"`
}

// getAWSConfig creates an AWS SDK config from stored credentials.
func getAWSConfig(region string) (aws.Config, error) {
	creds := GetAWSCredentials()

	if region == "" {
		region = creds.DefaultRegion
	}
	if region == "" {
		region = "us-east-1"
	}

	if creds.AuthMethod == "iam_role" {
		// IAM Role mode: use default credential chain (EC2 instance profile, env vars, etc.)
		cfg, err := config.LoadDefaultConfig(context.Background(),
			config.WithRegion(region),
		)
		if err != nil {
			return aws.Config{}, fmt.Errorf("failed to load AWS config (IAM Role): %w", err)
		}
		return cfg, nil
	}

	// Access Key mode: use explicit credentials
	if creds.AccessKeyID == "" {
		return aws.Config{}, fmt.Errorf("AWS credentials not configured")
	}

	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			creds.AccessKeyID,
			creds.SecretAccessKey,
			"",
		)),
	)
	if err != nil {
		return aws.Config{}, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return cfg, nil
}

// getAccountID retrieves the AWS account ID using STS.
func getAccountID(cfg aws.Config) (string, error) {
	stsClient := sts.NewFromConfig(cfg)
	result, err := stsClient.GetCallerIdentity(context.Background(), &sts.GetCallerIdentityInput{})
	if err != nil {
		return "", fmt.Errorf("failed to get account ID: %w", err)
	}
	return *result.Account, nil
}

// EnsureStateBucket creates the state S3 bucket and DynamoDB lock table if they don't exist.
func EnsureStateBucket(region string) (*StateBackendInfo, error) {
	cfg, err := getAWSConfig(region)
	if err != nil {
		return nil, err
	}

	accountID, err := getAccountID(cfg)
	if err != nil {
		return nil, err
	}

	bucketName := fmt.Sprintf("grandform-state-%s", accountID)
	lockTable := "grandform-locks"

	// Check/create S3 bucket
	s3Client := s3.NewFromConfig(cfg)

	_, err = s3Client.HeadBucket(context.Background(), &s3.HeadBucketInput{
		Bucket: aws.String(bucketName),
	})

	if err != nil {
		// Bucket doesn't exist, create it
		fmt.Printf("Creating state bucket: %s in %s\n", bucketName, region)

		createInput := &s3.CreateBucketInput{
			Bucket: aws.String(bucketName),
		}

		// Only add LocationConstraint for non-us-east-1 regions
		if region != "us-east-1" {
			createInput.CreateBucketConfiguration = &s3types.CreateBucketConfiguration{
				LocationConstraint: s3types.BucketLocationConstraint(region),
			}
		}

		_, err = s3Client.CreateBucket(context.Background(), createInput)
		if err != nil && !strings.Contains(err.Error(), "BucketAlreadyOwnedByYou") {
			return nil, fmt.Errorf("failed to create state bucket: %w", err)
		}

		// Enable versioning
		_, err = s3Client.PutBucketVersioning(context.Background(), &s3.PutBucketVersioningInput{
			Bucket: aws.String(bucketName),
			VersioningConfiguration: &s3types.VersioningConfiguration{
				Status: s3types.BucketVersioningStatusEnabled,
			},
		})
		if err != nil {
			fmt.Printf("Warning: could not enable versioning on state bucket: %v\n", err)
		}

		// Enable server-side encryption
		_, err = s3Client.PutBucketEncryption(context.Background(), &s3.PutBucketEncryptionInput{
			Bucket: aws.String(bucketName),
			ServerSideEncryptionConfiguration: &s3types.ServerSideEncryptionConfiguration{
				Rules: []s3types.ServerSideEncryptionRule{
					{
						ApplyServerSideEncryptionByDefault: &s3types.ServerSideEncryptionByDefault{
							SSEAlgorithm: s3types.ServerSideEncryptionAes256,
						},
					},
				},
			},
		})
		if err != nil {
			fmt.Printf("Warning: could not enable encryption on state bucket: %v\n", err)
		}

		// Block public access
		_, err = s3Client.PutPublicAccessBlock(context.Background(), &s3.PutPublicAccessBlockInput{
			Bucket: aws.String(bucketName),
			PublicAccessBlockConfiguration: &s3types.PublicAccessBlockConfiguration{
				BlockPublicAcls:       aws.Bool(true),
				BlockPublicPolicy:     aws.Bool(true),
				IgnorePublicAcls:      aws.Bool(true),
				RestrictPublicBuckets: aws.Bool(true),
			},
		})
		if err != nil {
			fmt.Printf("Warning: could not block public access on state bucket: %v\n", err)
		}

		fmt.Printf("State bucket created: %s\n", bucketName)
	} else {
		fmt.Printf("State bucket already exists: %s\n", bucketName)
	}

	// Check/create DynamoDB lock table
	ddbClient := dynamodb.NewFromConfig(cfg)

	_, err = ddbClient.DescribeTable(context.Background(), &dynamodb.DescribeTableInput{
		TableName: aws.String(lockTable),
	})

	if err != nil {
		fmt.Printf("Creating lock table: %s\n", lockTable)
		_, err = ddbClient.CreateTable(context.Background(), &dynamodb.CreateTableInput{
			TableName: aws.String(lockTable),
			KeySchema: []dynamotypes.KeySchemaElement{
				{
					AttributeName: aws.String("LockID"),
					KeyType:       dynamotypes.KeyTypeHash,
				},
			},
			AttributeDefinitions: []dynamotypes.AttributeDefinition{
				{
					AttributeName: aws.String("LockID"),
					AttributeType: dynamotypes.ScalarAttributeTypeS,
				},
			},
			BillingMode: dynamotypes.BillingModePayPerRequest,
		})
		if err != nil && !strings.Contains(err.Error(), "ResourceInUseException") {
			return nil, fmt.Errorf("failed to create lock table: %w", err)
		}
		fmt.Printf("Lock table created: %s\n", lockTable)
	} else {
		fmt.Printf("Lock table already exists: %s\n", lockTable)
	}

	info := &StateBackendInfo{
		Bucket:    bucketName,
		LockTable: lockTable,
		Region:    region,
		AccountID: accountID,
		Ready:     true,
	}

	// Save to settings
	SetStateBackend(info)

	return info, nil
}

// GetStateBackendInfo returns the current state backend configuration.
func GetStateBackendInfo() *StateBackendInfo {
	settingsMu.RLock()
	defer settingsMu.RUnlock()

	if appSettings.StateBucket == "" {
		return nil
	}

	return &StateBackendInfo{
		Bucket:    appSettings.StateBucket,
		LockTable: appSettings.LockTable,
		Region:    appSettings.StateRegion,
		AccountID: appSettings.AccountID,
		Ready:     true,
	}
}
