package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret []byte

// validRoles are the acceptable role values.
var validRoles = map[string]bool{
	"viewer":   true,
	"deployer": true,
	"operator": true,
	"admin":    true,
}

// getPermissionsForRole returns a list of permission strings for a given role.
func getPermissionsForRole(role string) []string {
	level := roleLevel[role]
	perms := []string{}
	if level >= roleLevel["viewer"] {
		perms = append(perms, "view")
	}
	if level >= roleLevel["deployer"] {
		perms = append(perms, "plan", "apply", "destroy", "cost_estimate")
	}
	if level >= roleLevel["operator"] {
		perms = append(perms, "approve", "manage_policies", "import", "drift_check")
	}
	if level >= roleLevel["admin"] {
		perms = append(perms, "manage_settings", "manage_users", "manage_accounts", "manage_api_keys")
	}
	return perms
}

func initJWTSecret() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Derive from the encryption key so there's one less thing to configure
		secret = os.Getenv("WOLKVORM_SECRET_KEY")
	}
	if secret == "" {
		secret = "wolkvorm-jwt-secret-change-me"
	}
	jwtSecret = []byte(secret)
}

// setupStatusHandler handles GET /api/auth/setup-status
// Returns whether the app needs initial setup (no users exist).
func setupStatusHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{
		"needs_setup": dbUserCount() == 0,
	})
}

// setupHandler handles POST /api/auth/setup
// Creates the initial admin account. Only works when no users exist (fresh install).
func setupHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	// Only allow setup if no users exist
	if dbUserCount() > 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(403)
		json.NewEncoder(w).Encode(map[string]string{"error": "Setup already completed"})
		return
	}

	var req struct {
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON"}`, 400)
		return
	}

	if req.Username == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Username and password are required"})
		return
	}

	if len(req.Password) < 6 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Password must be at least 6 characters"})
		return
	}

	if req.DisplayName == "" {
		req.DisplayName = "Administrator"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"Could not hash password"}`, 500)
		return
	}

	user := User{
		ID:                 "user-admin",
		Username:           req.Username,
		PasswordHash:       string(hash),
		DisplayName:        req.DisplayName,
		Role:               "admin",
		MustChangePassword: 0,
		CreatedAt:          time.Now().Format("2006-01-02 15:04:05"),
	}

	if err := dbInsertUser(user); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not create admin user"})
		return
	}

	// Auto-login: generate token
	token, err := generateToken(&user)
	if err != nil {
		http.Error(w, `{"error":"Account created but could not generate token"}`, 500)
		return
	}

	logAudit("setup", "user", user.ID, map[string]any{"username": user.Username}, r)
	fmt.Printf("Initial admin user created via setup (username: %s)\n", user.Username)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"token": token,
		"user": map[string]any{
			"id":                   user.ID,
			"username":             user.Username,
			"display_name":         user.DisplayName,
			"role":                 user.Role,
			"must_change_password": false,
			"permissions":          getPermissionsForRole(user.Role),
		},
	})
}

// JWTClaims holds the claims for a JWT token.
type JWTClaims struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	jwt.RegisteredClaims
}

// generateToken creates a JWT token for a user.
func generateToken(user *User) (string, error) {
	claims := JWTClaims{
		UserID:      user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		Role:        user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "wolkvorm",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// validateToken parses and validates a JWT token.
func validateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

// loginHandler handles POST /api/auth/login
func loginHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON"}`, 400)
		return
	}

	if req.Username == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]string{"error": "Username and password are required"})
		return
	}

	user := dbGetUserByUsername(req.Username)
	if user == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid username or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid username or password"})
		return
	}

	token, err := generateToken(user)
	if err != nil {
		http.Error(w, `{"error":"Could not generate token"}`, 500)
		return
	}

	dbUpdateUserLastLogin(user.ID)
	logAudit("login", "user", user.ID, map[string]any{"username": user.Username}, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"token": token,
		"user": map[string]any{
			"id":                   user.ID,
			"username":             user.Username,
			"display_name":         user.DisplayName,
			"role":                 user.Role,
			"must_change_password": user.MustChangePassword == 1,
			"permissions":          getPermissionsForRole(user.Role),
		},
	})
}

// authMeHandler handles GET /api/auth/me
func authMeHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	claims := getClaimsFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"Not authenticated"}`, 401)
		return
	}

	// Fetch fresh user data
	user := dbGetUserByID(claims.UserID)
	if user == nil {
		http.Error(w, `{"error":"User not found"}`, 401)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"id":                   user.ID,
		"username":             user.Username,
		"display_name":         user.DisplayName,
		"role":                 user.Role,
		"must_change_password": user.MustChangePassword == 1,
		"permissions":          getPermissionsForRole(user.Role),
	})
}

// changePasswordHandler handles POST /api/auth/change-password
func changePasswordHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	claims := getClaimsFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"Not authenticated"}`, 401)
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON"}`, 400)
		return
	}

	if req.NewPassword == "" || len(req.NewPassword) < 6 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "New password must be at least 6 characters"})
		return
	}

	user := dbGetUserByID(claims.UserID)
	if user == nil {
		http.Error(w, `{"error":"User not found"}`, 401)
		return
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]string{"error": "Current password is incorrect"})
		return
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"Could not hash password"}`, 500)
		return
	}

	if err := dbUpdateUserPassword(user.ID, string(hash)); err != nil {
		http.Error(w, `{"error":"Could not update password"}`, 500)
		return
	}

	logAudit("password_change", "user", user.ID, map[string]any{"username": user.Username}, r)

	// Generate new token (since must_change_password is now false)
	user.MustChangePassword = 0
	newToken, _ := generateToken(user)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status": "ok",
		"token":  newToken,
		"user": map[string]any{
			"id":                   user.ID,
			"username":             user.Username,
			"display_name":         user.DisplayName,
			"role":                 user.Role,
			"must_change_password": false,
		},
	})
}

// usersListHandler handles GET/POST /api/auth/users (admin only)
func usersListHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	claims := getClaimsFromContext(r)
	if claims == nil || claims.Role != "admin" {
		http.Error(w, `{"error":"Admin access required"}`, 403)
		return
	}

	if r.Method == "GET" {
		users := dbGetUsers()
		if users == nil {
			users = []User{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(users)
		return
	}

	if r.Method == "POST" {
		var req struct {
			Username    string `json:"username"`
			Password    string `json:"password"`
			DisplayName string `json:"display_name"`
			Role        string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid JSON"}`, 400)
			return
		}
		if req.Username == "" || req.Password == "" {
			http.Error(w, `{"error":"Username and password are required"}`, 400)
			return
		}
		if req.Role == "" {
			req.Role = "viewer"
		}
		if !validRoles[req.Role] {
			http.Error(w, `{"error":"Invalid role. Must be one of: viewer, deployer, operator, admin"}`, 400)
			return
		}
		if req.DisplayName == "" {
			req.DisplayName = req.Username
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, `{"error":"Could not hash password"}`, 500)
			return
		}

		user := User{
			ID:                 fmt.Sprintf("user-%d", time.Now().UnixNano()),
			Username:           req.Username,
			PasswordHash:       string(hash),
			DisplayName:        req.DisplayName,
			Role:               req.Role,
			MustChangePassword: 1,
			CreatedAt:          time.Now().Format("2006-01-02 15:04:05"),
		}

		if err := dbInsertUser(user); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(409)
			json.NewEncoder(w).Encode(map[string]string{"error": "Username already exists"})
			return
		}

		logAudit("user_create", "user", user.ID, map[string]any{"username": req.Username, "role": req.Role}, r)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"id":           user.ID,
			"username":     user.Username,
			"display_name": user.DisplayName,
			"role":         user.Role,
		})
		return
	}

	http.Error(w, "Method not allowed", 405)
}

// userDeleteHandler handles DELETE /api/auth/users/{id}
func userDeleteHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "DELETE" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	claims := getClaimsFromContext(r)
	if claims == nil || claims.Role != "admin" {
		http.Error(w, `{"error":"Admin access required"}`, 403)
		return
	}

	id := r.URL.Path[len("/api/auth/users/"):]
	if id == "" {
		http.Error(w, `{"error":"Missing user ID"}`, 400)
		return
	}

	// Cannot delete yourself
	if id == claims.UserID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Cannot delete your own account"})
		return
	}

	if err := dbDeleteUser(id); err != nil {
		http.Error(w, `{"error":"Could not delete user"}`, 500)
		return
	}

	logAudit("user_delete", "user", id, nil, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// generateResetCode creates a random 6-digit numeric code.
func generateResetCode() string {
	code := ""
	for i := 0; i < 6; i++ {
		n, _ := rand.Int(rand.Reader, big.NewInt(10))
		code += fmt.Sprintf("%d", n.Int64())
	}
	return code
}

// forgotPasswordHandler handles POST /api/auth/forgot-password
// Generates a 6-digit reset code for the user. The code is shown to admins
// in the settings panel, or can be delivered via configured notifications.
func forgotPasswordHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON"}`, 400)
		return
	}

	if req.Username == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Username is required"})
		return
	}

	// Always return success to prevent user enumeration
	successResponse := map[string]string{
		"status":  "ok",
		"message": "If the username exists, a password reset code has been generated. Please contact your administrator to get the reset code.",
	}

	user := dbGetUserByUsername(req.Username)
	if user == nil {
		// Don't reveal that the user doesn't exist
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(successResponse)
		return
	}

	// Generate a 6-digit reset code
	resetCode := generateResetCode()
	now := time.Now()

	pr := PasswordReset{
		ID:        fmt.Sprintf("pr-%d", now.UnixNano()),
		UserID:    user.ID,
		Token:     resetCode,
		ExpiresAt: now.Add(1 * time.Hour).Format("2006-01-02 15:04:05"),
		Used:      0,
		CreatedAt: now.Format("2006-01-02 15:04:05"),
	}

	if err := dbInsertPasswordReset(pr); err != nil {
		fmt.Printf("Error creating password reset: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(successResponse)
		return
	}

	logAudit("password_reset_request", "user", user.ID, map[string]any{"username": user.Username}, r)

	// Send notification to admins if notifications are configured
	SendNotification("password_reset",
		"Password Reset Request",
		fmt.Sprintf("User '%s' has requested a password reset.", user.Username),
		map[string]string{
			"Username":   user.Username,
			"Reset Code": resetCode,
			"Expires":    "1 hour",
		})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(successResponse)
}

// resetPasswordHandler handles POST /api/auth/reset-password
// Validates the reset code and sets a new password.
func resetPasswordHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req struct {
		Username    string `json:"username"`
		ResetCode   string `json:"reset_code"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON"}`, 400)
		return
	}

	if req.Username == "" || req.ResetCode == "" || req.NewPassword == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Username, reset code, and new password are required"})
		return
	}

	if len(req.NewPassword) < 6 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Password must be at least 6 characters"})
		return
	}

	// Find the reset token
	pr := dbGetPasswordResetByToken(req.ResetCode)
	if pr == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid or expired reset code"})
		return
	}

	// Check expiry
	expiresAt, err := time.Parse("2006-01-02 15:04:05", pr.ExpiresAt)
	if err != nil || time.Now().After(expiresAt) {
		dbMarkPasswordResetUsed(pr.ID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Reset code has expired. Please request a new one."})
		return
	}

	// Verify the username matches the reset token's user
	user := dbGetUserByID(pr.UserID)
	if user == nil || user.Username != req.Username {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid or expired reset code"})
		return
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"Could not hash password"}`, 500)
		return
	}

	// Update password
	if err := dbUpdateUserPassword(user.ID, string(hash)); err != nil {
		http.Error(w, `{"error":"Could not update password"}`, 500)
		return
	}

	// Mark reset token as used
	dbMarkPasswordResetUsed(pr.ID)

	logAudit("password_reset_complete", "user", user.ID, map[string]any{"username": user.Username}, r)

	// Generate a token so the user is logged in immediately
	user.MustChangePassword = 0
	token, _ := generateToken(user)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status": "ok",
		"token":  token,
		"user": map[string]any{
			"id":           user.ID,
			"username":     user.Username,
			"display_name": user.DisplayName,
			"role":         user.Role,
			"permissions":  getPermissionsForRole(user.Role),
		},
	})
}

// adminResetPasswordHandler handles POST /api/auth/admin-reset-password
// Allows admin to generate a reset code for a user, or directly reset their password.
func adminResetPasswordHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		// Return pending reset requests
		resets := dbGetPendingPasswordResets()
		type resetInfo struct {
			ID        string `json:"id"`
			Username  string `json:"username"`
			Token     string `json:"token"`
			ExpiresAt string `json:"expires_at"`
			CreatedAt string `json:"created_at"`
		}
		var result []resetInfo
		for _, pr := range resets {
			// Check expiry
			expiresAt, err := time.Parse("2006-01-02 15:04:05", pr.ExpiresAt)
			if err != nil || time.Now().After(expiresAt) {
				continue
			}
			user := dbGetUserByID(pr.UserID)
			if user == nil {
				continue
			}
			result = append(result, resetInfo{
				ID:        pr.ID,
				Username:  user.Username,
				Token:     pr.Token,
				ExpiresAt: pr.ExpiresAt,
				CreatedAt: pr.CreatedAt,
			})
		}
		if result == nil {
			result = []resetInfo{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}

	if r.Method == "POST" {
		// Admin can generate a reset code for a user
		var req struct {
			UserID string `json:"user_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid JSON"}`, 400)
			return
		}

		user := dbGetUserByID(req.UserID)
		if user == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(404)
			json.NewEncoder(w).Encode(map[string]string{"error": "User not found"})
			return
		}

		resetCode := generateResetCode()
		now := time.Now()

		pr := PasswordReset{
			ID:        fmt.Sprintf("pr-%d", now.UnixNano()),
			UserID:    user.ID,
			Token:     resetCode,
			ExpiresAt: now.Add(1 * time.Hour).Format("2006-01-02 15:04:05"),
			Used:      0,
			CreatedAt: now.Format("2006-01-02 15:04:05"),
		}

		if err := dbInsertPasswordReset(pr); err != nil {
			http.Error(w, `{"error":"Could not create reset code"}`, 500)
			return
		}

		claims := getClaimsFromContext(r)
		adminName := ""
		if claims != nil {
			adminName = claims.Username
		}
		logAudit("admin_password_reset", "user", user.ID, map[string]any{
			"username": user.Username,
			"admin":    adminName,
		}, r)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":     "ok",
			"reset_code": resetCode,
			"expires_at": pr.ExpiresAt,
			"username":   user.Username,
		})
		return
	}

	http.Error(w, "Method not allowed", 405)
}
