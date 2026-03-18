package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// logAudit is a helper to insert an audit log entry from any handler.
func logAudit(action, entityType, entityID string, details map[string]any, r *http.Request) {
	ip := ""
	if r != nil {
		ip = r.RemoteAddr
	}
	detailsJSON, _ := json.Marshal(details)
	user := ""
	if r != nil {
		user = r.Header.Get("X-API-Key-Name")
	}

	dbInsertAudit(AuditEntry{
		ID:           fmt.Sprintf("audit-%d", time.Now().UnixNano()),
		Action:       action,
		EntityType:   entityType,
		EntityID:     entityID,
		Details:      string(detailsJSON),
		IPAddress:    ip,
		UserIdentity: user,
		CreatedAt:    time.Now().Format("2006-01-02 15:04:05"),
	})
}

func auditListHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	action := r.URL.Query().Get("action")
	entityType := r.URL.Query().Get("entity_type")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o > 0 {
		offset = o
	}

	entries, total := dbGetAuditLogs(action, entityType, search, limit, offset)
	if entries == nil {
		entries = []AuditEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"entries": entries,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

func auditExportHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	format := r.URL.Query().Get("format")
	entries, _ := dbGetAuditLogs("", "", "", 10000, 0)

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=audit-log.csv")
		writer := csv.NewWriter(w)
		writer.Write([]string{"ID", "Action", "Entity Type", "Entity ID", "Details", "IP Address", "User", "Created At"})
		for _, e := range entries {
			writer.Write([]string{e.ID, e.Action, e.EntityType, e.EntityID, e.Details, e.IPAddress, e.UserIdentity, e.CreatedAt})
		}
		writer.Flush()
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=audit-log.json")
	json.NewEncoder(w).Encode(entries)
}
