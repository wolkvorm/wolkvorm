package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
)

// AWSCredentials holds AWS access credentials.
type AWSCredentials struct {
	AuthMethod      string `json:"auth_method"` // "access_key" or "iam_role"
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	DefaultRegion   string `json:"default_region"`
}

// GitHubAppConfig holds GitHub configuration.
// Supports two auth methods:
//   - PAT (Personal Access Token): simple, just a token
//   - GitHub App: requires AppID + PrivateKey (PEM)
type GitHubAppConfig struct {
	AuthMethod string `json:"auth_method"` // "pat" or "app"
	PAT        string `json:"pat"`         // Personal Access Token
	AppID      string `json:"app_id"`
	PrivateKey string `json:"private_key"` // PEM content
}

// DriftConfig holds drift detection settings.
type DriftConfig struct {
	Enabled       bool `json:"enabled"`
	IntervalHours int  `json:"interval_hours"`
}

// AppSettings holds all application credentials.
type AppSettings struct {
	AWS              AWSCredentials     `json:"aws"`
	GitHub           GitHubAppConfig    `json:"github"`
	InfracostKey     string             `json:"infracost_key"`
	StateBucket      string             `json:"state_bucket"`
	LockTable        string             `json:"lock_table"`
	StateRegion      string             `json:"state_region"`
	AccountID        string             `json:"account_id"`
	Notifications    NotificationConfig `json:"notifications"`
	DriftDetection   DriftConfig        `json:"drift_detection"`
	ApprovalRequired bool               `json:"approval_required"`
}

// SettingsStatus shows which credentials are configured (without revealing values).
type SettingsStatus struct {
	AWS       AWSSettingsStatus    `json:"aws"`
	GitHub    GitHubSettingsStatus `json:"github"`
	Infracost InfracostStatus      `json:"infracost"`
	State     StateBackendStatus   `json:"state"`
}

type StateBackendStatus struct {
	Configured bool   `json:"configured"`
	Bucket     string `json:"bucket"`
	LockTable  string `json:"lock_table"`
	Region     string `json:"region"`
}

type InfracostStatus struct {
	Configured bool   `json:"configured"`
	KeyPreview string `json:"key_preview"`
}

type AWSSettingsStatus struct {
	Configured    bool   `json:"configured"`
	AuthMethod    string `json:"auth_method"`
	DefaultRegion string `json:"default_region"`
	KeyPreview    string `json:"key_preview"` // e.g. "AKIA...XYZ"
}

type GitHubSettingsStatus struct {
	Configured   bool   `json:"configured"`
	AuthMethod   string `json:"auth_method"`
	AppID        string `json:"app_id"`
	TokenPreview string `json:"token_preview"`
}

var (
	appSettings   AppSettings
	settingsMu    sync.RWMutex
	settingsFile  = getSettingsFilePath()
	encryptionKey = getEncryptionKey()
)

func getSettingsFilePath() string {
	dataDir := os.Getenv("GRANDFORM_DATA_DIR")
	if dataDir != "" {
		return dataDir + "/grandform-settings.enc"
	}
	return "grandform-settings.enc"
}

func getEncryptionKey() []byte {
	key := os.Getenv("GRANDFORM_SECRET_KEY")
	if key == "" {
		key = "grandform-default-secret-key-change-me"
	}
	hash := sha256.Sum256([]byte(key))
	return hash[:]
}

// encrypt encrypts plaintext using AES-GCM.
func encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// decrypt decrypts ciphertext using AES-GCM.
func decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// saveSettings encrypts and saves settings to disk.
func saveSettings() error {
	settingsMu.RLock()
	data, err := json.Marshal(appSettings)
	settingsMu.RUnlock()
	if err != nil {
		return err
	}

	encrypted, err := encrypt(data)
	if err != nil {
		return err
	}

	return os.WriteFile(settingsFile, encrypted, 0600)
}

// loadSettings loads and decrypts settings from disk.
func loadSettings() {
	data, err := os.ReadFile(settingsFile)
	if err != nil {
		fmt.Println("No saved settings found, starting fresh")
		// Try loading from environment variables as fallback
		loadSettingsFromEnv()
		return
	}

	plaintext, err := decrypt(data)
	if err != nil {
		fmt.Println("Warning: could not decrypt settings file, starting fresh")
		loadSettingsFromEnv()
		return
	}

	settingsMu.Lock()
	defer settingsMu.Unlock()
	if err := json.Unmarshal(plaintext, &appSettings); err != nil {
		fmt.Println("Warning: could not parse settings, starting fresh")
		loadSettingsFromEnv()
		return
	}

	fmt.Println("Settings loaded from encrypted file")
}

// loadSettingsFromEnv loads settings from environment variables (backward compatibility).
func loadSettingsFromEnv() {
	settingsMu.Lock()
	defer settingsMu.Unlock()

	if key := os.Getenv("AWS_ACCESS_KEY_ID"); key != "" {
		appSettings.AWS.AccessKeyID = key
		appSettings.AWS.SecretAccessKey = os.Getenv("AWS_SECRET_ACCESS_KEY")
		appSettings.AWS.DefaultRegion = os.Getenv("AWS_DEFAULT_REGION")
	}

	if appID := os.Getenv("GITHUB_APP_ID"); appID != "" {
		appSettings.GitHub.AppID = appID
		if pemData, err := os.ReadFile("github-app.pem"); err == nil {
			appSettings.GitHub.PrivateKey = string(pemData)
		}
	}

	if key := os.Getenv("INFRACOST_API_KEY"); key != "" {
		appSettings.InfracostKey = key
	}
}

// GetAWSCredentials returns the current AWS credentials.
func GetAWSCredentials() AWSCredentials {
	settingsMu.RLock()
	defer settingsMu.RUnlock()
	return appSettings.AWS
}

// GetGitHubConfig returns the current GitHub App config.
func GetGitHubConfig() GitHubAppConfig {
	settingsMu.RLock()
	defer settingsMu.RUnlock()
	return appSettings.GitHub
}

// SetAWSCredentials updates AWS credentials and saves to disk.
func SetAWSCredentials(creds AWSCredentials) error {
	settingsMu.Lock()
	appSettings.AWS = creds
	settingsMu.Unlock()
	return saveSettings()
}

// SetGitHubConfig updates GitHub App config and saves to disk.
func SetGitHubConfig(config GitHubAppConfig) error {
	settingsMu.Lock()
	appSettings.GitHub = config
	settingsMu.Unlock()
	return saveSettings()
}

// GetSettingsStatus returns which settings are configured without revealing secrets.
func GetSettingsStatus() SettingsStatus {
	settingsMu.RLock()
	defer settingsMu.RUnlock()

	status := SettingsStatus{}

	// AWS status
	if appSettings.AWS.AuthMethod == "iam_role" {
		status.AWS.Configured = true
		status.AWS.AuthMethod = "iam_role"
		status.AWS.DefaultRegion = appSettings.AWS.DefaultRegion
	} else if appSettings.AWS.AccessKeyID != "" {
		status.AWS.Configured = true
		status.AWS.AuthMethod = "access_key"
		status.AWS.DefaultRegion = appSettings.AWS.DefaultRegion
		key := appSettings.AWS.AccessKeyID
		if len(key) > 8 {
			status.AWS.KeyPreview = key[:4] + "..." + key[len(key)-4:]
		} else {
			status.AWS.KeyPreview = "****"
		}
	}

	// GitHub status
	if appSettings.GitHub.PAT != "" {
		status.GitHub.Configured = true
		status.GitHub.AuthMethod = "pat"
		status.GitHub.TokenPreview = maskSecret(appSettings.GitHub.PAT)
	} else if appSettings.GitHub.AppID != "" && appSettings.GitHub.PrivateKey != "" {
		status.GitHub.Configured = true
		status.GitHub.AuthMethod = "app"
		status.GitHub.AppID = appSettings.GitHub.AppID
	}

	// Infracost status
	if appSettings.InfracostKey != "" {
		status.Infracost.Configured = true
		status.Infracost.KeyPreview = maskSecret(appSettings.InfracostKey)
	}

	// State backend status
	if appSettings.StateBucket != "" {
		status.State.Configured = true
		status.State.Bucket = appSettings.StateBucket
		status.State.LockTable = appSettings.LockTable
		status.State.Region = appSettings.StateRegion
	}

	return status
}

// GetInfracostKey returns the Infracost API key.
func GetInfracostKey() string {
	settingsMu.RLock()
	defer settingsMu.RUnlock()
	return appSettings.InfracostKey
}

// SetInfracostKey updates the Infracost API key and saves to disk.
func SetInfracostKey(key string) error {
	settingsMu.Lock()
	appSettings.InfracostKey = key
	settingsMu.Unlock()
	return saveSettings()
}

// SetStateBackend saves state backend configuration.
func SetStateBackend(info *StateBackendInfo) error {
	settingsMu.Lock()
	appSettings.StateBucket = info.Bucket
	appSettings.LockTable = info.LockTable
	appSettings.StateRegion = info.Region
	appSettings.AccountID = info.AccountID
	settingsMu.Unlock()
	return saveSettings()
}

// GetNotificationConfig returns the current notification config.
func GetNotificationConfig() *NotificationConfig {
	settingsMu.RLock()
	defer settingsMu.RUnlock()
	config := appSettings.Notifications
	return &config
}

// SetNotificationConfig updates notification config and saves.
func SetNotificationConfig(config NotificationConfig) error {
	settingsMu.Lock()
	appSettings.Notifications = config
	settingsMu.Unlock()
	return saveSettings()
}

// GetDriftConfig returns drift detection settings.
func GetDriftConfig() DriftConfig {
	settingsMu.RLock()
	defer settingsMu.RUnlock()
	return appSettings.DriftDetection
}

// SetDriftConfig updates drift detection settings.
func SetDriftConfig(config DriftConfig) error {
	settingsMu.Lock()
	appSettings.DriftDetection = config
	settingsMu.Unlock()
	return saveSettings()
}

// IsApprovalRequired returns whether approval workflow is enabled.
func IsApprovalRequired() bool {
	settingsMu.RLock()
	defer settingsMu.RUnlock()
	return appSettings.ApprovalRequired
}

// SetApprovalRequired toggles the approval workflow.
func SetApprovalRequired(required bool) error {
	settingsMu.Lock()
	appSettings.ApprovalRequired = required
	settingsMu.Unlock()
	return saveSettings()
}

// maskSecret returns a masked version of a secret string.
func maskSecret(s string) string {
	if len(s) <= 8 {
		return "****"
	}
	return s[:4] + "..." + s[len(s)-4:]
}
