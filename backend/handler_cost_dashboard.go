package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func costSummaryHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	records := dbGetCostRecords(30)

	totalCost := 0.0
	byEnv := map[string]float64{}
	bySchema := map[string]float64{}
	byRegion := map[string]float64{}

	// Deduplicate: keep latest record per resource
	latestPerResource := map[string]CostRecord{}
	for _, r := range records {
		key := r.SchemaID + "|" + r.Env + "|" + r.Region
		if r.ResourceID != "" {
			key = r.ResourceID
		}
		if existing, ok := latestPerResource[key]; !ok || r.RecordedAt > existing.RecordedAt {
			latestPerResource[key] = r
		}
	}

	for _, r := range latestPerResource {
		totalCost += r.MonthlyCost
		byEnv[r.Env] += r.MonthlyCost
		bySchema[r.SchemaID] += r.MonthlyCost
		byRegion[r.Region] += r.MonthlyCost
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"total_monthly_cost": totalCost,
		"currency":           "USD",
		"by_env":             byEnv,
		"by_schema":          bySchema,
		"by_region":          byRegion,
		"resource_count":     len(latestPerResource),
	})
}

func costTrendHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	daysStr := r.URL.Query().Get("days")
	days := 30
	if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
		days = d
	}

	records := dbGetCostRecords(days)

	// Group by date
	byDate := map[string]float64{}
	for _, r := range records {
		date := r.RecordedAt[:10] // YYYY-MM-DD
		byDate[date] += r.MonthlyCost
	}

	type TrendPoint struct {
		Date string  `json:"date"`
		Cost float64 `json:"cost"`
	}
	var trend []TrendPoint
	for date, cost := range byDate {
		trend = append(trend, TrendPoint{Date: date, Cost: cost})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trend)
}

func costResourcesHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	records := dbGetCostRecords(30)

	// Latest per resource
	latest := map[string]CostRecord{}
	for _, r := range records {
		key := r.ResourceID
		if key == "" {
			key = r.SchemaID + "|" + r.Env
		}
		if existing, ok := latest[key]; !ok || r.RecordedAt > existing.RecordedAt {
			latest[key] = r
		}
	}

	result := []CostRecord{}
	for _, r := range latest {
		result = append(result, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func budgetsHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		budgets := dbGetBudgets()
		if budgets == nil {
			budgets = []Budget{}
		}

		// Calculate current spending for each budget
		records := dbGetCostRecords(30)
		type BudgetWithSpend struct {
			Budget
			CurrentSpend float64 `json:"current_spend"`
			Percentage   float64 `json:"percentage"`
			OverBudget   bool    `json:"over_budget"`
		}

		result := []BudgetWithSpend{}
		for _, b := range budgets {
			spend := 0.0
			for _, r := range records {
				match := false
				switch b.Scope {
				case "global":
					match = true
				case "env":
					match = r.Env == b.ScopeValue
				case "schema":
					match = r.SchemaID == b.ScopeValue
				}
				if match {
					spend += r.MonthlyCost
				}
			}
			pct := 0.0
			if b.MonthlyLimit > 0 {
				pct = (spend / b.MonthlyLimit) * 100
			}
			result = append(result, BudgetWithSpend{
				Budget:       b,
				CurrentSpend: spend,
				Percentage:   pct,
				OverBudget:   pct >= b.AlertThreshold,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}

	if r.Method == "POST" {
		var b Budget
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		b.ID = fmt.Sprintf("budget-%d", time.Now().UnixNano())
		b.CreatedAt = time.Now().Format("2006-01-02 15:04:05")

		if err := dbInsertBudget(b); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("budget_create", "budget", b.ID, map[string]any{"name": b.Name, "limit": b.MonthlyLimit}, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(b)
		return
	}

	if r.Method == "DELETE" {
		id := r.URL.Query().Get("id")
		if id == "" {
			// Try to extract from path
			parts := strings.Split(r.URL.Path, "/")
			if len(parts) > 0 {
				id = parts[len(parts)-1]
			}
		}
		if id == "" {
			http.Error(w, "Missing budget ID", 400)
			return
		}
		if err := dbDeleteBudget(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		logAudit("budget_delete", "budget", id, nil, r)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
		return
	}

	http.Error(w, "Method not allowed", 405)
}
