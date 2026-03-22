package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func approvalsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		status := r.URL.Query().Get("status")
		approvals := dbGetApprovals(status)
		if approvals == nil {
			approvals = []Approval{}
		}

		pendingCount := dbGetPendingApprovalCount()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"approvals":     approvals,
			"pending_count": pendingCount,
		})
		return
	}

	http.Error(w, "Method not allowed", 405)
}

func approvalActionHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/approvals/"), "/")
	if len(parts) < 2 {
		http.Error(w, "Invalid path", 400)
		return
	}

	id := parts[0]
	action := parts[1] // "approve" or "reject"

	approval := dbGetApproval(id)
	if approval == nil {
		http.Error(w, "Approval not found", 404)
		return
	}

	if approval.Status != "pending" {
		http.Error(w, "Approval is no longer pending", 400)
		return
	}

	var req struct {
		ReviewNote string `json:"review_note"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	reviewedBy := r.Header.Get("X-API-Key-Name")
	if reviewedBy == "" {
		reviewedBy = "admin"
	}

	var newStatus string
	switch action {
	case "approve":
		newStatus = "approved"
	case "reject":
		newStatus = "rejected"
	default:
		http.Error(w, "Invalid action (approve/reject)", 400)
		return
	}

	if err := dbUpdateApproval(id, newStatus, reviewedBy, req.ReviewNote); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	logAudit("approval_"+action, "approval", id, map[string]any{
		"resource":  approval.ResourceName,
		"schema":    approval.SchemaID,
		"action":    approval.Action,
		"note":      req.ReviewNote,
	}, r)

	// Send notification
	SendNotification("approval_"+action, fmt.Sprintf("Approval %sd: %s", action, approval.ResourceName),
		fmt.Sprintf("The %s request for %s has been %sd by %s", approval.Action, approval.ResourceName, action, reviewedBy),
		map[string]string{
			"Resource": approval.ResourceName,
			"Action":   approval.Action,
			"Status":   newStatus,
			"Reviewer": reviewedBy,
		})

	// If approved, execute the operation in the background
	var execResult map[string]string
	if newStatus == "approved" {
		var inputs map[string]any
		if approval.InputsJSON != "" {
			json.Unmarshal([]byte(approval.InputsJSON), &inputs)
		}

		tgCmd := iacCommand("terraform apply -auto-approve")
		if approval.Action == "destroy" {
			tgCmd = iacCommand("terraform destroy -auto-approve")
		}

		go func() {
			planReq := PlanRequest{
				SchemaID: approval.SchemaID,
				Inputs:   inputs,
				Region:   approval.Region,
				Env:      approval.Env,
			}
			status, recordID := runTerragrunt(planReq, approval.Action, tgCmd)
			fmt.Printf("[Approval] Executed %s for %s: status=%s, recordID=%s\n", approval.Action, approval.ResourceName, status, recordID)

			logAudit(approval.Action+"_executed", approval.SchemaID, recordID, map[string]any{
				"resource":    approval.ResourceName,
				"approval_id": id,
				"status":      status,
			}, nil)
		}()

		execResult = map[string]string{"status": newStatus, "message": fmt.Sprintf("Approved and %s is now running in background", approval.Action)}
	} else {
		execResult = map[string]string{"status": newStatus}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(execResult)
}

func approvalsPendingCountHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	count := dbGetPendingApprovalCount()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"count": count})
}

// createApprovalRequest creates a pending approval for apply/destroy actions.
func createApprovalRequest(schemaID, resourceName, action, env, region, planOutput string, inputs map[string]any, r *http.Request) string {
	inputsJSON, _ := json.Marshal(inputs)
	requestedBy := ""
	if r != nil {
		requestedBy = r.Header.Get("X-API-Key-Name")
	}

	approval := Approval{
		ID:           fmt.Sprintf("apr-%d", time.Now().UnixNano()),
		ResourceName: resourceName,
		SchemaID:     schemaID,
		Action:       action,
		RequestedBy:  requestedBy,
		Status:       "pending",
		PlanOutput:   planOutput,
		InputsJSON:   string(inputsJSON),
		Env:          env,
		Region:       region,
		CreatedAt:    time.Now().Format("2006-01-02 15:04:05"),
	}

	dbInsertApproval(approval)

	// Send notification
	SendNotification("approval_requested", fmt.Sprintf("Approval Requested: %s %s", action, resourceName),
		fmt.Sprintf("A %s request for %s needs approval", action, resourceName),
		map[string]string{
			"Resource": resourceName,
			"Action":   action,
			"Env":      env,
			"Region":   region,
		})

	return approval.ID
}
