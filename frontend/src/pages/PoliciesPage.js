import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

import { API, authFetch } from "../config";

function PoliciesPage() {
  const { canManagePolicies } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [policies, setPolicies] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", rego_content: "", severity: "warning", is_active: 1 });
  const [testResult, setTestResult] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchPolicies();
    authFetch(`${API}/api/policies/templates`).then(r => r.json()).then(setTemplates).catch(() => {});
  }, []);

  const fetchPolicies = () => {
    authFetch(`${API}/api/policies`).then(r => r.json()).then(d => setPolicies(Array.isArray(d) ? d : [])).catch(() => {});
  };

  const savePolicy = async () => {
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `${API}/api/policies/${editingId}` : `${API}/api/policies`;
    await authFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", description: "", rego_content: "", severity: "warning", is_active: 1 });
    fetchPolicies();
  };

  const deletePolicy = async (id) => {
    await authFetch(`${API}/api/policies/${id}`, { method: "DELETE" });
    fetchPolicies();
  };

  const togglePolicy = async (p) => {
    await authFetch(`${API}/api/policies/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, is_active: p.is_active ? 0 : 1 }),
    });
    fetchPolicies();
  };

  const editPolicy = (p) => {
    setForm({ name: p.name, description: p.description, rego_content: p.rego_content, severity: p.severity, is_active: p.is_active });
    setEditingId(p.id);
    setShowForm(true);
  };

  const applyTemplate = (t) => {
    setForm({ name: t.name, description: t.description, rego_content: t.rules, severity: t.severity, is_active: 1 });
    setEditingId(null);
    setShowForm(true);
  };

  const testPolicies = async () => {
    const res = await authFetch(`${API}/api/policies/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema_id: "ec2", inputs: { instance_type: "t2.xlarge" }, region: "us-east-1", env: "dev" }),
    });
    const data = await res.json();
    setTestResult(data);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Policies</h1>
          <p style={styles.subtitle}>Define rules to enforce infrastructure standards</p>
        </div>
        <div style={styles.headerBtns}>
          {canManagePolicies && (
            <>
              <button style={styles.testBtn} onClick={testPolicies}>Test Policies</button>
              <button style={styles.addBtn} onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", description: "", rego_content: "", severity: "warning", is_active: 1 }); }}>
                {showForm ? "Cancel" : "+ New Policy"}
              </button>
            </>
          )}
        </div>
      </div>

      {testResult && (
        <div style={{ ...styles.testBox, borderColor: testResult.passed ? theme.colors.success : theme.colors.danger }}>
          <strong>{testResult.passed ? "All policies passed" : `${testResult.violations?.length} violation(s) found`}</strong>
          {testResult.violations?.map((v, i) => (
            <div key={i} style={styles.violation}>
              <span style={{ ...styles.sevBadge, color: v.severity === "error" ? theme.colors.danger : theme.colors.warning }}>[{v.severity}]</span>
              {v.policy_name}: {v.message}
            </div>
          ))}
          <button style={styles.closeBtn} onClick={() => setTestResult(null)}>Close</button>
        </div>
      )}

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>{editingId ? "Edit Policy" : "New Policy"}</h3>
          <div style={styles.formGrid}>
            <input style={styles.input} placeholder="Policy name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select style={styles.input} value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
              <option value="warning">Warning</option>
              <option value="error">Error (blocks apply)</option>
            </select>
          </div>
          <input style={styles.input} placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <textarea
            style={styles.codeArea}
            placeholder={`Policy rules as JSON, e.g.:\n[{"schemas":"ec2","field":"instance_type","operator":"in","value":"t2.micro,t3.small","message":"Only small instances allowed"}]`}
            value={form.rego_content}
            onChange={e => setForm({ ...form, rego_content: e.target.value })}
            rows={8}
          />
          <button style={styles.saveBtn} onClick={savePolicy} disabled={!form.name || !form.rego_content}>
            {editingId ? "Update Policy" : "Create Policy"}
          </button>
        </div>
      )}

      {/* Templates */}
      {!showForm && templates.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Quick Start Templates</h3>
          <div style={styles.templatesGrid}>
            {templates.map((t, i) => (
              <div key={i} style={styles.templateCard} onClick={() => applyTemplate(t)}>
                <span style={{ ...styles.sevDot, background: t.severity === "error" ? theme.colors.danger : theme.colors.warning }} />
                <span style={styles.templateName}>{t.name}</span>
                <span style={styles.templateDesc}>{t.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Policy List */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Active Policies ({policies.length})</h3>
        {policies.length === 0 ? (
          <p style={styles.emptyText}>No policies configured. Create one or use a template above.</p>
        ) : (
          <div style={styles.policyList}>
            {policies.map(p => (
              <div key={p.id} style={{ ...styles.policyCard, opacity: p.is_active ? 1 : 0.5 }}>
                <div style={styles.policyLeft}>
                  <span style={{ ...styles.sevDot, background: p.severity === "error" ? theme.colors.danger : theme.colors.warning }} />
                  <div>
                    <span style={styles.policyName}>{p.name}</span>
                    <span style={styles.policyDesc}>{p.description}</span>
                  </div>
                </div>
                {canManagePolicies && (
                  <div style={styles.policyActions}>
                    <button style={styles.toggleBtn} onClick={() => togglePolicy(p)}>
                      {p.is_active ? "Disable" : "Enable"}
                    </button>
                    <button style={styles.editBtn} onClick={() => editPolicy(p)}>Edit</button>
                    <button style={styles.deleteBtn} onClick={() => deletePolicy(p.id)}>Delete</button>
                  </div>
                )}
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
    page: { maxWidth: 1000, margin: "0 auto", padding: "32px" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
    title: { margin: 0, fontSize: 28, fontWeight: 700, color: theme.colors.text },
    subtitle: { margin: "8px 0 0", fontSize: 15, color: theme.colors.textMuted },
    headerBtns: { display: "flex", gap: 8 },
    testBtn: { padding: "8px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: theme.colors.card, color: theme.colors.text, fontSize: 13, cursor: "pointer" },
    addBtn: { padding: "8px 16px", borderRadius: theme.radius.sm, border: "none", background: theme.colors.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
    testBox: { padding: 16, background: theme.colors.card, border: "1px solid", borderRadius: theme.radius.md, marginBottom: 20, fontSize: 13, color: theme.colors.text },
    violation: { marginTop: 6, fontSize: 12, color: theme.colors.textMuted },
    sevBadge: { fontWeight: 700, marginRight: 4 },
    closeBtn: { marginTop: 8, padding: "4px 12px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: "transparent", color: theme.colors.textMuted, fontSize: 12, cursor: "pointer" },
    formCard: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 },
    formTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: theme.colors.text },
    formGrid: { display: "grid", gridTemplateColumns: "1fr auto", gap: 12 },
    input: { padding: "10px 14px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.inputBorder}`, background: theme.colors.input, color: theme.colors.text, fontSize: 13, outline: "none" },
    codeArea: { padding: 14, borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.inputBorder}`, background: theme.colors.terminal, color: theme.colors.terminalText, fontSize: 12, fontFamily: theme.fonts.mono, resize: "vertical", outline: "none" },
    saveBtn: { padding: "10px 20px", borderRadius: theme.radius.sm, border: "none", background: theme.colors.primary, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" },
    section: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: 24, marginBottom: 24 },
    sectionTitle: { margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: theme.colors.text },
    templatesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 },
    templateCard: { padding: "12px 16px", background: theme.colors.bg, borderRadius: theme.radius.sm, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, border: `1px solid ${theme.colors.border}`, transition: "border-color 0.2s" },
    sevDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
    templateName: { fontSize: 13, fontWeight: 600, color: theme.colors.text },
    templateDesc: { fontSize: 11, color: theme.colors.textMuted },
    emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: "center", padding: 20 },
    policyList: { display: "flex", flexDirection: "column", gap: 8 },
    policyCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: theme.colors.bg, borderRadius: theme.radius.sm },
    policyLeft: { display: "flex", alignItems: "center", gap: 12 },
    policyName: { fontSize: 14, fontWeight: 600, color: theme.colors.text, display: "block" },
    policyDesc: { fontSize: 12, color: theme.colors.textMuted },
    policyActions: { display: "flex", gap: 6 },
    toggleBtn: { padding: "4px 10px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: "transparent", color: theme.colors.textMuted, fontSize: 11, cursor: "pointer" },
    editBtn: { padding: "4px 10px", borderRadius: theme.radius.sm, border: "none", background: "rgba(99,102,241,0.1)", color: theme.colors.primary, fontSize: 11, cursor: "pointer" },
    deleteBtn: { padding: "4px 10px", borderRadius: theme.radius.sm, border: "none", background: "rgba(239,68,68,0.1)", color: theme.colors.danger, fontSize: 11, cursor: "pointer" },
  };
}

export default PoliciesPage;
