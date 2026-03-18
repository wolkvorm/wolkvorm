package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

var db *sqlx.DB

// DBRecord represents a row in the executions table.
type DBRecord struct {
	ID         string `db:"id" json:"id"`
	SchemaID   string `db:"schema_id" json:"schema_id"`
	SchemaName string `db:"schema_name" json:"schema_name"`
	Action     string `db:"action" json:"action"`
	Env        string `db:"env" json:"env"`
	Region     string `db:"region" json:"region"`
	InputsJSON string `db:"inputs_json" json:"-"`
	Status     string `db:"status" json:"status"`
	Logs       string `db:"logs" json:"logs"`
	CreatedAt  string `db:"created_at" json:"created_at"`
	Duration   string `db:"duration" json:"duration"`
}

func initDB() {
	dataDir := os.Getenv("WOLKVORM_DATA_DIR")
	if dataDir == "" {
		dataDir = "."
	}
	os.MkdirAll(dataDir, 0755)

	dbPath := filepath.Join(dataDir, "wolkvorm.db")
	var err error
	db, err = sqlx.Open("sqlite", dbPath)
	if err != nil {
		fmt.Printf("Warning: Could not open database: %v\n", err)
		return
	}

	// Create tables
	schema := `
	CREATE TABLE IF NOT EXISTS executions (
		id TEXT PRIMARY KEY,
		schema_id TEXT NOT NULL,
		schema_name TEXT NOT NULL,
		action TEXT NOT NULL DEFAULT 'plan',
		env TEXT NOT NULL,
		region TEXT NOT NULL,
		inputs_json TEXT DEFAULT '{}',
		status TEXT NOT NULL DEFAULT 'running',
		logs TEXT DEFAULT '',
		created_at TEXT NOT NULL,
		duration TEXT DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_executions_schema ON executions(schema_id);
	CREATE INDEX IF NOT EXISTS idx_executions_created ON executions(created_at DESC);

	CREATE TABLE IF NOT EXISTS resources (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		schema_id TEXT NOT NULL,
		schema_name TEXT NOT NULL,
		env TEXT NOT NULL,
		region TEXT NOT NULL,
		inputs_json TEXT DEFAULT '{}',
		state_key TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'active',
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		last_apply_id TEXT DEFAULT '',
		outputs_json TEXT DEFAULT '{}'
	);
	CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
	CREATE INDEX IF NOT EXISTS idx_resources_schema ON resources(schema_id);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id TEXT PRIMARY KEY,
		action TEXT NOT NULL,
		entity_type TEXT NOT NULL DEFAULT '',
		entity_id TEXT NOT NULL DEFAULT '',
		details TEXT DEFAULT '{}',
		ip_address TEXT DEFAULT '',
		user_identity TEXT DEFAULT '',
		created_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

	CREATE TABLE IF NOT EXISTS cost_records (
		id TEXT PRIMARY KEY,
		resource_id TEXT DEFAULT '',
		schema_id TEXT NOT NULL,
		env TEXT NOT NULL,
		region TEXT NOT NULL,
		monthly_cost REAL NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'USD',
		breakdown_json TEXT DEFAULT '{}',
		recorded_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_cost_recorded ON cost_records(recorded_at DESC);

	CREATE TABLE IF NOT EXISTS budgets (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		scope TEXT NOT NULL DEFAULT 'global',
		scope_value TEXT DEFAULT '',
		monthly_limit REAL NOT NULL DEFAULT 0,
		alert_threshold REAL NOT NULL DEFAULT 80,
		created_at TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS aws_accounts (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		access_key_id_enc TEXT NOT NULL,
		secret_access_key_enc TEXT NOT NULL,
		default_region TEXT NOT NULL DEFAULT 'us-east-1',
		account_id TEXT DEFAULT '',
		is_default INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS api_keys (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		key_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'viewer',
		created_at TEXT NOT NULL,
		last_used_at TEXT DEFAULT '',
		is_active INTEGER NOT NULL DEFAULT 1
	);
	CREATE INDEX IF NOT EXISTS idx_apikeys_hash ON api_keys(key_hash);

	CREATE TABLE IF NOT EXISTS approvals (
		id TEXT PRIMARY KEY,
		execution_id TEXT DEFAULT '',
		resource_name TEXT NOT NULL,
		schema_id TEXT NOT NULL,
		action TEXT NOT NULL,
		requested_by TEXT DEFAULT '',
		status TEXT NOT NULL DEFAULT 'pending',
		reviewed_by TEXT DEFAULT '',
		review_note TEXT DEFAULT '',
		plan_output TEXT DEFAULT '',
		inputs_json TEXT DEFAULT '{}',
		env TEXT DEFAULT '',
		region TEXT DEFAULT '',
		created_at TEXT NOT NULL,
		reviewed_at TEXT DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

	CREATE TABLE IF NOT EXISTS policies (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT DEFAULT '',
		rego_content TEXT NOT NULL,
		severity TEXT NOT NULL DEFAULT 'warning',
		is_active INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS drift_checks (
		id TEXT PRIMARY KEY,
		resource_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'clean',
		diff_output TEXT DEFAULT '',
		checked_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_drift_resource ON drift_checks(resource_id);

	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		display_name TEXT NOT NULL DEFAULT '',
		role TEXT NOT NULL DEFAULT 'admin',
		must_change_password INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		last_login_at TEXT DEFAULT ''
	);
	CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

	CREATE TABLE IF NOT EXISTS password_resets (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		token TEXT NOT NULL,
		expires_at TEXT NOT NULL,
		used INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
	CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
	`

	if _, err := db.Exec(schema); err != nil {
		fmt.Printf("Warning: Could not create tables: %v\n", err)
		return
	}

	// Add outputs_json column if it doesn't exist (for existing databases)
	// This is done separately because ALTER TABLE ADD COLUMN IF NOT EXISTS is not supported by SQLite.
	// Instead, we just try to add it and ignore the error if it already exists.
	_, _ = db.Exec(`ALTER TABLE resources ADD COLUMN outputs_json TEXT DEFAULT '{}';`)

	// Clean up stale "running" records from previous server sessions
	cleanupStaleRecords()

	fmt.Printf("Database initialized at %s\n", dbPath)
}

// cleanupStaleRecords marks any "running" execution records as "interrupted"
// on server startup. These are from previous sessions where the server
// was restarted or crashed before the operation completed.
func cleanupStaleRecords() {
	if db == nil {
		return
	}

	result, err := db.Exec(`UPDATE executions SET status='interrupted', logs=logs || '\n--- Server restarted before operation completed ---' WHERE status='running'`)
	if err != nil {
		fmt.Printf("Warning: Could not clean up stale records: %v\n", err)
		return
	}
	affected, _ := result.RowsAffected()
	if affected > 0 {
		fmt.Printf("Cleaned up %d stale 'running' execution records\n", affected)

		// For interrupted apply records, try to create resource entries
		// so the user can at least see them in My Resources
		var rows []DBRecord
		err = db.Select(&rows, `SELECT * FROM executions WHERE status='interrupted' AND action='apply'`)
		if err != nil {
			return
		}
		for _, r := range rows {
			var inputs map[string]any
			json.Unmarshal([]byte(r.InputsJSON), &inputs)
			resourceName := getResourceName(r.SchemaID, inputs)
			stateKey := GenerateStateKey(r.SchemaID, resourceName, r.Env)

			// Only create if not already tracked
			if existing := dbGetResourceByStateKey(stateKey); existing == nil {
				resID := fmt.Sprintf("res-recovered-%d", time.Now().UnixNano())
				now := time.Now().Format("2006-01-02 15:04:05")
				dbInsertResource(ManagedResource{
					ID:          resID,
					Name:        resourceName,
					SchemaID:    r.SchemaID,
					SchemaName:  r.SchemaName,
					Env:         r.Env,
					Region:      r.Region,
					Inputs:      inputs,
					StateKey:    stateKey,
					Status:      "unknown",
					CreatedAt:   r.CreatedAt,
					UpdatedAt:   now,
					LastApplyID: r.ID,
				})
				fmt.Printf("Recovered resource '%s' from interrupted apply %s (status: unknown - verify in AWS)\n", resourceName, r.ID)
			}
		}
	}
}

// dbInsertRecord inserts a new execution record.
func dbInsertRecord(rec PlanRecord) {
	if db == nil {
		return
	}
	inputsJSON, _ := json.Marshal(rec.Inputs)
	_, err := db.Exec(`INSERT INTO executions (id, schema_id, schema_name, action, env, region, inputs_json, status, logs, created_at, duration)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		rec.ID, rec.SchemaID, rec.SchemaName, rec.Action, rec.Env, rec.Region,
		string(inputsJSON), rec.Status, rec.Logs, rec.CreatedAt, rec.Duration)
	if err != nil {
		fmt.Printf("DB insert error: %v\n", err)
	}
}

// dbUpdateRecord updates an execution record.
func dbUpdateRecord(id, status, logs, duration string) {
	if db == nil {
		return
	}
	_, err := db.Exec(`UPDATE executions SET status=?, logs=?, duration=? WHERE id=?`,
		status, logs, duration, id)
	if err != nil {
		fmt.Printf("DB update error: %v\n", err)
	}
}

// dbGetHistory returns execution history, optionally filtered by schema.
func dbGetHistory(schemaID string, limit int) []PlanRecord {
	if db == nil {
		return nil
	}

	var rows []DBRecord
	var err error

	if schemaID != "" {
		err = db.Select(&rows, `SELECT * FROM executions WHERE schema_id=? ORDER BY created_at DESC LIMIT ?`, schemaID, limit)
	} else {
		err = db.Select(&rows, `SELECT * FROM executions ORDER BY created_at DESC LIMIT ?`, limit)
	}

	if err != nil {
		fmt.Printf("DB query error: %v\n", err)
		return nil
	}

	var result []PlanRecord
	for _, r := range rows {
		var inputs map[string]any
		json.Unmarshal([]byte(r.InputsJSON), &inputs)
		result = append(result, PlanRecord{
			ID:         r.ID,
			SchemaID:   r.SchemaID,
			SchemaName: r.SchemaName,
			Action:     r.Action,
			Env:        r.Env,
			Region:     r.Region,
			Inputs:     inputs,
			Status:     r.Status,
			Logs:       r.Logs,
			CreatedAt:  r.CreatedAt,
			Duration:   r.Duration,
		})
	}
	return result
}

// dbGetRecord returns a single execution record.
func dbGetRecord(id string) *PlanRecord {
	if db == nil {
		return nil
	}

	var r DBRecord
	err := db.Get(&r, `SELECT * FROM executions WHERE id=?`, id)
	if err != nil {
		return nil
	}

	var inputs map[string]any
	json.Unmarshal([]byte(r.InputsJSON), &inputs)
	return &PlanRecord{
		ID:         r.ID,
		SchemaID:   r.SchemaID,
		SchemaName: r.SchemaName,
		Action:     r.Action,
		Env:        r.Env,
		Region:     r.Region,
		Inputs:     inputs,
		Status:     r.Status,
		Logs:       r.Logs,
		CreatedAt:  r.CreatedAt,
		Duration:   r.Duration,
	}
}

// ManagedResource represents a resource managed by Wolkvorm.
type ManagedResource struct {
	ID          string         `db:"id" json:"id"`
	Name        string         `db:"name" json:"name"`
	SchemaID    string         `db:"schema_id" json:"schema_id"`
	SchemaName  string         `db:"schema_name" json:"schema_name"`
	Env         string         `db:"env" json:"env"`
	Region      string         `db:"region" json:"region"`
	InputsJSON  string         `db:"inputs_json" json:"-"`
	Inputs      map[string]any `db:"-" json:"inputs,omitempty"`
	StateKey    string         `db:"state_key" json:"state_key"`
	Status      string         `db:"status" json:"status"` // active, destroying, destroyed, error
	CreatedAt   string         `db:"created_at" json:"created_at"`
	UpdatedAt   string         `db:"updated_at" json:"updated_at"`
	LastApplyID string         `db:"last_apply_id" json:"last_apply_id"`
	OutputsJSON string         `db:"outputs_json" json:"-"`
	Outputs     map[string]any `db:"-" json:"outputs,omitempty"`
}

// dbInsertResource inserts a new managed resource.
func dbInsertResource(res ManagedResource) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	inputsJSON, _ := json.Marshal(res.Inputs)
	_, err := db.Exec(`INSERT INTO resources (id, name, schema_id, schema_name, env, region, inputs_json, state_key, status, created_at, updated_at, last_apply_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		res.ID, res.Name, res.SchemaID, res.SchemaName, res.Env, res.Region,
		string(inputsJSON), res.StateKey, res.Status, res.CreatedAt, res.UpdatedAt, res.LastApplyID)
	if err != nil {
		fmt.Printf("DB resource insert error: %v\n", err)
	}
	return err
}

// dbUpdateResource updates a managed resource.
func dbUpdateResource(id string, inputs map[string]any, status string, lastApplyID string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	inputsJSON, _ := json.Marshal(inputs)
	now := fmt.Sprintf("%s", time.Now().Format("2006-01-02 15:04:05"))
	_, err := db.Exec(`UPDATE resources SET inputs_json=?, status=?, updated_at=?, last_apply_id=? WHERE id=?`,
		string(inputsJSON), status, now, lastApplyID, id)
	if err != nil {
		fmt.Printf("DB resource update error: %v\n", err)
	}
	return err
}

// dbUpdateResourceStatus updates only the status of a resource.
func dbUpdateResourceStatus(id string, status string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err := db.Exec(`UPDATE resources SET status=?, updated_at=? WHERE id=?`, status, now, id)
	return err
}

// dbUpdateResourceOutputs stores terraform outputs for a resource.
func dbUpdateResourceOutputs(id string, outputs map[string]any) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	outputsJSON, _ := json.Marshal(outputs)
	_, err := db.Exec(`UPDATE resources SET outputs_json=? WHERE id=?`, string(outputsJSON), id)
	if err != nil {
		fmt.Printf("DB resource outputs update error: %v\n", err)
	}
	return err
}

// dbGetResources returns all resources, optionally filtered by status.
func dbGetResources(includeDestroyed bool) []ManagedResource {
	if db == nil {
		return nil
	}

	var rows []ManagedResource
	var err error

	if includeDestroyed {
		err = db.Select(&rows, `SELECT * FROM resources ORDER BY created_at DESC`)
	} else {
		err = db.Select(&rows, `SELECT * FROM resources WHERE status != 'destroyed' ORDER BY created_at DESC`)
	}

	if err != nil {
		fmt.Printf("DB resources query error: %v\n", err)
		return nil
	}

	// Parse inputs JSON
	for i := range rows {
		var inputs map[string]any
		json.Unmarshal([]byte(rows[i].InputsJSON), &inputs)
		rows[i].Inputs = inputs
		
		var outputs map[string]any
		json.Unmarshal([]byte(rows[i].OutputsJSON), &outputs)
		rows[i].Outputs = outputs
	}

	return rows
}

// dbGetResource returns a single resource by ID.
func dbGetResource(id string) *ManagedResource {
	if db == nil {
		return nil
	}

	var r ManagedResource
	err := db.Get(&r, `SELECT * FROM resources WHERE id=?`, id)
	if err != nil {
		return nil
	}

	var inputs map[string]any
	json.Unmarshal([]byte(r.InputsJSON), &inputs)
	r.Inputs = inputs
	
	var outputs map[string]any
	json.Unmarshal([]byte(r.OutputsJSON), &outputs)
	r.Outputs = outputs
	
	return &r
}

// dbGetResourceByStateKey finds a resource by its state key.
func dbGetResourceByStateKey(stateKey string) *ManagedResource {
	if db == nil {
		return nil
	}

	var r ManagedResource
	err := db.Get(&r, `SELECT * FROM resources WHERE state_key=? AND status != 'destroyed'`, stateKey)
	if err != nil {
		return nil
	}

	var inputs map[string]any
	json.Unmarshal([]byte(r.InputsJSON), &inputs)
	r.Inputs = inputs

	var outputs map[string]any
	json.Unmarshal([]byte(r.OutputsJSON), &outputs)
	r.Outputs = outputs
	
	return &r
}

// ========== Audit Log Functions ==========

// AuditEntry represents a row in the audit_logs table.
type AuditEntry struct {
	ID           string `db:"id" json:"id"`
	Action       string `db:"action" json:"action"`
	EntityType   string `db:"entity_type" json:"entity_type"`
	EntityID     string `db:"entity_id" json:"entity_id"`
	Details      string `db:"details" json:"details"`
	IPAddress    string `db:"ip_address" json:"ip_address"`
	UserIdentity string `db:"user_identity" json:"user_identity"`
	CreatedAt    string `db:"created_at" json:"created_at"`
}

func dbInsertAudit(entry AuditEntry) {
	if db == nil {
		return
	}
	_, err := db.Exec(`INSERT INTO audit_logs (id, action, entity_type, entity_id, details, ip_address, user_identity, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		entry.ID, entry.Action, entry.EntityType, entry.EntityID, entry.Details, entry.IPAddress, entry.UserIdentity, entry.CreatedAt)
	if err != nil {
		fmt.Printf("Audit insert error: %v\n", err)
	}
}

func dbGetAuditLogs(action, entityType, search string, limit, offset int) ([]AuditEntry, int) {
	if db == nil {
		return nil, 0
	}
	query := "SELECT * FROM audit_logs WHERE 1=1"
	countQuery := "SELECT COUNT(*) FROM audit_logs WHERE 1=1"
	args := []any{}

	if action != "" {
		query += " AND action=?"
		countQuery += " AND action=?"
		args = append(args, action)
	}
	if entityType != "" {
		query += " AND entity_type=?"
		countQuery += " AND entity_type=?"
		args = append(args, entityType)
	}
	if search != "" {
		query += " AND (details LIKE ? OR entity_id LIKE ?)"
		countQuery += " AND (details LIKE ? OR entity_id LIKE ?)"
		s := "%" + search + "%"
		args = append(args, s, s)
	}

	var total int
	db.Get(&total, countQuery, args...)

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	var rows []AuditEntry
	db.Select(&rows, query, args...)
	return rows, total
}

// ========== Cost Records Functions ==========

type CostRecord struct {
	ID            string  `db:"id" json:"id"`
	ResourceID    string  `db:"resource_id" json:"resource_id"`
	SchemaID      string  `db:"schema_id" json:"schema_id"`
	Env           string  `db:"env" json:"env"`
	Region        string  `db:"region" json:"region"`
	MonthlyCost   float64 `db:"monthly_cost" json:"monthly_cost"`
	Currency      string  `db:"currency" json:"currency"`
	BreakdownJSON string  `db:"breakdown_json" json:"breakdown_json"`
	RecordedAt    string  `db:"recorded_at" json:"recorded_at"`
}

func dbInsertCostRecord(rec CostRecord) {
	if db == nil {
		return
	}
	_, err := db.Exec(`INSERT INTO cost_records (id, resource_id, schema_id, env, region, monthly_cost, currency, breakdown_json, recorded_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		rec.ID, rec.ResourceID, rec.SchemaID, rec.Env, rec.Region, rec.MonthlyCost, rec.Currency, rec.BreakdownJSON, rec.RecordedAt)
	if err != nil {
		fmt.Printf("Cost record insert error: %v\n", err)
	}
}

func dbGetCostRecords(days int) []CostRecord {
	if db == nil {
		return nil
	}
	var rows []CostRecord
	cutoff := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	db.Select(&rows, `SELECT * FROM cost_records WHERE recorded_at >= ? ORDER BY recorded_at DESC`, cutoff)
	return rows
}

// ========== Budget Functions ==========

type Budget struct {
	ID             string  `db:"id" json:"id"`
	Name           string  `db:"name" json:"name"`
	Scope          string  `db:"scope" json:"scope"`
	ScopeValue     string  `db:"scope_value" json:"scope_value"`
	MonthlyLimit   float64 `db:"monthly_limit" json:"monthly_limit"`
	AlertThreshold float64 `db:"alert_threshold" json:"alert_threshold"`
	CreatedAt      string  `db:"created_at" json:"created_at"`
}

func dbInsertBudget(b Budget) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`INSERT INTO budgets (id, name, scope, scope_value, monthly_limit, alert_threshold, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		b.ID, b.Name, b.Scope, b.ScopeValue, b.MonthlyLimit, b.AlertThreshold, b.CreatedAt)
	return err
}

func dbGetBudgets() []Budget {
	if db == nil {
		return nil
	}
	var rows []Budget
	db.Select(&rows, `SELECT * FROM budgets ORDER BY created_at DESC`)
	return rows
}

func dbDeleteBudget(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`DELETE FROM budgets WHERE id=?`, id)
	return err
}

// ========== AWS Accounts Functions ==========

type AWSAccount struct {
	ID                  string `db:"id" json:"id"`
	Name                string `db:"name" json:"name"`
	AccessKeyIDEnc      string `db:"access_key_id_enc" json:"-"`
	SecretAccessKeyEnc  string `db:"secret_access_key_enc" json:"-"`
	DefaultRegion       string `db:"default_region" json:"default_region"`
	AccountID           string `db:"account_id" json:"account_id"`
	IsDefault           int    `db:"is_default" json:"is_default"`
	CreatedAt           string `db:"created_at" json:"created_at"`
	// Non-DB fields for API responses
	KeyPreview string `db:"-" json:"key_preview,omitempty"`
}

func dbInsertAWSAccount(acc AWSAccount) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`INSERT INTO aws_accounts (id, name, access_key_id_enc, secret_access_key_enc, default_region, account_id, is_default, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		acc.ID, acc.Name, acc.AccessKeyIDEnc, acc.SecretAccessKeyEnc, acc.DefaultRegion, acc.AccountID, acc.IsDefault, acc.CreatedAt)
	return err
}

func dbGetAWSAccounts() []AWSAccount {
	if db == nil {
		return nil
	}
	var rows []AWSAccount
	db.Select(&rows, `SELECT * FROM aws_accounts ORDER BY is_default DESC, name ASC`)
	return rows
}

func dbGetAWSAccount(id string) *AWSAccount {
	if db == nil {
		return nil
	}
	var acc AWSAccount
	err := db.Get(&acc, `SELECT * FROM aws_accounts WHERE id=?`, id)
	if err != nil {
		return nil
	}
	return &acc
}

func dbUpdateAWSAccount(acc AWSAccount) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`UPDATE aws_accounts SET name=?, access_key_id_enc=?, secret_access_key_enc=?, default_region=?, account_id=? WHERE id=?`,
		acc.Name, acc.AccessKeyIDEnc, acc.SecretAccessKeyEnc, acc.DefaultRegion, acc.AccountID, acc.ID)
	return err
}

func dbDeleteAWSAccount(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`DELETE FROM aws_accounts WHERE id=?`, id)
	return err
}

func dbSetDefaultAWSAccount(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	db.Exec(`UPDATE aws_accounts SET is_default=0`)
	_, err := db.Exec(`UPDATE aws_accounts SET is_default=1 WHERE id=?`, id)
	return err
}

// ========== API Keys Functions ==========

type APIKey struct {
	ID         string `db:"id" json:"id"`
	Name       string `db:"name" json:"name"`
	KeyHash    string `db:"key_hash" json:"-"`
	Role       string `db:"role" json:"role"`
	CreatedAt  string `db:"created_at" json:"created_at"`
	LastUsedAt string `db:"last_used_at" json:"last_used_at"`
	IsActive   int    `db:"is_active" json:"is_active"`
}

func dbInsertAPIKey(key APIKey) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`INSERT INTO api_keys (id, name, key_hash, role, created_at, last_used_at, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		key.ID, key.Name, key.KeyHash, key.Role, key.CreatedAt, key.LastUsedAt, key.IsActive)
	return err
}

func dbGetAPIKeys() []APIKey {
	if db == nil {
		return nil
	}
	var rows []APIKey
	db.Select(&rows, `SELECT * FROM api_keys ORDER BY created_at DESC`)
	return rows
}

func dbGetAPIKeyByHash(hash string) *APIKey {
	if db == nil {
		return nil
	}
	var key APIKey
	err := db.Get(&key, `SELECT * FROM api_keys WHERE key_hash=? AND is_active=1`, hash)
	if err != nil {
		return nil
	}
	return &key
}

func dbDeleteAPIKey(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`UPDATE api_keys SET is_active=0 WHERE id=?`, id)
	return err
}

func dbUpdateAPIKeyLastUsed(id string) {
	if db == nil {
		return
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	db.Exec(`UPDATE api_keys SET last_used_at=? WHERE id=?`, now, id)
}

func dbHasAPIKeys() bool {
	if db == nil {
		return false
	}
	var count int
	db.Get(&count, `SELECT COUNT(*) FROM api_keys WHERE is_active=1`)
	return count > 0
}

// ========== Approvals Functions ==========

type Approval struct {
	ID           string `db:"id" json:"id"`
	ExecutionID  string `db:"execution_id" json:"execution_id"`
	ResourceName string `db:"resource_name" json:"resource_name"`
	SchemaID     string `db:"schema_id" json:"schema_id"`
	Action       string `db:"action" json:"action"`
	RequestedBy  string `db:"requested_by" json:"requested_by"`
	Status       string `db:"status" json:"status"`
	ReviewedBy   string `db:"reviewed_by" json:"reviewed_by"`
	ReviewNote   string `db:"review_note" json:"review_note"`
	PlanOutput   string `db:"plan_output" json:"plan_output"`
	InputsJSON   string `db:"inputs_json" json:"inputs_json"`
	Env          string `db:"env" json:"env"`
	Region       string `db:"region" json:"region"`
	CreatedAt    string `db:"created_at" json:"created_at"`
	ReviewedAt   string `db:"reviewed_at" json:"reviewed_at"`
}

func dbInsertApproval(a Approval) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`INSERT INTO approvals (id, execution_id, resource_name, schema_id, action, requested_by, status, reviewed_by, review_note, plan_output, inputs_json, env, region, created_at, reviewed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.ExecutionID, a.ResourceName, a.SchemaID, a.Action, a.RequestedBy, a.Status, a.ReviewedBy, a.ReviewNote, a.PlanOutput, a.InputsJSON, a.Env, a.Region, a.CreatedAt, a.ReviewedAt)
	return err
}

func dbGetApprovals(status string) []Approval {
	if db == nil {
		return nil
	}
	var rows []Approval
	if status != "" {
		db.Select(&rows, `SELECT * FROM approvals WHERE status=? ORDER BY created_at DESC`, status)
	} else {
		db.Select(&rows, `SELECT * FROM approvals ORDER BY created_at DESC LIMIT 100`)
	}
	return rows
}

func dbGetApproval(id string) *Approval {
	if db == nil {
		return nil
	}
	var a Approval
	err := db.Get(&a, `SELECT * FROM approvals WHERE id=?`, id)
	if err != nil {
		return nil
	}
	return &a
}

func dbUpdateApproval(id, status, reviewedBy, reviewNote string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err := db.Exec(`UPDATE approvals SET status=?, reviewed_by=?, review_note=?, reviewed_at=? WHERE id=?`,
		status, reviewedBy, reviewNote, now, id)
	return err
}

func dbGetPendingApprovalCount() int {
	if db == nil {
		return 0
	}
	var count int
	db.Get(&count, `SELECT COUNT(*) FROM approvals WHERE status='pending'`)
	return count
}

// ========== Policies Functions ==========

type Policy struct {
	ID          string `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
	RegoContent string `db:"rego_content" json:"rego_content"`
	Severity    string `db:"severity" json:"severity"`
	IsActive    int    `db:"is_active" json:"is_active"`
	CreatedAt   string `db:"created_at" json:"created_at"`
}

func dbInsertPolicy(p Policy) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`INSERT INTO policies (id, name, description, rego_content, severity, is_active, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.Description, p.RegoContent, p.Severity, p.IsActive, p.CreatedAt)
	return err
}

func dbGetPolicies() []Policy {
	if db == nil {
		return nil
	}
	var rows []Policy
	db.Select(&rows, `SELECT * FROM policies ORDER BY created_at DESC`)
	return rows
}

func dbGetActivePolicies() []Policy {
	if db == nil {
		return nil
	}
	var rows []Policy
	db.Select(&rows, `SELECT * FROM policies WHERE is_active=1`)
	return rows
}

func dbUpdatePolicy(p Policy) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`UPDATE policies SET name=?, description=?, rego_content=?, severity=?, is_active=? WHERE id=?`,
		p.Name, p.Description, p.RegoContent, p.Severity, p.IsActive, p.ID)
	return err
}

func dbDeletePolicy(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`DELETE FROM policies WHERE id=?`, id)
	return err
}

// ========== Drift Checks Functions ==========

type DriftCheck struct {
	ID         string `db:"id" json:"id"`
	ResourceID string `db:"resource_id" json:"resource_id"`
	Status     string `db:"status" json:"status"`
	DiffOutput string `db:"diff_output" json:"diff_output"`
	CheckedAt  string `db:"checked_at" json:"checked_at"`
}

func dbInsertDriftCheck(d DriftCheck) {
	if db == nil {
		return
	}
	db.Exec(`INSERT INTO drift_checks (id, resource_id, status, diff_output, checked_at)
		VALUES (?, ?, ?, ?, ?)`,
		d.ID, d.ResourceID, d.Status, d.DiffOutput, d.CheckedAt)
}

func dbGetLatestDriftChecks() []DriftCheck {
	if db == nil {
		return nil
	}
	var rows []DriftCheck
	db.Select(&rows, `SELECT d1.* FROM drift_checks d1 INNER JOIN (SELECT resource_id, MAX(checked_at) as max_checked FROM drift_checks GROUP BY resource_id) d2 ON d1.resource_id = d2.resource_id AND d1.checked_at = d2.max_checked ORDER BY d1.checked_at DESC`)
	return rows
}

func dbGetDriftChecksByResource(resourceID string) []DriftCheck {
	if db == nil {
		return nil
	}
	var rows []DriftCheck
	db.Select(&rows, `SELECT * FROM drift_checks WHERE resource_id=? ORDER BY checked_at DESC LIMIT 20`, resourceID)
	return rows
}

// ========== Users Functions ==========

// User represents a row in the users table.
type User struct {
	ID                 string `db:"id" json:"id"`
	Username           string `db:"username" json:"username"`
	PasswordHash       string `db:"password_hash" json:"-"`
	DisplayName        string `db:"display_name" json:"display_name"`
	Role               string `db:"role" json:"role"`
	MustChangePassword int    `db:"must_change_password" json:"must_change_password"`
	CreatedAt          string `db:"created_at" json:"created_at"`
	LastLoginAt        string `db:"last_login_at" json:"last_login_at"`
}

func dbInsertUser(u User) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`INSERT INTO users (id, username, password_hash, display_name, role, must_change_password, created_at, last_login_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.Username, u.PasswordHash, u.DisplayName, u.Role, u.MustChangePassword, u.CreatedAt, u.LastLoginAt)
	return err
}

func dbGetUserByUsername(username string) *User {
	if db == nil {
		return nil
	}
	var u User
	err := db.Get(&u, `SELECT * FROM users WHERE username=?`, username)
	if err != nil {
		return nil
	}
	return &u
}

func dbGetUserByID(id string) *User {
	if db == nil {
		return nil
	}
	var u User
	err := db.Get(&u, `SELECT * FROM users WHERE id=?`, id)
	if err != nil {
		return nil
	}
	return &u
}

func dbUpdateUserPassword(id, passwordHash string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?`, passwordHash, id)
	return err
}

func dbUpdateUserLastLogin(id string) {
	if db == nil {
		return
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	db.Exec(`UPDATE users SET last_login_at=? WHERE id=?`, now, id)
}

func dbGetUsers() []User {
	if db == nil {
		return nil
	}
	var rows []User
	db.Select(&rows, `SELECT * FROM users ORDER BY created_at ASC`)
	return rows
}

func dbDeleteUser(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`DELETE FROM users WHERE id=?`, id)
	return err
}

func dbUserCount() int {
	if db == nil {
		return 0
	}
	var count int
	db.Get(&count, `SELECT COUNT(*) FROM users`)
	return count
}

// dbGetStats returns execution statistics.
func dbGetStats() map[string]any {
	if db == nil {
		return nil
	}

	stats := map[string]any{}

	var total int
	db.Get(&total, `SELECT COUNT(*) FROM executions`)
	stats["total"] = total

	var success int
	db.Get(&success, `SELECT COUNT(*) FROM executions WHERE status='success'`)
	stats["success"] = success

	var errors int
	db.Get(&errors, `SELECT COUNT(*) FROM executions WHERE status='error'`)
	stats["errors"] = errors

	var plans int
	db.Get(&plans, `SELECT COUNT(*) FROM executions WHERE action='plan'`)
	stats["plans"] = plans

	var applies int
	db.Get(&applies, `SELECT COUNT(*) FROM executions WHERE action='apply'`)
	stats["applies"] = applies

	var destroys int
	db.Get(&destroys, `SELECT COUNT(*) FROM executions WHERE action='destroy'`)
	stats["destroys"] = destroys

	return stats
}

// ========== Password Reset Functions ==========

// PasswordReset represents a password reset request.
type PasswordReset struct {
	ID        string `db:"id" json:"id"`
	UserID    string `db:"user_id" json:"user_id"`
	Token     string `db:"token" json:"token"`
	ExpiresAt string `db:"expires_at" json:"expires_at"`
	Used      int    `db:"used" json:"used"`
	CreatedAt string `db:"created_at" json:"created_at"`
}

func dbInsertPasswordReset(pr PasswordReset) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	// Invalidate any existing unused reset tokens for this user
	db.Exec(`UPDATE password_resets SET used=1 WHERE user_id=? AND used=0`, pr.UserID)

	_, err := db.Exec(`INSERT INTO password_resets (id, user_id, token, expires_at, used, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		pr.ID, pr.UserID, pr.Token, pr.ExpiresAt, pr.Used, pr.CreatedAt)
	return err
}

func dbGetPasswordResetByToken(token string) *PasswordReset {
	if db == nil {
		return nil
	}
	var pr PasswordReset
	err := db.Get(&pr, `SELECT * FROM password_resets WHERE token=? AND used=0`, token)
	if err != nil {
		return nil
	}
	return &pr
}

func dbMarkPasswordResetUsed(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`UPDATE password_resets SET used=1 WHERE id=?`, id)
	return err
}

func dbGetPendingPasswordResets() []PasswordReset {
	if db == nil {
		return nil
	}
	var rows []PasswordReset
	db.Select(&rows, `SELECT * FROM password_resets WHERE used=0 ORDER BY created_at DESC`)
	return rows
}
