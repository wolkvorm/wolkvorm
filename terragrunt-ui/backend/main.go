package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

func enableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
}

// auth is a shorthand for wrapping a handler with session auth middleware.
func auth(handler http.HandlerFunc) http.HandlerFunc {
	return sessionAuthMiddleware(handler)
}

func main() {
	// Initialize database
	initDB()

	// Initialize JWT secret
	initJWTSecret()

	// Load settings (credentials) from encrypted file or env
	loadSettings()

	// Check if fresh install
	if dbUserCount() == 0 {
		fmt.Println("Fresh install detected — visit the app to complete setup")
	}

	// Load schemas on startup
	schemas := getSchemas()
	fmt.Printf("Loaded %d resource schemas\n", len(schemas))

	// Start drift scheduler if enabled
	driftConfig := GetDriftConfig()
	if driftConfig.Enabled && driftConfig.IntervalHours > 0 {
		StartDriftScheduler(driftConfig.IntervalHours)
	}

	// === Public endpoints (no auth required) ===
	http.HandleFunc("/api/auth/login", loginHandler)
	http.HandleFunc("/api/auth/forgot-password", forgotPasswordHandler)
	http.HandleFunc("/api/auth/reset-password", resetPasswordHandler)
	http.HandleFunc("/api/auth/setup-status", setupStatusHandler)
	http.HandleFunc("/api/auth/setup", setupHandler)

	// Health check (for Kubernetes liveness/readiness probes)
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		enableCors(w)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// === Authenticated endpoints ===
	// Shorthand aliases for role-based auth
	viewer := func(h http.HandlerFunc) http.HandlerFunc { return authWithRole(h, "viewer") }
	deployer := func(h http.HandlerFunc) http.HandlerFunc { return authWithRole(h, "deployer") }
	operator := func(h http.HandlerFunc) http.HandlerFunc { return authWithRole(h, "operator") }
	admin := func(h http.HandlerFunc) http.HandlerFunc { return authWithRole(h, "admin") }

	// Auth endpoints (any authenticated user)
	http.HandleFunc("/api/auth/me", auth(authMeHandler))
	http.HandleFunc("/api/auth/change-password", auth(changePasswordHandler))
	http.HandleFunc("/api/auth/users/", admin(userDeleteHandler))
	http.HandleFunc("/api/auth/users", admin(usersListHandler))
	http.HandleFunc("/api/auth/admin-reset-password", admin(adminResetPasswordHandler))

	// Schema endpoints (viewer+)
	http.HandleFunc("/api/schemas/", viewer(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/schemas/" {
			schemasListHandler(w, r)
		} else {
			schemaDetailHandler(w, r)
		}
	}))
	http.HandleFunc("/api/schemas", viewer(schemasListHandler))

	// Plan, Apply & Destroy endpoints (deployer+)
	http.HandleFunc("/api/plan", deployer(planHandler))
	http.HandleFunc("/api/apply", deployer(applyHandler))
	http.HandleFunc("/api/destroy", deployer(destroyHandler))
	http.HandleFunc("/api/plan/logs", viewer(logsHandler))

	// WebSocket endpoint for real-time log streaming (auth via query param)
	http.HandleFunc("/api/ws/run", wsRunHandler)
	http.HandleFunc("/api/plan/history/", viewer(planDetailHandler))
	http.HandleFunc("/api/plan/history", viewer(planHistoryHandler))

	// GitHub endpoints (deployer+)
	http.HandleFunc("/api/github/repos", deployer(githubReposHandler))
	http.HandleFunc("/api/github/branch-sha", deployer(githubBranchSHAHandler))
	http.HandleFunc("/api/github/create-branch", deployer(githubCreateBranchHandler))
	http.HandleFunc("/api/github/commit-file", deployer(githubCommitFileHandler))
	http.HandleFunc("/api/github/create-pr", deployer(githubCreatePRHandler))

	// Managed resources endpoints (viewer+)
	http.HandleFunc("/api/resources/", viewer(resourceDetailHandler))
	http.HandleFunc("/api/resources", viewer(resourcesListHandler))

	// State backend endpoints (admin only)
	http.HandleFunc("/api/state/init", admin(stateInitHandler))
	http.HandleFunc("/api/state", viewer(stateStatusHandler))

	// Stats endpoint (viewer+)
	http.HandleFunc("/api/stats", viewer(statsHandler))

	// Cost estimation endpoint (deployer+)
	http.HandleFunc("/api/cost-estimate", deployer(costEstimateHandler))

	// AWS resource lookup endpoints (viewer+)
	http.HandleFunc("/api/aws/vpcs", viewer(awsVpcsHandler))
	http.HandleFunc("/api/aws/subnets", viewer(awsSubnetsHandler))
	http.HandleFunc("/api/aws/security-groups", viewer(awsSecurityGroupsHandler))
	http.HandleFunc("/api/aws/key-pairs", viewer(awsKeyPairsHandler))
	http.HandleFunc("/api/aws/amis", viewer(awsAmisHandler))

	// Settings endpoints (admin only)
	http.HandleFunc("/api/settings", viewer(settingsStatusHandler))
	http.HandleFunc("/api/settings/aws", admin(awsSettingsHandler))
	http.HandleFunc("/api/settings/github", admin(githubSettingsHandler))
	http.HandleFunc("/api/settings/infracost", admin(infracostSettingsHandler))
	http.HandleFunc("/api/settings/notifications", admin(notificationsSettingsHandler))
	http.HandleFunc("/api/settings/notifications/test", admin(notificationsTestHandler))
	http.HandleFunc("/api/settings/drift", admin(driftSettingsHandler))
	http.HandleFunc("/api/settings/approval", admin(approvalSettingsHandler))

	// Audit Log (viewer+)
	http.HandleFunc("/api/audit", viewer(auditListHandler))
	http.HandleFunc("/api/audit/export", viewer(auditExportHandler))

	// Cost Dashboard & Budgets (viewer+ read, admin write)
	http.HandleFunc("/api/costs/summary", viewer(costSummaryHandler))
	http.HandleFunc("/api/costs/trend", viewer(costTrendHandler))
	http.HandleFunc("/api/costs/resources", viewer(costResourcesHandler))
	http.HandleFunc("/api/budgets", viewer(budgetsHandler))

	// Multi-Account (admin only)
	http.HandleFunc("/api/accounts", admin(accountsHandler))
	http.HandleFunc("/api/accounts/", admin(accountDetailHandler))

	// API Keys (admin only)
	http.HandleFunc("/api/api-keys", admin(apiKeysHandler))
	http.HandleFunc("/api/api-keys/", admin(apiKeyDeleteHandler))

	// Approvals (viewer+ read, operator+ actions)
	http.HandleFunc("/api/approvals", viewer(approvalsHandler))
	http.HandleFunc("/api/approvals/", operator(approvalActionHandler))
	http.HandleFunc("/api/approvals/pending-count", viewer(approvalsPendingCountHandler))

	// Policies (viewer+ read, operator+ write)
	http.HandleFunc("/api/policies", viewer(policiesHandler))
	http.HandleFunc("/api/policies/", operator(policyDetailHandler))
	http.HandleFunc("/api/policies/validate", operator(policyValidateHandler))
	http.HandleFunc("/api/policies/templates", viewer(policyTemplatesHandler))

	// Drift Detection (viewer+ read, operator+ actions)
	http.HandleFunc("/api/drift", viewer(driftListHandler))
	http.HandleFunc("/api/drift/check-all", operator(driftCheckAllHandler))
	http.HandleFunc("/api/drift/", viewer(driftDetailHandler))

	// Resource Dependency Graph (viewer+)
	http.HandleFunc("/api/graph", viewer(graphHandler))

	// Import Existing Resources (operator+)
	http.HandleFunc("/api/import/scan", operator(importScanHandler))
	http.HandleFunc("/api/import/execute", operator(importExecuteHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Printf("TerraForge server running on :%s (mode: %s)\n", port, getExecutionMode())
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

// approvalSettingsHandler handles GET/POST for approval workflow toggle.
func approvalSettingsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method == "GET" {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"required":%v}`, IsApprovalRequired())
		return
	}
	if r.Method == "POST" {
		var req struct {
			Required bool `json:"required"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		SetApprovalRequired(req.Required)
		logAudit("settings_change", "approval", "", map[string]any{"required": req.Required}, r)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
		return
	}
	http.Error(w, "Method not allowed", 405)
}
