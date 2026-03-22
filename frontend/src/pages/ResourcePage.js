import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import DynamicForm from "../components/DynamicForm";
import PlanModal from "../components/PlanModal";
import PRButton from "../components/PRButton";
import ConfirmModal from "../components/ConfirmModal";
import { useTheme } from "../contexts/ThemeContext";
import { useOperations } from "../contexts/OperationContext";

import { API, authFetch } from "../config";
import { useAuth } from "../contexts/AuthContext";

function ResourcePage() {
  const { canDeploy } = useAuth();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const editResourceId = searchParams.get("edit");
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { startOperation, getOperation } = useOperations();

  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState({});
  const [logs, setLogs] = useState("");
  const [showPlan, setShowPlan] = useState(false);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [region, setRegion] = useState("eu-central-1");
  const [env, setEnv] = useState("dev");
  const [planHistory, setPlanHistory] = useState([]);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [planModalTitle, setPlanModalTitle] = useState("Terraform Plan");
  const [costEstimate, setCostEstimate] = useState(null);
  const [costLoading, setCostLoading] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const activeOpRef = useRef(null);

  // Load default region from settings
  useEffect(() => {
    authFetch(`${API}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.aws?.default_region) {
          setRegion(data.aws.default_region);
        }
      })
      .catch(() => { });
  }, []);

  // Load existing resource data if in edit mode
  useEffect(() => {
    if (!editResourceId) return;
    authFetch(`${API}/api/resources/${editResourceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setEditingResource(data);
          setValues(data.inputs || {});
          if (data.region) setRegion(data.region);
          if (data.env) setEnv(data.env);
        }
      })
      .catch((err) => console.error("Resource load failed:", err));
  }, [editResourceId]);

  // Load schema
  useEffect(() => {
    authFetch(`${API}/api/schemas/${id}`)
      .then((res) => res.json())
      .then(setSchema)
      .catch((err) => console.error("Schema load failed:", err));
  }, [id]);

  // Load repos
  useEffect(() => {
    authFetch(`${API}/api/github/repos`)
      .then((res) => res.json())
      .then((data) => {
        if (data.repositories) {
          setRepos(data.repositories);
        } else if (Array.isArray(data)) {
          setRepos(data);
        }
      })
      .catch((err) => console.error("Repo fetch failed:", err));
  }, []);

  // Fetch plan history
  const fetchHistory = useCallback(() => {
    authFetch(`${API}/api/plan/history?schemaId=${id}`)
      .then((res) => res.json())
      .then((data) => setPlanHistory(Array.isArray(data) ? data : []))
      .catch(() => { });
  }, [id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const viewPlanDetail = async (planId) => {
    try {
      const res = await authFetch(`${API}/api/plan/history/${planId}`);
      const data = await res.json();
      setLogs(data.logs);
      setPlanModalTitle(`Plan: ${data.schema_name} (${data.env}) - ${data.created_at}`);
      setShowPlan(true);
    } catch (err) {
      console.error("Plan detail fetch failed:", err);
    }
  };

  const launchOp = useCallback((action, inputs, r, e) => {
    const titles = { plan: "Terraform Plan", apply: "Terraform Apply", destroy: "Terraform Destroy" };
    setPlanModalTitle(titles[action]);

    const opId = startOperation({
      schemaId: id,
      schemaName: schema?.name || id,
      action,
      inputs,
      region: r,
      env: e,
      resourceId: editResourceId || undefined,
    });
    activeOpRef.current = opId;
    setShowPlan(true);
  }, [id, schema, editResourceId, startOperation]);

  const handleSubmit = ({ inputs, region: r, env: e, action }) => {
    setRegion(r);
    setEnv(e);

    if (action === "apply" || action === "destroy") {
      setConfirmAction({ action, inputs, region: r, env: e });
      return;
    }

    if (action === "plan") {
      launchOp(action, inputs, r, e);
    }
  };

  const handleDownloadOutputs = () => {
    if (!editingResource || !editingResource.outputs || Object.keys(editingResource.outputs).length === 0) {
      alert("No outputs found for this resource.");
      return;
    }

    if (editingResource.outputs.private_key_pem) {
      const blob = new Blob([editingResource.outputs.private_key_pem], { type: "application/x-pem-file" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${editingResource.name}.pem`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(editingResource.outputs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${editingResource.name}-outputs.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const { action, inputs, region: r, env: e } = confirmAction;
    setConfirmAction(null);
    launchOp(action, inputs, r, e);
  };

  // Sync active operation logs/status into PlanModal
  const activeOp = activeOpRef.current ? getOperation(activeOpRef.current) : null;
  const displayLogs = activeOp ? activeOp.logs : logs;
  const isRunning = activeOp ? activeOp.status === "running" : false;

  // Refresh history when an operation completes
  const prevStatusRef = useRef(null);
  useEffect(() => {
    if (activeOp && prevStatusRef.current === "running" && activeOp.status !== "running") {
      fetchHistory();
    }
    prevStatusRef.current = activeOp?.status || null;
  }, [activeOp?.status, fetchHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!schema) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>Loading schema...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.breadcrumb}>
        <Link to={editingResource ? "/my-resources" : "/resources"} style={styles.backLink}>
          {editingResource ? "My Resources" : "Resources"}
        </Link>
        <span style={styles.separator}>/</span>
        <span style={styles.current}>
          {editingResource ? `Edit: ${editingResource.name}` : schema.name}
        </span>
      </div>

      {editingResource && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", marginBottom: 16,
          background: "rgba(99,102,241,0.08)",
          border: `1px solid rgba(99,102,241,0.2)`,
          borderRadius: theme.radius.sm,
        }}>
          <span style={{ fontSize: 13, color: theme.colors.primary, fontWeight: 600 }}>
            Editing existing resource
          </span>
          <span style={{ fontSize: 13, color: theme.colors.textMuted }}>
            Changes will be applied to the live infrastructure
          </span>
        </div>
      )}

      <div style={styles.layout}>
        <div style={styles.formPanel}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>{schema.name}</h2>
            <p style={styles.cardDesc}>{schema.description}</p>
            <DynamicForm
              schema={schema}
              values={values}
              onChange={setValues}
              onSubmit={handleSubmit}
              defaultRegion={region}
              onRegionChange={(r) => { setRegion(r); setCostEstimate(null); }}
              onEnvChange={setEnv}
              canDeploy={canDeploy}
            />
          </div>
        </div>

        <div style={styles.sidePanel}>
          {editingResource && (
            <div style={styles.card}>
              <h3 style={styles.sideTitle}>Outputs</h3>
              {editingResource.outputs && Object.keys(editingResource.outputs).length > 0 ? (
                <>
                  <p style={{ fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 }}>
                    This resource has {Object.keys(editingResource.outputs).length} output(s).
                  </p>
                  <button
                    style={styles.outputsBtn}
                    onClick={handleDownloadOutputs}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {editingResource.outputs.private_key_pem ? "Download Key (.pem)" : "Download Outputs JSON"}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 }}>
                    No outputs cached yet. Click below to fetch from Terraform state.
                  </p>
                  <button
                    style={styles.outputsBtn}
                    onClick={async () => {
                      try {
                        const btn = document.activeElement;
                        if (btn) btn.textContent = "Fetching...";
                        const res = await authFetch(`${API}/api/resources/${editingResource.id}/refresh-outputs`, { method: "POST" });
                        const data = await res.json();
                        if (data.error) {
                          alert("Error: " + data.error);
                        } else {
                          setEditingResource({ ...editingResource, outputs: data });
                        }
                      } catch (err) {
                        alert("Failed: " + err.message);
                      }
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Fetch Outputs
                  </button>
                </>
              )}
            </div>
          )}

          <div style={styles.card}>
            <h3 style={styles.sideTitle}>GitHub Integration</h3>
            <PRButton
              schemaId={id}
              inputs={values}
              env={env}
              repos={repos}
              selectedRepo={selectedRepo}
              onRepoChange={setSelectedRepo}
            />
          </div>

          <div style={styles.card}>
            <h3 style={styles.sideTitle}>Cost Estimation</h3>
            <button
              style={styles.costBtn}
              disabled={costLoading}
              onClick={async () => {
                setCostLoading(true);
                setCostEstimate(null);
                try {
                  const res = await authFetch(`${API}/api/cost-estimate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ schemaId: id, inputs: values, region, env }),
                  });
                  const data = await res.json();
                  setCostEstimate(data);
                } catch {
                  setCostEstimate({ available: false, error: "Request failed" });
                }
                setCostLoading(false);
              }}
            >
              {costLoading ? "Estimating..." : "Estimate Cost"}
            </button>
            {costEstimate && (
              <div style={styles.costResult}>
                {costEstimate.available ? (
                  <>
                    <div style={styles.costAmount}>
                      ${costEstimate.monthly_cost}
                      <span style={styles.costPeriod}>/month</span>
                    </div>
                    <div style={styles.costMeta}>
                      {costEstimate.resource_count} resources estimated
                    </div>
                  </>
                ) : (
                  <div style={styles.costUnavailable}>
                    {costEstimate.error}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={styles.card}>
            <h3 style={styles.sideTitle}>Schema Info</h3>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Provider</span>
              <span style={styles.infoValue}>
                {schema.provider.toUpperCase()}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Module</span>
              <span
                style={{
                  ...styles.infoValue,
                  fontSize: 11,
                  wordBreak: "break-all",
                }}
              >
                {schema.module.source}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Inputs</span>
              <span style={styles.infoValue}>{schema.inputs.length} fields</span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan History */}
      {planHistory.length > 0 && (
        <div style={styles.historySection}>
          <h3 style={styles.historyTitle}>Execution History</h3>
          <div style={styles.historyList}>
            {planHistory.map((plan) => (
              <div
                key={plan.id}
                style={{
                  ...styles.historyItem,
                  ...(expandedPlan === plan.id ? styles.historyItemActive : {}),
                }}
              >
                <div
                  style={styles.historyRow}
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                >
                  <div style={styles.historyLeft}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background:
                          plan.status === "success"
                            ? "rgba(34,197,94,0.15)"
                            : plan.status === "running"
                              ? "rgba(99,102,241,0.15)"
                              : "rgba(239,68,68,0.15)",
                        color:
                          plan.status === "success"
                            ? theme.colors.success
                            : plan.status === "running"
                              ? theme.colors.primary
                              : theme.colors.danger,
                      }}
                    >
                      {plan.status === "running" ? "Running" : plan.status === "success" ? "Success" : "Error"}
                    </span>
                    {plan.action && (
                      <span style={{
                        ...styles.actionBadge,
                        color: plan.action === "destroy" ? theme.colors.danger
                          : plan.action === "apply" ? "#22c55e"
                            : theme.colors.primary,
                        background: plan.action === "destroy" ? "rgba(239,68,68,0.1)"
                          : plan.action === "apply" ? "rgba(34,197,94,0.1)"
                            : "rgba(99,102,241,0.1)",
                      }}>{plan.action}</span>
                    )}
                    <span style={styles.historyName}>{plan.schema_name}</span>
                    <span style={styles.historyEnv}>{plan.env}</span>
                  </div>
                  <div style={styles.historyRight}>
                    {plan.duration && (
                      <span style={styles.historyDuration}>{plan.duration}</span>
                    )}
                    <span style={styles.historyTime}>{plan.created_at}</span>
                    <span style={styles.historyChevron}>
                      {expandedPlan === plan.id ? "\u25B2" : "\u25BC"}
                    </span>
                  </div>
                </div>
                {expandedPlan === plan.id && (
                  <div style={styles.historyExpanded}>
                    <pre style={styles.historyLogs}>{plan.logs}</pre>
                    <button
                      style={styles.viewFullBtn}
                      onClick={() => viewPlanDetail(plan.id)}
                    >
                      View Full Logs
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <PlanModal
        visible={showPlan}
        logs={displayLogs}
        title={planModalTitle}
        isRunning={isRunning}
        onClose={() => setShowPlan(false)}
      />

      <ConfirmModal
        visible={!!confirmAction}
        type={confirmAction?.action === "destroy" ? "danger" : "warning"}
        title={confirmAction?.action === "destroy" ? "Kaynağı Sil" : "Değişiklikleri Uygula"}
        message={confirmAction?.action === "destroy"
          ? "Bu işlem altyapı kaynaklarınızı kalıcı olarak SİLECEKTİR. Bu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?"
          : "Bu işlem altyapınızda gerçek değişiklikler yapacaktır. Devam etmek istediğinize emin misiniz?"
        }
        confirmText={confirmAction?.action === "destroy" ? "Evet, Sil" : "Evet, Uygula"}
        cancelText="İptal"
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />

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
    loading: {
      textAlign: "center",
      color: theme.colors.textMuted,
      padding: 60,
      fontSize: 16,
    },
    breadcrumb: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 28,
      fontSize: 14,
    },
    backLink: {
      color: theme.colors.primary,
      textDecoration: "none",
    },
    separator: {
      color: theme.colors.textMuted,
    },
    current: {
      color: theme.colors.text,
      fontWeight: 500,
    },
    layout: {
      display: "grid",
      gridTemplateColumns: "1fr 360px",
      gap: 24,
      alignItems: "start",
    },
    formPanel: {},
    sidePanel: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
    },
    card: {
      background: theme.colors.card,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      padding: 28,
    },
    cardTitle: {
      margin: "0 0 6px 0",
      fontSize: 22,
      fontWeight: 700,
      color: theme.colors.text,
    },
    cardDesc: {
      margin: "0 0 24px 0",
      fontSize: 14,
      color: theme.colors.textMuted,
      lineHeight: 1.5,
    },
    sideTitle: {
      margin: "0 0 16px 0",
      fontSize: 15,
      fontWeight: 600,
      color: theme.colors.text,
    },
    infoRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "8px 0",
      borderBottom: `1px solid ${theme.colors.border}`,
    },
    costBtn: {
      width: "100%",
      padding: "10px 16px",
      background: "rgba(245,158,11,0.1)",
      color: theme.colors.warning,
      border: `1px solid ${theme.colors.warning}`,
      borderRadius: theme.radius.sm,
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.2s",
    },
    costResult: {
      marginTop: 12,
      padding: 12,
      background: "rgba(99,102,241,0.05)",
      borderRadius: theme.radius.sm,
    },
    costAmount: {
      fontSize: 24,
      fontWeight: 700,
      color: theme.colors.text,
      fontFamily: theme.fonts.mono,
    },
    costPeriod: {
      fontSize: 13,
      fontWeight: 400,
      color: theme.colors.textMuted,
      marginLeft: 4,
    },
    costMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    costUnavailable: {
      fontSize: 12,
      color: theme.colors.textMuted,
      lineHeight: 1.5,
    },
    infoLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    outputsBtn: {
      width: "100%",
      padding: "8px 0",
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
    infoValue: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: 500,
    },
    historySection: {
      marginTop: 32,
    },
    historyTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: theme.colors.text,
      margin: "0 0 16px 0",
    },
    historyList: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
    },
    historyItem: {
      background: theme.colors.card,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      overflow: "hidden",
      transition: "border-color 0.2s",
    },
    historyItemActive: {
      borderColor: theme.colors.primary,
    },
    historyRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 20px",
      cursor: "pointer",
      transition: "background 0.15s",
    },
    historyLeft: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    statusBadge: {
      padding: "3px 10px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    actionBadge: {
      padding: "2px 8px",
      borderRadius: 8,
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    historyName: {
      fontSize: 14,
      fontWeight: 500,
      color: theme.colors.text,
    },
    historyEnv: {
      fontSize: 12,
      color: theme.colors.textMuted,
      background: "rgba(99,102,241,0.1)",
      padding: "2px 8px",
      borderRadius: 8,
    },
    historyRight: {
      display: "flex",
      alignItems: "center",
      gap: 16,
    },
    historyDuration: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.mono,
    },
    historyTime: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    historyChevron: {
      fontSize: 10,
      color: theme.colors.textMuted,
    },
    historyExpanded: {
      borderTop: `1px solid ${theme.colors.border}`,
      padding: 16,
      background: theme.colors.terminal,
    },
    historyLogs: {
      margin: 0,
      fontFamily: theme.fonts.mono,
      fontSize: 12,
      lineHeight: 1.5,
      color: theme.colors.terminalText,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      maxHeight: 200,
      overflow: "auto",
    },
    viewFullBtn: {
      marginTop: 12,
      padding: "6px 14px",
      background: theme.colors.primary,
      color: "#fff",
      border: "none",
      borderRadius: theme.radius.sm,
      fontSize: 12,
      fontWeight: 500,
      cursor: "pointer",
    },
  };
}

export default ResourcePage;
