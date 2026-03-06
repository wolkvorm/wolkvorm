package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"strings"
)

// NotificationConfig holds all notification channel settings.
type NotificationConfig struct {
	SlackWebhook   string        `json:"slack_webhook"`
	TeamsWebhook   string        `json:"teams_webhook"`
	DiscordWebhook string        `json:"discord_webhook"`
	EmailSMTP      SMTPConfig    `json:"email_smtp"`
	EnabledEvents  []string      `json:"enabled_events"` // plan_success, apply_success, apply_error, destroy, drift_detected, budget_alert
}

type SMTPConfig struct {
	Host     string `json:"host"`
	Port     string `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	From     string `json:"from"`
	To       string `json:"to"`
}

// SendNotification sends a notification to all configured channels.
func SendNotification(event, title, message string, details map[string]string) {
	config := GetNotificationConfig()
	if config == nil {
		return
	}

	// Check if event is enabled
	if !isEventEnabled(config, event) {
		return
	}

	if config.SlackWebhook != "" {
		go func() { _ = sendSlack(config.SlackWebhook, title, message, details) }()
	}
	if config.TeamsWebhook != "" {
		go func() { _ = sendTeams(config.TeamsWebhook, title, message, details) }()
	}
	if config.DiscordWebhook != "" {
		go func() { _ = sendDiscord(config.DiscordWebhook, title, message, details) }()
	}
	if config.EmailSMTP.Host != "" && config.EmailSMTP.To != "" {
		go func() { _ = sendEmail(config.EmailSMTP, title, message, details) }()
	}
}

func isEventEnabled(config *NotificationConfig, event string) bool {
	if len(config.EnabledEvents) == 0 {
		return true // all enabled by default
	}
	for _, e := range config.EnabledEvents {
		if e == event {
			return true
		}
	}
	return false
}

func sendSlack(webhook, title, message string, details map[string]string) error {
	fields := ""
	for k, v := range details {
		fields += fmt.Sprintf("\n*%s:* %s", k, v)
	}
	payload := map[string]any{
		"blocks": []map[string]any{
			{
				"type": "header",
				"text": map[string]string{"type": "plain_text", "text": title},
			},
			{
				"type": "section",
				"text": map[string]string{"type": "mrkdwn", "text": message + fields},
			},
		},
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(webhook, "application/json", bytes.NewBuffer(body))
	if err != nil {
		fmt.Printf("Slack notification error: %v\n", err)
		return fmt.Errorf("Slack request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Slack returned status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func sendTeams(webhook, title, message string, details map[string]string) error {
	facts := []map[string]string{}
	for k, v := range details {
		facts = append(facts, map[string]string{"name": k, "value": v})
	}
	payload := map[string]any{
		"type": "message",
		"attachments": []map[string]any{
			{
				"contentType": "application/vnd.microsoft.card.adaptive",
				"content": map[string]any{
					"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
					"type":    "AdaptiveCard",
					"version": "1.4",
					"body": []map[string]any{
						{"type": "TextBlock", "text": title, "size": "Large", "weight": "Bolder"},
						{"type": "TextBlock", "text": message, "wrap": true},
						{"type": "FactSet", "facts": facts},
					},
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(webhook, "application/json", bytes.NewBuffer(body))
	if err != nil {
		fmt.Printf("Teams notification error: %v\n", err)
		return fmt.Errorf("Teams request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Teams returned status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func sendDiscord(webhook, title, message string, details map[string]string) error {
	fields := []map[string]any{}
	for k, v := range details {
		fields = append(fields, map[string]any{"name": k, "value": v, "inline": true})
	}
	payload := map[string]any{
		"embeds": []map[string]any{
			{
				"title":       title,
				"description": message,
				"color":       5814783, // indigo
				"fields":      fields,
			},
		},
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(webhook, "application/json", bytes.NewBuffer(body))
	if err != nil {
		fmt.Printf("Discord notification error: %v\n", err)
		return fmt.Errorf("Discord request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		fmt.Printf("Discord error response (%d): %s\n", resp.StatusCode, string(respBody))
		return fmt.Errorf("Discord returned status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func sendEmail(config SMTPConfig, title, message string, details map[string]string) error {
	detailLines := ""
	for k, v := range details {
		detailLines += fmt.Sprintf("<tr><td><strong>%s</strong></td><td>%s</td></tr>", k, v)
	}

	htmlBody := fmt.Sprintf(`<html><body>
<h2>%s</h2>
<p>%s</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse">%s</table>
<p style="color:#666;font-size:12px">Sent by TerraForge</p>
</body></html>`, title, message, detailLines)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: TerraForge: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		config.From, config.To, title, htmlBody)

	addr := config.Host + ":" + config.Port
	var auth smtp.Auth
	if config.User != "" {
		auth = smtp.PlainAuth("", config.User, config.Password, config.Host)
	}
	recipients := strings.Split(config.To, ",")
	err := smtp.SendMail(addr, auth, config.From, recipients, []byte(msg))
	if err != nil {
		fmt.Printf("Email notification error: %v\n", err)
		return fmt.Errorf("Email send failed: %v", err)
	}
	return nil
}

// SendTestNotification sends a test to a specific channel.
func SendTestNotification(channel string) error {
	config := GetNotificationConfig()
	if config == nil {
		return fmt.Errorf("no notification config found")
	}
	title := "TerraForge Test Notification"
	message := "This is a test notification from TerraForge."
	details := map[string]string{"Status": "OK", "Source": "Settings Page"}

	switch channel {
	case "slack":
		if config.SlackWebhook == "" {
			return fmt.Errorf("Slack webhook not configured")
		}
		return sendSlack(config.SlackWebhook, title, message, details)
	case "teams":
		if config.TeamsWebhook == "" {
			return fmt.Errorf("Teams webhook not configured")
		}
		return sendTeams(config.TeamsWebhook, title, message, details)
	case "discord":
		if config.DiscordWebhook == "" {
			return fmt.Errorf("Discord webhook not configured")
		}
		return sendDiscord(config.DiscordWebhook, title, message, details)
	case "email":
		if config.EmailSMTP.Host == "" {
			return fmt.Errorf("Email SMTP not configured")
		}
		return sendEmail(config.EmailSMTP, title, message, details)
	default:
		return fmt.Errorf("unknown channel: %s", channel)
	}
}
