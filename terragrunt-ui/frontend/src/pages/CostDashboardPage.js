import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

function CostDashboardPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [summary, setSummary] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ name: "", scope: "global", scope_value: "", monthly_limit: "", alert_threshold: 80 });

  useEffect(() => {
    authFetch(`${API}/api/costs/summary`).then(r => r.json()).then(setSummary).catch(() => {});
    fetchBudgets();
  }, []);

  const fetchBudgets = () => {
    authFetch(`${API}/api/budgets`).then(r => r.json()).then(d => setBudgets(Array.isArray(d) ? d : [])).catch(() => {});
  };

  const createBudget = async () => {
    await authFetch(`${API}/api/budgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...budgetForm, monthly_limit: parseFloat(budgetForm.monthly_limit), alert_threshold: parseFloat(budgetForm.alert_threshold) }),
    });
    setShowBudgetForm(false);
    setBudgetForm({ name: "", scope: "global", scope_value: "", monthly_limit: "", alert_threshold: 80 });
    fetchBudgets();
  };

  const deleteBudget = async (id) => {
    await authFetch(`${API}/api/budgets?id=${id}`, { method: "DELETE" });
    fetchBudgets();
  };

  const maxCostEnv = summary?.by_env ? Math.max(...Object.values(summary.by_env), 1) : 1;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Cost Dashboard</h1>
        <p style={styles.subtitle}>Monitor infrastructure costs and manage budgets</p>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardsGrid}>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Total Monthly Cost</span>
          <span style={styles.cardValue}>${(summary?.total_monthly_cost || 0).toFixed(2)}</span>
          <span style={styles.cardSub}>{summary?.currency || "USD"}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Resources Tracked</span>
          <span style={{ ...styles.cardValue, color: theme.colors.primary }}>{summary?.resource_count || 0}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Active Budgets</span>
          <span style={{ ...styles.cardValue, color: theme.colors.warning }}>{budgets.length}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Over Budget</span>
          <span style={{ ...styles.cardValue, color: theme.colors.danger }}>{budgets.filter(b => b.over_budget).length}</span>
        </div>
      </div>

      {/* Breakdown */}
      <div style={styles.breakdownRow}>
        <div style={styles.breakdownCard}>
          <h3 style={styles.sectionTitle}>Cost by Environment</h3>
          {summary?.by_env && Object.entries(summary.by_env).map(([env, cost]) => (
            <div key={env} style={styles.barRow}>
              <span style={styles.barLabel}>{env}</span>
              <div style={styles.barTrack}>
                <div style={{ ...styles.barFill, width: `${(cost / maxCostEnv) * 100}%` }} />
              </div>
              <span style={styles.barValue}>${cost.toFixed(2)}</span>
            </div>
          ))}
          {(!summary?.by_env || Object.keys(summary.by_env).length === 0) && (
            <p style={styles.emptyText}>No cost data available yet. Run cost estimates on resources to start tracking.</p>
          )}
        </div>

        <div style={styles.breakdownCard}>
          <h3 style={styles.sectionTitle}>Cost by Resource Type</h3>
          {summary?.by_schema && Object.entries(summary.by_schema).sort((a, b) => b[1] - a[1]).map(([schema, cost]) => (
            <div key={schema} style={styles.schemaRow}>
              <span style={styles.schemaName}>{schema}</span>
              <span style={styles.schemaCost}>${cost.toFixed(2)}/mo</span>
            </div>
          ))}
          {(!summary?.by_schema || Object.keys(summary.by_schema).length === 0) && (
            <p style={styles.emptyText}>No cost data available yet.</p>
          )}
        </div>
      </div>

      {/* Budgets */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Budgets</h3>
          <button style={styles.addBtn} onClick={() => setShowBudgetForm(!showBudgetForm)}>
            {showBudgetForm ? "Cancel" : "+ Add Budget"}
          </button>
        </div>

        {showBudgetForm && (
          <div style={styles.budgetForm}>
            <input style={styles.input} placeholder="Budget name" value={budgetForm.name} onChange={e => setBudgetForm({ ...budgetForm, name: e.target.value })} />
            <select style={styles.input} value={budgetForm.scope} onChange={e => setBudgetForm({ ...budgetForm, scope: e.target.value })}>
              <option value="global">Global</option>
              <option value="env">Per Environment</option>
              <option value="schema">Per Resource Type</option>
            </select>
            {budgetForm.scope !== "global" && (
              <input style={styles.input} placeholder={budgetForm.scope === "env" ? "Environment (e.g. prod)" : "Schema ID (e.g. ec2)"} value={budgetForm.scope_value} onChange={e => setBudgetForm({ ...budgetForm, scope_value: e.target.value })} />
            )}
            <input style={styles.input} type="number" placeholder="Monthly limit ($)" value={budgetForm.monthly_limit} onChange={e => setBudgetForm({ ...budgetForm, monthly_limit: e.target.value })} />
            <input style={styles.input} type="number" placeholder="Alert at % (default 80)" value={budgetForm.alert_threshold} onChange={e => setBudgetForm({ ...budgetForm, alert_threshold: e.target.value })} />
            <button style={styles.saveBtn} onClick={createBudget} disabled={!budgetForm.name || !budgetForm.monthly_limit}>Create Budget</button>
          </div>
        )}

        {budgets.length === 0 ? (
          <p style={styles.emptyText}>No budgets configured. Create one to get alerts when spending exceeds limits.</p>
        ) : (
          <div style={styles.budgetList}>
            {budgets.map(b => (
              <div key={b.id} style={{ ...styles.budgetItem, borderLeft: `4px solid ${b.over_budget ? theme.colors.danger : theme.colors.success}` }}>
                <div style={styles.budgetInfo}>
                  <span style={styles.budgetName}>{b.name}</span>
                  <span style={styles.budgetScope}>{b.scope}{b.scope_value ? `: ${b.scope_value}` : ""}</span>
                </div>
                <div style={styles.budgetProgress}>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${Math.min(b.percentage || 0, 100)}%`, background: (b.percentage || 0) >= b.alert_threshold ? theme.colors.danger : theme.colors.success }} />
                  </div>
                  <span style={styles.budgetPercent}>{(b.percentage || 0).toFixed(0)}%</span>
                </div>
                <div style={styles.budgetCosts}>
                  <span style={styles.budgetSpend}>${(b.current_spend || 0).toFixed(2)}</span>
                  <span style={styles.budgetLimit}>/ ${b.monthly_limit.toFixed(2)}</span>
                </div>
                <button style={styles.deleteBtn} onClick={() => deleteBudget(b.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getStyles(theme) {
  return {
  page: { maxWidth: 1200, margin: "0 auto", padding: "32px" },
  header: { marginBottom: 32 },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: theme.colors.text },
  subtitle: { margin: "8px 0 0", fontSize: 15, color: theme.colors.textMuted },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 },
  card: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  cardLabel: { fontSize: 13, color: theme.colors.textMuted, fontWeight: 500 },
  cardValue: { fontSize: 36, fontWeight: 700, color: theme.colors.success, fontFamily: theme.fonts.mono },
  cardSub: { fontSize: 12, color: theme.colors.textMuted },
  breakdownRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 },
  breakdownCard: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: theme.colors.text, margin: "0 0 16px" },
  barRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  barLabel: { fontSize: 13, color: theme.colors.textMuted, width: 80, flexShrink: 0 },
  barTrack: { flex: 1, height: 8, background: theme.colors.bg, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", background: theme.colors.primary, borderRadius: 4, transition: "width 0.3s" },
  barValue: { fontSize: 13, fontWeight: 600, color: theme.colors.text, fontFamily: theme.fonts.mono, width: 80, textAlign: "right" },
  schemaRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.colors.border}22` },
  schemaName: { fontSize: 13, color: theme.colors.text, fontWeight: 500 },
  schemaCost: { fontSize: 13, fontFamily: theme.fonts.mono, color: theme.colors.success },
  section: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: 24, marginBottom: 24 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  addBtn: { padding: "8px 16px", borderRadius: theme.radius.sm, border: "none", background: theme.colors.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  budgetForm: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, padding: 16, background: theme.colors.bg, borderRadius: theme.radius.sm },
  input: { padding: "8px 12px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.inputBorder}`, background: theme.colors.input, color: theme.colors.text, fontSize: 13, minWidth: 140 },
  saveBtn: { padding: "8px 16px", borderRadius: theme.radius.sm, border: "none", background: theme.colors.success, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: "center", padding: 20 },
  budgetList: { display: "flex", flexDirection: "column", gap: 8 },
  budgetItem: { display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: theme.colors.bg, borderRadius: theme.radius.sm },
  budgetInfo: { display: "flex", flexDirection: "column", gap: 2, minWidth: 150 },
  budgetName: { fontSize: 14, fontWeight: 600, color: theme.colors.text },
  budgetScope: { fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase" },
  budgetProgress: { flex: 1, display: "flex", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 8, background: theme.colors.card, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, transition: "width 0.3s" },
  budgetPercent: { fontSize: 13, fontWeight: 600, color: theme.colors.text, fontFamily: theme.fonts.mono, width: 40 },
  budgetCosts: { display: "flex", alignItems: "baseline", gap: 2 },
  budgetSpend: { fontSize: 14, fontWeight: 600, color: theme.colors.text, fontFamily: theme.fonts.mono },
  budgetLimit: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.mono },
  deleteBtn: { padding: "6px 12px", borderRadius: theme.radius.sm, border: "none", background: "rgba(239,68,68,0.1)", color: theme.colors.danger, fontSize: 12, fontWeight: 600, cursor: "pointer" },
}; }

export default CostDashboardPage;
