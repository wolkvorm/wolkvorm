import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

// Extract ARN from terraform outputs (various possible field names)
function getResourceArn(outputs) {
  if (!outputs) return null;
  const arnKeys = ["arn", "bucket_arn", "s3_bucket_arn", "role_arn", "iam_role_arn",
    "function_arn", "lambda_function_arn", "cluster_arn", "db_instance_arn",
    "vpc_arn", "key_pair_arn", "policy_arn", "iam_policy_arn",
    "topic_arn", "sns_topic_arn", "queue_arn", "sqs_queue_arn",
    "repository_arn", "ecr_repository_arn", "distribution_arn",
    "lb_arn", "alb_arn", "security_group_arn", "acm_certificate_arn",
    "key_arn", "kms_key_arn", "secret_arn", "replication_group_arn",
    "cluster_endpoint", "id"];
  for (const key of arnKeys) {
    if (outputs[key] && typeof outputs[key] === "string" && outputs[key].length > 0) {
      return { key, value: outputs[key] };
    }
  }
  // Fallback: search for any key containing "arn"
  for (const [key, value] of Object.entries(outputs)) {
    if (key.toLowerCase().includes("arn") && typeof value === "string" && value.length > 0) {
      return { key, value };
    }
  }
  return null;
}

const SCHEMA_ICONS = {
  s3: "S3",
  ec2: "EC2",
  rds: "RDS",
  vpc: "VPC",
  eks: "EKS",
  lambda: "FN",
  ecs: "ECS",
  dynamodb: "DB",
  cloudfront: "CF",
  alb: "ALB",
  "iam-role": "IAM",
  "security-group": "SG",
  sns: "SNS",
  sqs: "SQS",
  ecr: "ECR",
  route53: "R53",
  acm: "ACM",
  kms: "KMS",
  elasticache: "EC",
  autoscaling: "AS",
  apigateway: "API",
  "secrets-manager": "SM",
  "iam-policy": "POL",
  "key-pair": "KEY",
};

function MyResourcesPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ schema: "", env: "", region: "" });
  const [stateReady, setStateReady] = useState(false);
  const [stateInfo, setStateInfo] = useState(null);
  const [stateInitializing, setStateInitializing] = useState(false);
  const [stateError, setStateError] = useState(null);
  const [copiedArn, setCopiedArn] = useState(null);

  useEffect(() => {
    fetchResources();
    fetchStateStatus();
  }, []);

  const fetchResources = () => {
    authFetch(`${API}/api/resources`)
      .then((res) => res.json())
      .then((data) => {
        setResources(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchStateStatus = () => {
    authFetch(`${API}/api/state`)
      .then((res) => res.json())
      .then((data) => {
        setStateReady(data.ready === true);
        if (data.ready) setStateInfo(data);
      })
      .catch(() => { });
  };

  const initState = async () => {
    setStateInitializing(true);
    setStateError(null);
    try {
      const res = await authFetch(`${API}/api/state/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        setStateError(data.error);
      } else {
        setStateReady(true);
        setStateInfo(data);
      }
    } catch (err) {
      setStateError(err.message);
    }
    setStateInitializing(false);
  };

  const activeResources = resources.filter((r) => r.status === "active" || r.status === "unknown");

  // Get unique values for filters
  const schemas = [...new Set(resources.map((r) => r.schema_id))];
  const envs = [...new Set(resources.map((r) => r.env))];
  const regions = [...new Set(resources.map((r) => r.region))];

  const filtered = activeResources.filter((r) => {
    if (filter.schema && r.schema_id !== filter.schema) return false;
    if (filter.env && r.env !== filter.env) return false;
    if (filter.region && r.region !== filter.region) return false;
    return true;
  });

  const handleDownloadOutputs = (resource) => {
    if (!resource.outputs || Object.keys(resource.outputs).length === 0) {
      alert("No outputs found for this resource. Did you apply it successfully?");
      return;
    }

    // Check if there's a private_key_pem
    if (resource.outputs.private_key_pem) {
      const blob = new Blob([resource.outputs.private_key_pem], { type: "application/x-pem-file" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resource.name}.pem`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Otherwise download as JSON
      const blob = new Blob([JSON.stringify(resource.outputs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resource.name}-outputs.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My Resources</h1>
          <p style={styles.subtitle}>
            Manage your deployed infrastructure resources
          </p>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.countBadge}>
            {activeResources.length} active resource{activeResources.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* State Backend Banner */}
      {!stateReady && (
        <div style={styles.stateBanner}>
          <div style={styles.stateBannerContent}>
            <div>
              <strong style={{ color: theme.colors.text }}>Remote State Backend Required</strong>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: theme.colors.textMuted }}>
                To track and manage resources, Wolkvorm needs an S3 bucket to store Terraform state files.
                This will create a bucket and DynamoDB table in your AWS account.
              </p>
              {stateError && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: theme.colors.danger }}>{stateError}</p>
              )}
            </div>
            <button
              style={styles.initBtn}
              onClick={initState}
              disabled={stateInitializing}
            >
              {stateInitializing ? "Initializing..." : "Initialize State Backend"}
            </button>
          </div>
        </div>
      )}

      {stateReady && stateInfo && (
        <div style={styles.stateInfoBar}>
          <span style={styles.stateInfoDot} />
          <span style={styles.stateInfoText}>
            State: <code style={styles.code}>{stateInfo.bucket}</code> ({stateInfo.region})
          </span>
        </div>
      )}

      {/* Filters */}
      {activeResources.length > 0 && (
        <div style={styles.filters}>
          <select
            style={styles.filterSelect}
            value={filter.schema}
            onChange={(e) => setFilter({ ...filter, schema: e.target.value })}
          >
            <option value="">All Types</option>
            {schemas.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            style={styles.filterSelect}
            value={filter.env}
            onChange={(e) => setFilter({ ...filter, env: e.target.value })}
          >
            <option value="">All Environments</option>
            {envs.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select
            style={styles.filterSelect}
            value={filter.region}
            onChange={(e) => setFilter({ ...filter, region: e.target.value })}
          >
            <option value="">All Regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {/* Resources Grid */}
      {loading ? (
        <div style={styles.emptyState}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={theme.colors.textMuted} strokeWidth="1.5" />
            </svg>
          </div>
          <h3 style={{ color: theme.colors.text, margin: "16px 0 8px" }}>No Resources Yet</h3>
          <p style={{ color: theme.colors.textMuted, fontSize: 14, margin: 0 }}>
            Deploy your first resource from the{" "}
            <Link to="/resources" style={{ color: theme.colors.primary }}>Resources</Link> page
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((resource) => (
            <div key={resource.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardIcon}>
                  {SCHEMA_ICONS[resource.schema_id] || resource.schema_id.slice(0, 3).toUpperCase()}
                </div>
                <div style={styles.cardInfo}>
                  <h3 style={styles.cardName}>{resource.name}</h3>
                  <span style={styles.cardType}>{resource.schema_name}</span>
                </div>
                <div style={{
                  ...styles.statusBadge,
                  background: resource.status === "active" ? "rgba(34,197,94,0.15)" :
                    resource.status === "unknown" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                  color: resource.status === "active" ? "#22c55e" :
                    resource.status === "unknown" ? "#f59e0b" : "#ef4444",
                }}>
                  {resource.status === "unknown" ? "unverified" : resource.status}
                </div>
              </div>

              <div style={styles.cardMeta}>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Region</span>
                  <span style={styles.metaValue}>{resource.region}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Environment</span>
                  <span style={styles.metaValue}>{resource.env}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Created</span>
                  <span style={styles.metaValue}>{resource.created_at}</span>
                </div>
              </div>

              {/* ARN / Resource ID row */}
              {(() => {
                const arnInfo = getResourceArn(resource.outputs);
                if (!arnInfo) return null;
                const isCopied = copiedArn === resource.id;
                return (
                  <div style={styles.arnRow}>
                    <div style={styles.arnContent}>
                      <span style={styles.arnLabel}>{arnInfo.key.replace(/_/g, ' ').toUpperCase()}</span>
                      <span style={styles.arnValue} title={arnInfo.value}>{arnInfo.value}</span>
                    </div>
                    <button
                      style={{
                        ...styles.copyBtn,
                        background: isCopied ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.1)',
                        color: isCopied ? '#22c55e' : theme.colors.primary,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Fallback for HTTP (navigator.clipboard requires HTTPS)
                        const textArea = document.createElement('textarea');
                        textArea.value = arnInfo.value;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        try { document.execCommand('copy'); } catch (err) { }
                        document.body.removeChild(textArea);
                        setCopiedArn(resource.id);
                        setTimeout(() => setCopiedArn(null), 2000);
                      }}
                    >
                      {isCopied ? '\u2713 Copied' : 'Copy'}
                    </button>
                  </div>
                );
              })()}

              <div style={styles.cardActions}>
                <Link
                  to={`/resource/${resource.schema_id}?edit=${resource.id}`}
                  style={styles.editBtn}
                >
                  Edit
                </Link>
                <Link
                  to={`/resource/${resource.schema_id}?edit=${resource.id}&action=plan`}
                  style={styles.planBtn}
                >
                  Plan
                </Link>
                <Link
                  to={`/resource/${resource.schema_id}?edit=${resource.id}&action=destroy`}
                  style={styles.destroyBtn}
                >
                  Destroy
                </Link>
              </div>
              {resource.outputs && Object.keys(resource.outputs).length > 0 && (
                <button
                  style={styles.outputsBtn}
                  onClick={() => handleDownloadOutputs(resource)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {resource.outputs.private_key_pem ? "Download Key (.pem)" : "Download Outputs"}
                </button>
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
    page: {
      maxWidth: 1200,
      margin: "0 auto",
      padding: "40px 32px",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 700,
      color: theme.colors.text,
      margin: 0,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textMuted,
      marginTop: 8,
    },
    headerRight: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    countBadge: {
      padding: "8px 16px",
      borderRadius: 20,
      background: "rgba(99,102,241,0.1)",
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: 600,
    },
    stateBanner: {
      background: "rgba(245,158,11,0.08)",
      border: `1px solid rgba(245,158,11,0.3)`,
      borderRadius: theme.radius.lg,
      padding: 24,
      marginBottom: 24,
    },
    stateBannerContent: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 24,
    },
    initBtn: {
      padding: "12px 24px",
      borderRadius: theme.radius.sm,
      border: "none",
      background: "#f59e0b",
      color: "#000",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap",
      flexShrink: 0,
    },
    stateInfoBar: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 16px",
      background: "rgba(34,197,94,0.06)",
      border: `1px solid rgba(34,197,94,0.2)`,
      borderRadius: theme.radius.sm,
      marginBottom: 24,
    },
    stateInfoDot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "#22c55e",
      flexShrink: 0,
    },
    stateInfoText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    code: {
      fontFamily: theme.fonts.mono,
      fontSize: 12,
      color: theme.colors.text,
      background: "rgba(99,102,241,0.1)",
      padding: "2px 6px",
      borderRadius: 4,
    },
    filters: {
      display: "flex",
      gap: 12,
      marginBottom: 24,
    },
    filterSelect: {
      padding: "8px 14px",
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border}`,
      background: theme.colors.card,
      color: theme.colors.text,
      fontSize: 13,
      cursor: "pointer",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
      gap: 16,
    },
    card: {
      background: theme.colors.card,
      borderRadius: theme.radius.lg,
      border: `1px solid ${theme.colors.border}`,
      padding: 20,
      transition: "border-color 0.2s",
    },
    cardHeader: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      marginBottom: 16,
    },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      background: "rgba(99,102,241,0.1)",
      color: theme.colors.primary,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 13,
      fontWeight: 800,
      fontFamily: theme.fonts.mono,
      flexShrink: 0,
    },
    cardInfo: {
      flex: 1,
      minWidth: 0,
    },
    cardName: {
      margin: 0,
      fontSize: 15,
      fontWeight: 600,
      color: theme.colors.text,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    cardType: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    statusBadge: {
      padding: "4px 10px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      textTransform: "capitalize",
      flexShrink: 0,
    },
    cardMeta: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 12,
      padding: "12px 0",
      borderTop: `1px solid ${theme.colors.border}`,
      borderBottom: `1px solid ${theme.colors.border}`,
      marginBottom: 12,
    },
    metaItem: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    metaLabel: {
      fontSize: 10,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    metaValue: {
      fontSize: 13,
      color: theme.colors.text,
      fontFamily: theme.fonts.mono,
    },
    arnRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      marginBottom: 12,
      background: "rgba(99,102,241,0.04)",
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border}`,
    },
    arnContent: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2,
    },
    arnLabel: {
      fontSize: 9,
      fontWeight: 700,
      color: theme.colors.textMuted,
      letterSpacing: 0.8,
    },
    arnValue: {
      fontSize: 11,
      color: theme.colors.text,
      fontFamily: theme.fonts.mono,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    copyBtn: {
      padding: "4px 10px",
      borderRadius: theme.radius.sm,
      border: "none",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      flexShrink: 0,
      transition: "all 0.2s",
    },
    cardActions: {
      display: "flex",
      gap: 8,
    },
    editBtn: {
      flex: 1,
      padding: "8px 0",
      textAlign: "center",
      borderRadius: theme.radius.sm,
      background: "rgba(99,102,241,0.1)",
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: 600,
      textDecoration: "none",
      transition: "background 0.2s",
    },
    planBtn: {
      flex: 1,
      padding: "8px 0",
      textAlign: "center",
      borderRadius: theme.radius.sm,
      background: "rgba(34,197,94,0.1)",
      color: "#22c55e",
      fontSize: 13,
      fontWeight: 600,
      textDecoration: "none",
      transition: "background 0.2s",
    },
    destroyBtn: {
      flex: 1,
      padding: "8px 0",
      textAlign: "center",
      borderRadius: theme.radius.sm,
      background: "rgba(239,68,68,0.1)",
      color: "#ef4444",
      fontSize: 13,
      fontWeight: 600,
      textDecoration: "none",
      transition: "background 0.2s",
    },
    outputsBtn: {
      width: "100%",
      padding: "8px 0",
      marginTop: 8,
      textAlign: "center",
      borderRadius: theme.radius.sm,
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.2s",
    },
    emptyState: {
      textAlign: "center",
      padding: "80px 20px",
    },
    emptyIcon: {
      display: "inline-block",
      padding: 20,
      borderRadius: "50%",
      background: "rgba(99,102,241,0.06)",
    },
  };
}

export default MyResourcesPage;
