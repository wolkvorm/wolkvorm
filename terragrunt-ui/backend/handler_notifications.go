package main

import (
	"encoding/json"
	"net/http"
)

func notificationsSettingsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		config := GetNotificationConfig()
		w.Header().Set("Content-Type", "application/json")
		if config == nil {
			json.NewEncoder(w).Encode(NotificationConfig{})
			return
		}
		// Mask sensitive fields
		safe := *config
		if safe.EmailSMTP.Password != "" {
			safe.EmailSMTP.Password = "****"
		}
		json.NewEncoder(w).Encode(safe)
		return
	}

	if r.Method == "POST" {
		var config NotificationConfig
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}

		// If password is masked, keep the old one
		if config.EmailSMTP.Password == "****" {
			old := GetNotificationConfig()
			if old != nil {
				config.EmailSMTP.Password = old.EmailSMTP.Password
			}
		}

		if err := SetNotificationConfig(config); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("settings_change", "notifications", "", map[string]any{"action": "update_notifications"}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	http.Error(w, "Method not allowed", 405)
}

func notificationsTestHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req struct {
		Channel string `json:"channel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", 400)
		return
	}

	if err := SendTestNotification(req.Channel); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "sent"})
}
