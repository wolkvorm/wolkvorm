package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Request types for GitHub operations.

type CreateBranchRequest struct {
	Repo   string `json:"repo"`
	Branch string `json:"branch"`
	SHA    string `json:"sha"`
}

type CommitFileRequest struct {
	SchemaID string         `json:"schemaId"`
	Repo     string         `json:"repo"`
	Branch   string         `json:"branch"`
	Inputs   map[string]any `json:"inputs"`
	Env      string         `json:"env"`
}

type CreatePRRequest struct {
	SchemaID string `json:"schemaId"`
	Repo     string `json:"repo"`
	Branch   string `json:"branch"`
	Env      string `json:"env"`
}

// getGitHubToken returns a usable GitHub token.
// For PAT: returns the token directly.
// For GitHub App: generates JWT and fetches installation token.
func getGitHubToken(repoFull string) (string, error) {
	ghConfig := GetGitHubConfig()

	// PAT mode: just return the token
	if ghConfig.PAT != "" {
		return ghConfig.PAT, nil
	}

	// GitHub App mode: generate JWT -> installation token
	return getInstallationToken(repoFull, ghConfig)
}

// generateAppJWT creates a JWT token for GitHub App authentication.
func generateAppJWT(ghConfig GitHubAppConfig) (string, error) {
	var privateKeyBytes []byte
	var appID string

	if ghConfig.PrivateKey != "" {
		privateKeyBytes = []byte(ghConfig.PrivateKey)
		appID = ghConfig.AppID
	} else {
		var err error
		privateKeyBytes, err = os.ReadFile("github-app.pem")
		if err != nil {
			return "", fmt.Errorf("GitHub not configured. Go to Settings to add credentials")
		}
		appID = os.Getenv("GITHUB_APP_ID")
	}

	if appID == "" {
		return "", fmt.Errorf("GitHub App ID not configured")
	}

	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyBytes)
	if err != nil {
		return "", err
	}

	claims := jwt.MapClaims{
		"iat": time.Now().Unix() - 60,
		"exp": time.Now().Unix() + (10 * 60),
		"iss": appID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(privateKey)
}

// getInstallationToken fetches an installation access token for a specific repo (GitHub App mode).
func getInstallationToken(repoFull string, ghConfig GitHubAppConfig) (string, error) {
	jwtToken, err := generateAppJWT(ghConfig)
	if err != nil {
		return "", err
	}

	installURL := fmt.Sprintf("https://api.github.com/repos/%s/installation", repoFull)
	req, _ := http.NewRequest("GET", installURL, nil)
	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("installation lookup failed: %s", string(b))
	}

	var install struct {
		ID int `json:"id"`
	}
	json.NewDecoder(resp.Body).Decode(&install)

	tokenURL := fmt.Sprintf("https://api.github.com/app/installations/%d/access_tokens", install.ID)
	tokenReq, _ := http.NewRequest("POST", tokenURL, nil)
	tokenReq.Header.Set("Authorization", "Bearer "+jwtToken)
	tokenReq.Header.Set("Accept", "application/vnd.github+json")

	tokenResp, err := client.Do(tokenReq)
	if err != nil {
		return "", err
	}
	defer tokenResp.Body.Close()

	var tokenData struct {
		Token string `json:"token"`
	}
	json.NewDecoder(tokenResp.Body).Decode(&tokenData)

	return tokenData.Token, nil
}

// githubReposHandler lists repositories accessible to the configured GitHub auth.
// GET /api/github/repos
func githubReposHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	ghConfig := GetGitHubConfig()

	// PAT mode: fetch user's repos directly
	if ghConfig.PAT != "" {
		req, _ := http.NewRequest("GET", "https://api.github.com/user/repos?per_page=100&sort=updated", nil)
		req.Header.Set("Authorization", "Bearer "+ghConfig.PAT)
		req.Header.Set("Accept", "application/vnd.github+json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, "GitHub request failed", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		// PAT returns an array directly, wrap it to match App format
		var repos []map[string]any
		json.NewDecoder(resp.Body).Decode(&repos)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"repositories": repos,
		})
		return
	}

	// GitHub App mode: JWT -> installation -> repos
	jwtToken, err := generateAppJWT(ghConfig)
	if err != nil {
		http.Error(w, "GitHub not configured. Go to Settings.", http.StatusBadRequest)
		return
	}

	req, _ := http.NewRequest("GET", "https://api.github.com/app/installations", nil)
	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "GitHub request failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var installs []struct {
		ID int `json:"id"`
	}
	json.NewDecoder(resp.Body).Decode(&installs)

	if len(installs) == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"repositories":[]}`))
		return
	}

	tokenURL := fmt.Sprintf("https://api.github.com/app/installations/%d/access_tokens", installs[0].ID)
	tokenReq, _ := http.NewRequest("POST", tokenURL, nil)
	tokenReq.Header.Set("Authorization", "Bearer "+jwtToken)
	tokenReq.Header.Set("Accept", "application/vnd.github+json")

	tokenResp, err := client.Do(tokenReq)
	if err != nil {
		http.Error(w, "Token request failed", http.StatusInternalServerError)
		return
	}
	defer tokenResp.Body.Close()

	var tokenData struct {
		Token string `json:"token"`
	}
	json.NewDecoder(tokenResp.Body).Decode(&tokenData)

	reposReq, _ := http.NewRequest("GET", "https://api.github.com/installation/repositories", nil)
	reposReq.Header.Set("Authorization", "token "+tokenData.Token)
	reposReq.Header.Set("Accept", "application/vnd.github+json")

	reposResp, err := client.Do(reposReq)
	if err != nil {
		http.Error(w, "Repos request failed", http.StatusInternalServerError)
		return
	}
	defer reposResp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	io.Copy(w, reposResp.Body)
}

// githubBranchSHAHandler returns the main branch info including SHA.
// GET /api/github/branch-sha?repo=owner/repo
func githubBranchSHAHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	repo := r.URL.Query().Get("repo")
	if repo == "" {
		http.Error(w, "repo param required", http.StatusBadRequest)
		return
	}

	token, err := getGitHubToken(repo)
	if err != nil {
		http.Error(w, "GitHub not configured: "+err.Error(), http.StatusBadRequest)
		return
	}

	req, _ := http.NewRequest("GET", "https://api.github.com/repos/"+repo+"/branches/main", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "GitHub request failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	io.Copy(w, resp.Body)
}

// githubCreateBranchHandler creates a new branch from a given SHA.
// POST /api/github/create-branch
func githubCreateBranchHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	var data CreateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	token, err := getGitHubToken(data.Repo)
	if err != nil {
		http.Error(w, "GitHub not configured: "+err.Error(), http.StatusBadRequest)
		return
	}

	body := fmt.Sprintf(`{"ref":"refs/heads/%s","sha":"%s"}`, data.Branch, data.SHA)
	req, _ := http.NewRequest("POST", "https://api.github.com/repos/"+data.Repo+"/git/refs", bytes.NewBuffer([]byte(body)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "GitHub request failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "branch_created"})
}

// githubCommitFileHandler commits a generated main.tf to a branch.
// POST /api/github/commit-file
func githubCommitFileHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	var d CommitFileRequest
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Look up schema
	schema, ok := getSchema(d.SchemaID)
	if !ok {
		http.Error(w, "Unknown schema: "+d.SchemaID, http.StatusBadRequest)
		return
	}

	token, err := getGitHubToken(d.Repo)
	if err != nil {
		http.Error(w, "GitHub not configured: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Generate HCL from schema + inputs
	hcl := GenerateHCL(schema, d.Inputs, d.Env)
	content := base64.StdEncoding.EncodeToString([]byte(hcl))

	// Resolve file path from schema template
	filePath := ResolvePath(schema.PathTemplate, d.Inputs, d.Env)

	url := fmt.Sprintf("https://api.github.com/repos/%s/contents/%s", d.Repo, filePath)

	commitMsg := fmt.Sprintf("Wolkvorm: add %s config (%s)", schema.Name, d.Env)
	body := fmt.Sprintf(`{"message":"%s","content":"%s","branch":"%s"}`, commitMsg, content, d.Branch)

	req, _ := http.NewRequest("PUT", url, bytes.NewBuffer([]byte(body)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "GitHub commit failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	fmt.Println("GitHub commit response:", string(respBody))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "committed", "path": filePath})
}

// githubCreatePRHandler creates a pull request on GitHub.
// POST /api/github/create-pr
func githubCreatePRHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	var d CreatePRRequest
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	token, err := getGitHubToken(d.Repo)
	if err != nil {
		http.Error(w, "GitHub not configured: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Look up schema name for PR title
	schemaName := d.SchemaID
	if schema, ok := getSchema(d.SchemaID); ok {
		schemaName = schema.Name
	}

	title := fmt.Sprintf("Wolkvorm: create %s (%s)", schemaName, d.Env)
	prBody := fmt.Sprintf(`{"title":"%s","head":"%s","base":"main","body":"This PR was automatically created by Wolkvorm."}`, title, d.Branch)

	req, _ := http.NewRequest("POST", "https://api.github.com/repos/"+d.Repo+"/pulls", bytes.NewBuffer([]byte(prBody)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "PR creation failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	w.Header().Set("Content-Type", "application/json")
	w.Write(respBody)
}
