package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"strings"
)

// Role hierarchy: admin > operator > deployer > viewer
var roleLevel = map[string]int{
	"viewer":   1,
	"deployer": 2,
	"operator": 3,
	"admin":    4,
}

// contextKey is the type used for context keys in this package.
type contextKey string

const claimsContextKey contextKey = "claims"

// getClaimsFromContext retrieves JWT claims from the request context.
func getClaimsFromContext(r *http.Request) *JWTClaims {
	claims, _ := r.Context().Value(claimsContextKey).(*JWTClaims)
	return claims
}

// sessionAuthMiddleware checks for a valid JWT Bearer token.
// Public endpoints (login, health) should NOT be wrapped with this.
func sessionAuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCors(w)
		if r.Method == "OPTIONS" {
			return
		}

		// Check for Bearer token in Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			// Also check X-API-Key for backward compatibility
			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				apiKey = r.URL.Query().Get("api_key")
			}
			if apiKey != "" {
				// API key auth path
				hash := fmt.Sprintf("%x", sha256.Sum256([]byte(apiKey)))
				key := dbGetAPIKeyByHash(hash)
				if key != nil {
					go dbUpdateAPIKeyLastUsed(key.ID)
					r.Header.Set("X-API-Key-Name", key.Name)
					// Create synthetic claims for API key users
					claims := &JWTClaims{
						UserID:      "apikey-" + key.ID,
						Username:    key.Name,
						DisplayName: key.Name,
						Role:        key.Role,
					}
					ctx := context.WithValue(r.Context(), claimsContextKey, claims)
					next(w, r.WithContext(ctx))
					return
				}
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprint(w, `{"error":"Authentication required"}`)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := validateToken(tokenString)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprint(w, `{"error":"Invalid or expired token"}`)
			return
		}

		// Set user identity for audit logging
		r.Header.Set("X-API-Key-Name", claims.Username)

		// Store claims in context
		ctx := context.WithValue(r.Context(), claimsContextKey, claims)
		next(w, r.WithContext(ctx))
	}
}

// authWithRole wraps a handler with session auth AND role-based permission check.
// minRole is the minimum role required (e.g. "viewer", "deployer", "operator", "admin").
func authWithRole(handler http.HandlerFunc, minRole string) http.HandlerFunc {
	return sessionAuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		claims := getClaimsFromContext(r)
		required := roleLevel[minRole]
		actual := roleLevel[claims.Role]
		if actual < required {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(403)
			fmt.Fprint(w, `{"error":"Insufficient permissions"}`)
			return
		}
		handler(w, r)
	})
}

// authMiddleware checks the X-API-Key header for API key authentication.
// If no API keys exist in the system, all requests are allowed (backward compatible).
func authMiddleware(next http.HandlerFunc, requiredRole string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCors(w)
		if r.Method == "OPTIONS" {
			return
		}

		// If no API keys exist, skip auth entirely (backward compatible)
		if !dbHasAPIKeys() {
			next(w, r)
			return
		}

		apiKey := r.Header.Get("X-API-Key")
		if apiKey == "" {
			apiKey = r.URL.Query().Get("api_key")
		}

		if apiKey == "" {
			http.Error(w, `{"error":"API key required"}`, 401)
			return
		}

		// Hash the key and look it up
		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(apiKey)))
		key := dbGetAPIKeyByHash(hash)
		if key == nil {
			http.Error(w, `{"error":"Invalid API key"}`, 401)
			return
		}

		// Check role level
		required := roleLevel[requiredRole]
		actual := roleLevel[key.Role]
		if actual < required {
			http.Error(w, `{"error":"Insufficient permissions"}`, 403)
			return
		}

		// Update last used
		go dbUpdateAPIKeyLastUsed(key.ID)

		// Set user identity for audit logging
		r.Header.Set("X-API-Key-Name", key.Name)

		next(w, r)
	}
}
