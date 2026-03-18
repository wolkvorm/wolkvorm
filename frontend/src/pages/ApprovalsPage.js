import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

import { API, authFetch } from "../config";

function ApprovalsPage() {
  const { canApprove } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [approvals, setApprovals] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewNote, setReviewNote] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const fetchApprovals = () => {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    authFetch(`${API}/api/approvals${params}`)
      .then((r) => r.json())
      .then((data) => setApprovals(data.approvals || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter]); // eslint-disable-line

  const [actionMsg, setActionMsg] = useState(null);

  const handleAction = async (id, action) => {
    try {
      const res = await authFetch(`${API}/api/approvals/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_note: reviewNote[id] || "" }),
      });
      const data = await res.json();
      if (data.message) {
        setActionMsg({ type: "success", text: data.message });
        setTimeout(() => setActionMsg(null), 5000);
      }
    } catch (err) {
      setActionMsg({ type: "error", text: "Action failed: " + err.message });
    }
    fetchApprovals();
  };

  const statusColors = {
    pending: theme.colors.warning,
    approved: theme.colors.success,
    rejected: theme.colors.danger,
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Approvals</h1>
        <p style={styles.subtitle}>Review and approve infrastructure changes</p>
      </div>

      {actionMsg && (
        <div style={{
          padding: "12px 16px",
          marginBottom: 16,
          borderRadius: theme.radius.md,
          background: actionMsg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${actionMsg.type === "success" ? theme.colors.success : theme.colors.danger}`,
          color: actionMsg.type === "success" ? theme.colors.success : theme.colors.danger,
          fontSize: 14,
        }}>
          {actionMsg.text}
        </div>
      )}

      <div style={styles.filters}>
        {["pending", "approved", "rejected", ""].map((s) => (
          <button
            key={s || "all"}
            style={{ ...styles.filterBtn, ...(statusFilter === s ? styles.filterActive : {}) }}
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"} {s === "pending" && approvals.length > 0 && `(${approvals.length})`}
          </button>
        ))}
      </div>

      {approvals.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>
            {statusFilter === "pending" ? "No pending approvals" : "No approvals found"}
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {approvals.map((a) => (
            <div key={a.id} style={{ ...styles.card, borderLeft: `4px solid ${statusColors[a.status]}` }}>
              <div style={styles.cardHeader}>
                <div style={styles.cardLeft}>
                  <span style={{ ...styles.statusBadge, background: `${statusColors[a.status]}22`, color: statusColors[a.status] }}>
                    {a.status}
                  </span>
                  <span style={{ ...styles.actionBadge, color: a.action === "destroy" ? theme.colors.danger : theme.colors.success }}>
                    {a.action}
                  </span>
                  <span style={styles.resourceName}>{a.resource_name}</span>
                  <span style={styles.schemaId}>{a.schema_id}</span>
                </div>
                <div style={styles.cardRight}>
                  <span style={styles.env}>{a.env}</span>
                  <span style={styles.region}>{a.region}</span>
                  <span style={styles.time}>{a.created_at}</span>
                </div>
              </div>

              {a.requested_by && (
                <div style={styles.requestedBy}>Requested by: {a.requested_by}</div>
              )}

              {a.plan_output && (
                <div>
                  <button style={styles.toggleBtn} onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                    {expandedId === a.id ? "Hide Plan Output" : "Show Plan Output"}
                  </button>
                  {expandedId === a.id && (
                    <pre style={styles.planOutput}>{a.plan_output}</pre>
                  )}
                </div>
              )}

              {a.status === "pending" && canApprove && (
                <div style={styles.actions}>
                  <input
                    style={styles.noteInput}
                    placeholder="Review note (optional)"
                    value={reviewNote[a.id] || ""}
                    onChange={(e) => setReviewNote({ ...reviewNote, [a.id]: e.target.value })}
                  />
                  <button style={styles.approveBtn} onClick={() => handleAction(a.id, "approve")}>Approve</button>
                  <button style={styles.rejectBtn} onClick={() => handleAction(a.id, "reject")}>Reject</button>
                </div>
              )}
              {a.status === "pending" && !canApprove && (
                <div style={{ padding: "8px 0", color: "#94a3b8", fontSize: 12 }}>
                  You do not have permission to approve or reject requests.
                </div>
              )}

              {a.status !== "pending" && a.reviewed_by && (
                <div style={styles.reviewInfo}>
                  {a.status === "approved" ? "Approved" : "Rejected"} by {a.reviewed_by}
                  {a.review_note && ` - "${a.review_note}"`}
                  {a.reviewed_at && ` at ${a.reviewed_at}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getStyles(theme) {
  return {
    page: { maxWidth: 1000, margin: "0 auto", padding: "32px" },
    header: { marginBottom: 24 },
    title: { margin: 0, fontSize: 28, fontWeight: 700, color: theme.colors.text },
    subtitle: { margin: "8px 0 0", fontSize: 15, color: theme.colors.textMuted },
    filters: { display: "flex", gap: 8, marginBottom: 20 },
    filterBtn: { padding: "8px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: theme.colors.card, color: theme.colors.textMuted, fontSize: 13, fontWeight: 500, cursor: "pointer", textTransform: "capitalize" },
    filterActive: { background: theme.colors.primary, color: "#fff", borderColor: theme.colors.primary },
    emptyState: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: 40, textAlign: "center" },
    emptyText: { color: theme.colors.textMuted, fontSize: 14 },
    list: { display: "flex", flexDirection: "column", gap: 12 },
    card: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: 20 },
    cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
    cardLeft: { display: "flex", alignItems: "center", gap: 10 },
    cardRight: { display: "flex", alignItems: "center", gap: 10 },
    statusBadge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: "uppercase" },
    actionBadge: { fontSize: 12, fontWeight: 700, textTransform: "uppercase" },
    resourceName: { fontSize: 15, fontWeight: 600, color: theme.colors.text },
    schemaId: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.mono },
    env: { fontSize: 12, color: theme.colors.textMuted, background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 8 },
    region: { fontSize: 12, color: theme.colors.textMuted },
    time: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.mono },
    requestedBy: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8 },
    toggleBtn: { marginTop: 12, padding: "6px 12px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: theme.colors.bg, color: theme.colors.text, fontSize: 12, cursor: "pointer" },
    planOutput: { marginTop: 8, padding: 16, background: theme.colors.terminal, color: theme.colors.terminalText, borderRadius: theme.radius.sm, fontSize: 12, fontFamily: theme.fonts.mono, overflow: "auto", maxHeight: 300 },
    actions: { display: "flex", gap: 8, marginTop: 16, alignItems: "center" },
    noteInput: { flex: 1, padding: "8px 12px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.inputBorder}`, background: theme.colors.input, color: theme.colors.text, fontSize: 13, outline: "none" },
    approveBtn: { padding: "8px 20px", borderRadius: theme.radius.sm, border: "none", background: theme.colors.success, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
    rejectBtn: { padding: "8px 20px", borderRadius: theme.radius.sm, border: "none", background: theme.colors.danger, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
    reviewInfo: { marginTop: 10, fontSize: 12, color: theme.colors.textMuted, fontStyle: "italic" },
  };
}

export default ApprovalsPage;
