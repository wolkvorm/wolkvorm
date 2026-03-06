import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

function DashboardPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [stats, setStats] = useState(null);
  const [recentHistory, setRecentHistory] = useState([]);
  const [schemas, setSchemas] = useState([]);

  useEffect(() => {
    // Fetch stats
    authFetch(`${API}/api/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});

    // Fetch recent history (all schemas)
    authFetch(`${API}/api/plan/history`)
      .then((r) => r.json())
      .then((data) => setRecentHistory(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => {});

    // Fetch schemas
    authFetch(`${API}/api/schemas`)
      .then((r) => r.json())
      .then((data) => setSchemas(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const successRate = stats && stats.total > 0
    ? Math.round((stats.success / stats.total) * 100)
    : 0;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>Overview of your infrastructure operations</p>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats?.total || 0}</span>
          <span style={styles.statLabel}>Total Executions</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: theme.colors.success }}>{stats?.success || 0}</span>
          <span style={styles.statLabel}>Successful</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: theme.colors.danger }}>{stats?.errors || 0}</span>
          <span style={styles.statLabel}>Failed</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: theme.colors.primary }}>{successRate}%</span>
          <span style={styles.statLabel}>Success Rate</span>
        </div>
      </div>

      {/* Action Breakdown */}
      <div style={styles.breakdownRow}>
        <div style={styles.breakdownCard}>
          <div style={styles.breakdownHeader}>Actions Breakdown</div>
          <div style={styles.breakdownItems}>
            <div style={styles.breakdownItem}>
              <span style={styles.breakdownDot("#6366f1")} />
              <span style={styles.breakdownLabel}>Plans</span>
              <span style={styles.breakdownValue}>{stats?.plans || 0}</span>
            </div>
            <div style={styles.breakdownItem}>
              <span style={styles.breakdownDot("#22c55e")} />
              <span style={styles.breakdownLabel}>Applies</span>
              <span style={styles.breakdownValue}>{stats?.applies || 0}</span>
            </div>
            <div style={styles.breakdownItem}>
              <span style={styles.breakdownDot("#ef4444")} />
              <span style={styles.breakdownLabel}>Destroys</span>
              <span style={styles.breakdownValue}>{stats?.destroys || 0}</span>
            </div>
          </div>
        </div>

        <div style={styles.breakdownCard}>
          <div style={styles.breakdownHeader}>Resources Available</div>
          <div style={styles.resourceGrid}>
            {schemas.slice(0, 8).map((s) => (
              <Link key={s.id} to={`/resource/${s.id}`} style={styles.miniResource}>
                <span style={styles.miniName}>{s.name}</span>
                <span style={styles.miniCategory}>{s.category}</span>
              </Link>
            ))}
            {schemas.length > 8 && (
              <Link to="/" style={styles.miniMore}>
                +{schemas.length - 8} more
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Recent Activity</h2>
        {recentHistory.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No executions yet. Go to a resource and run a plan to get started.</p>
            <Link to="/" style={styles.emptyLink}>Browse Resources</Link>
          </div>
        ) : (
          <div style={styles.activityList}>
            {recentHistory.map((item) => (
              <div key={item.id} style={styles.activityItem}>
                <div style={styles.activityLeft}>
                  <span style={{
                    ...styles.activityStatus,
                    background: item.status === "success" ? "rgba(34,197,94,0.15)"
                              : item.status === "running" ? "rgba(99,102,241,0.15)"
                              : "rgba(239,68,68,0.15)",
                    color: item.status === "success" ? theme.colors.success
                         : item.status === "running" ? theme.colors.primary
                         : theme.colors.danger,
                  }}>
                    {item.status}
                  </span>
                  {item.action && (
                    <span style={{
                      ...styles.activityAction,
                      color: item.action === "destroy" ? theme.colors.danger
                           : item.action === "apply" ? "#22c55e"
                           : theme.colors.primary,
                    }}>{item.action}</span>
                  )}
                  <Link to={`/resource/${item.schema_id}`} style={styles.activityName}>
                    {item.schema_name}
                  </Link>
                  <span style={styles.activityEnv}>{item.env}</span>
                </div>
                <div style={styles.activityRight}>
                  {item.duration && <span style={styles.activityDuration}>{item.duration}</span>}
                  <span style={styles.activityTime}>{item.created_at}</span>
                </div>
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
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 32px",
  },
  header: {
    marginBottom: 32,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: theme.colors.text,
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  statValue: {
    fontSize: 36,
    fontWeight: 700,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: 500,
  },
  breakdownRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 32,
  },
  breakdownCard: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  breakdownHeader: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: 16,
  },
  breakdownItems: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  breakdownItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  breakdownDot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  }),
  breakdownLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    flex: 1,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: 600,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
  },
  resourceGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  miniResource: {
    padding: "6px 12px",
    background: "rgba(99,102,241,0.08)",
    borderRadius: theme.radius.sm,
    textDecoration: "none",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    transition: "background 0.2s",
  },
  miniName: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.colors.text,
  },
  miniCategory: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  miniMore: {
    padding: "6px 12px",
    background: "rgba(99,102,241,0.05)",
    borderRadius: theme.radius.sm,
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 500,
    color: theme.colors.primary,
    display: "flex",
    alignItems: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: theme.colors.text,
    margin: "0 0 16px",
  },
  emptyState: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: 40,
    textAlign: "center",
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    margin: "0 0 16px",
  },
  emptyLink: {
    color: theme.colors.primary,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 14,
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  activityItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
  },
  activityLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  activityStatus: {
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  activityAction: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  activityName: {
    fontSize: 14,
    fontWeight: 500,
    color: theme.colors.text,
    textDecoration: "none",
  },
  activityEnv: {
    fontSize: 12,
    color: theme.colors.textMuted,
    background: "rgba(99,102,241,0.1)",
    padding: "2px 8px",
    borderRadius: 8,
  },
  activityRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  activityDuration: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.mono,
  },
  activityTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
};
}

export default DashboardPage;
