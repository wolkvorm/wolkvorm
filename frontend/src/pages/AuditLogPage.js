import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

function AuditLogPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const limit = 30;

  const fetchLogs = () => {
    const params = new URLSearchParams({ limit, offset: page * limit });
    if (actionFilter) params.set("action", actionFilter);
    if (entityFilter) params.set("entity_type", entityFilter);
    if (search) params.set("search", search);

    authFetch(`${API}/api/audit?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setTotal(data.total || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, entityFilter]); // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const totalPages = Math.ceil(total / limit);

  const actionColors = {
    plan: theme.colors.primary,
    apply: theme.colors.success,
    destroy: theme.colors.danger,
    settings_change: theme.colors.warning,
    account_create: "#10b981",
    apikey_create: "#8b5cf6",
    policy_create: "#ec4899",
    drift_check: "#06b6d4",
    import_scan: "#f97316",
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Audit Log</h1>
          <p style={styles.subtitle}>Track all actions and changes in your infrastructure</p>
        </div>
        <div style={styles.exportBtns}>
          <a href={`${API}/api/audit/export?format=csv`} style={styles.exportBtn} download>Export CSV</a>
          <a href={`${API}/api/audit/export?format=json`} style={styles.exportBtn} download>Export JSON</a>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <select style={styles.filterSelect} value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}>
          <option value="">All Actions</option>
          <option value="plan">Plan</option>
          <option value="apply">Apply</option>
          <option value="destroy">Destroy</option>
          <option value="settings_change">Settings Change</option>
          <option value="account_create">Account Create</option>
          <option value="apikey_create">API Key Create</option>
          <option value="policy_create">Policy Create</option>
          <option value="drift_check">Drift Check</option>
          <option value="import_scan">Import Scan</option>
        </select>
        <select style={styles.filterSelect} value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}>
          <option value="">All Entities</option>
          <option value="resource">Resource</option>
          <option value="settings">Settings</option>
          <option value="notifications">Notifications</option>
          <option value="aws_account">AWS Account</option>
          <option value="api_key">API Key</option>
          <option value="policy">Policy</option>
          <option value="approval">Approval</option>
          <option value="budget">Budget</option>
          <option value="system">System</option>
        </select>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            type="text"
            style={styles.searchInput}
            placeholder="Search details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" style={styles.searchBtn}>Search</button>
        </form>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Entity</th>
              <th style={styles.th}>Details</th>
              <th style={styles.th}>User</th>
              <th style={styles.th}>IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={6} style={styles.empty}>No audit logs found</td></tr>
            ) : entries.map((e) => {
              let details = {};
              try { details = JSON.parse(e.details); } catch {}
              return (
                <tr key={e.id} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={styles.time}>{e.created_at}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.actionBadge, background: `${actionColors[e.action] || theme.colors.textMuted}22`, color: actionColors[e.action] || theme.colors.textMuted }}>
                      {e.action}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.entity}>{e.entity_type}</span>
                    {e.entity_id && <span style={styles.entityId}>{e.entity_id}</span>}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.details}>
                      {Object.entries(details).map(([k, v]) => (
                        <span key={k} style={styles.detailItem}>{k}: {String(v)}</span>
                      ))}
                    </span>
                  </td>
                  <td style={styles.td}><span style={styles.user}>{e.user_identity || "-"}</span></td>
                  <td style={styles.td}><span style={styles.ip}>{e.ip_address || "-"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button style={styles.pageBtn} onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Previous</button>
          <span style={styles.pageInfo}>Page {page + 1} of {totalPages} ({total} total)</span>
          <button style={styles.pageBtn} onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Next</button>
        </div>
      )}
    </div>
  );
}

function getStyles(theme) {
  return {
  page: { maxWidth: 1400, margin: "0 auto", padding: "32px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: theme.colors.text },
  subtitle: { margin: "8px 0 0", fontSize: 15, color: theme.colors.textMuted },
  exportBtns: { display: "flex", gap: 8 },
  exportBtn: { padding: "8px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: theme.colors.card, color: theme.colors.text, textDecoration: "none", fontSize: 13, fontWeight: 500 },
  filters: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  filterSelect: { padding: "8px 12px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.inputBorder}`, background: theme.colors.input, color: theme.colors.text, fontSize: 13 },
  searchForm: { display: "flex", gap: 8, flex: 1, minWidth: 200 },
  searchInput: { flex: 1, padding: "8px 12px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.inputBorder}`, background: theme.colors.input, color: theme.colors.text, fontSize: 13, outline: "none" },
  searchBtn: { padding: "8px 16px", borderRadius: theme.radius.sm, border: "none", background: theme.colors.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  tableWrap: { background: theme.colors.card, borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border}`, overflow: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${theme.colors.border}` },
  tr: { borderBottom: `1px solid ${theme.colors.border}22` },
  td: { padding: "10px 16px", fontSize: 13, color: theme.colors.text, verticalAlign: "top" },
  empty: { padding: 40, textAlign: "center", color: theme.colors.textMuted, fontSize: 14 },
  time: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.mono, whiteSpace: "nowrap" },
  actionBadge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: "uppercase" },
  entity: { fontSize: 12, color: theme.colors.textMuted, textTransform: "uppercase" },
  entityId: { display: "block", fontSize: 11, color: theme.colors.primary, fontFamily: theme.fonts.mono, marginTop: 2, wordBreak: "break-all" },
  details: { display: "flex", flexWrap: "wrap", gap: 4 },
  detailItem: { fontSize: 11, padding: "2px 6px", background: "rgba(99,102,241,0.08)", borderRadius: 4, color: theme.colors.textMuted },
  user: { fontSize: 12, color: theme.colors.textMuted },
  ip: { fontSize: 11, fontFamily: theme.fonts.mono, color: theme.colors.textMuted },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 20 },
  pageBtn: { padding: "8px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: theme.colors.card, color: theme.colors.text, fontSize: 13, cursor: "pointer" },
  pageInfo: { fontSize: 13, color: theme.colors.textMuted },
}; }

export default AuditLogPage;
