import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

import { API, authFetch } from "../config";

const RESOURCE_TYPES = [
  { id: "ec2", name: "EC2 Instances", icon: "Server" },
  { id: "s3", name: "S3 Buckets", icon: "Storage" },
  { id: "vpc", name: "VPCs", icon: "Network" },
  { id: "security-group", name: "Security Groups", icon: "Shield" },
];

function ImportPage() {
  const { canImport } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [scanning, setScanning] = useState(false);
  const [resources, setResources] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [env, setEnv] = useState("imported");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [scanInfo, setScanInfo] = useState(null);

  const handleScan = async () => {
    setScanning(true);
    setResources([]);
    setScanInfo(null);
    try {
      const res = await authFetch(`${API}/api/import/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_type: selectedType, region }),
      });
      const data = await res.json();
      setResources(data.resources || []);
      setScanInfo({ total: data.total_found, managed: data.already_managed });
      setStep(2);
    } catch (err) {
      alert("Scan failed: " + err.message);
    }
    setScanning(false);
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === resources.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(resources.map(r => r.id)));
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const selectedResources = resources.filter(r => selected.has(r.id));
    try {
      const res = await authFetch(`${API}/api/import/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resources: selectedResources, env }),
      });
      const data = await res.json();
      setResult(data);
      setStep(4);
    } catch (err) {
      alert("Import failed: " + err.message);
    }
    setImporting(false);
  };

  if (!canImport) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Import Resources</h1>
          <p style={styles.subtitle}>You do not have permission to import resources. Operator or higher role required.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Import Resources</h1>
        <p style={styles.subtitle}>Discover and import existing AWS resources into Wolkvorm</p>
      </div>

      {/* Steps indicator */}
      <div style={styles.steps}>
        {[1, 2, 3, 4].map(s => (
          <div key={s} style={{ ...styles.step, ...(s <= step ? styles.stepActive : {}) }}>
            <span style={styles.stepNum}>{s}</span>
            <span style={styles.stepLabel}>
              {s === 1 ? "Select Type" : s === 2 ? "Discover" : s === 3 ? "Configure" : "Complete"}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Select Type */}
      {step === 1 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Select resource type to scan</h3>
          <div style={styles.typeGrid}>
            {RESOURCE_TYPES.map(t => (
              <div
                key={t.id}
                style={{ ...styles.typeCard, ...(selectedType === t.id ? styles.typeSelected : {}) }}
                onClick={() => setSelectedType(t.id)}
              >
                <span style={styles.typeName}>{t.name}</span>
                <span style={styles.typeIcon}>{t.icon}</span>
              </div>
            ))}
          </div>

          <div style={styles.regionRow}>
            <label style={styles.label}>Region</label>
            <select style={styles.select} value={region} onChange={e => setRegion(e.target.value)}>
              <option value="us-east-1">us-east-1</option>
              <option value="us-west-2">us-west-2</option>
              <option value="eu-central-1">eu-central-1</option>
              <option value="eu-west-1">eu-west-1</option>
              <option value="ap-northeast-1">ap-northeast-1</option>
            </select>
          </div>

          <button
            style={{ ...styles.primaryBtn, opacity: !selectedType ? 0.5 : 1 }}
            onClick={handleScan}
            disabled={!selectedType || scanning}
          >
            {scanning ? "Scanning..." : "Scan AWS Account"}
          </button>
        </div>
      )}

      {/* Step 2: Discover */}
      {step === 2 && (
        <div style={styles.section}>
          <div style={styles.scanSummary}>
            {scanInfo && (
              <span style={styles.scanInfo}>
                Found {scanInfo.total} total, {scanInfo.managed} already managed, {resources.length} available to import
              </span>
            )}
          </div>

          {resources.length === 0 ? (
            <div style={styles.emptyBox}>
              <p>No unmanaged resources found of this type in {region}.</p>
              <button style={styles.backBtn} onClick={() => setStep(1)}>Back to Selection</button>
            </div>
          ) : (
            <>
              <div style={styles.selectAllRow}>
                <label style={styles.checkbox}>
                  <input type="checkbox" checked={selected.size === resources.length} onChange={selectAll} />
                  Select All ({resources.length})
                </label>
              </div>

              <div style={styles.resourceList}>
                {resources.map(r => (
                  <div key={r.id} style={{ ...styles.resourceCard, ...(selected.has(r.id) ? styles.resourceSelected : {}) }}>
                    <label style={styles.checkbox}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    </label>
                    <div style={styles.resourceInfo}>
                      <span style={styles.resourceName}>{r.name}</span>
                      <span style={styles.resourceId}>{r.id}</span>
                    </div>
                    <div style={styles.resourceDetails}>
                      {Object.entries(r.details || {}).map(([k, v]) => (
                        <span key={k} style={styles.detailTag}>{k}: {v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.actionRow}>
                <button style={styles.backBtn} onClick={() => setStep(1)}>Back</button>
                <button
                  style={{ ...styles.primaryBtn, opacity: selected.size === 0 ? 0.5 : 1 }}
                  onClick={() => setStep(3)}
                  disabled={selected.size === 0}
                >
                  Configure Import ({selected.size})
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Configure */}
      {step === 3 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Configure Import</h3>
          <p style={styles.configInfo}>
            {selected.size} resource(s) selected for import
          </p>
          <div style={styles.field}>
            <label style={styles.label}>Environment Label</label>
            <input style={styles.input} value={env} onChange={e => setEnv(e.target.value)} placeholder="e.g. imported, legacy, prod" />
          </div>
          <div style={styles.actionRow}>
            <button style={styles.backBtn} onClick={() => setStep(2)}>Back</button>
            <button style={styles.primaryBtn} onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${selected.size} Resource(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && result && (
        <div style={styles.section}>
          <div style={styles.successBox}>
            <h3 style={styles.successTitle}>Import Complete</h3>
            <p style={styles.successText}>
              Successfully imported {result.imported} of {result.total} resource(s).
            </p>
            <div style={styles.actionRow}>
              <button style={styles.backBtn} onClick={() => { setStep(1); setResult(null); setSelected(new Set()); setResources([]); }}>
                Import More
              </button>
              <a href="/my-resources" style={styles.primaryBtn}>View My Resources</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStyles(theme) {
  return {
    page: { maxWidth: 900, margin: "0 auto", padding: "32px" },
    header: { marginBottom: 24 },
    title: { margin: 0, fontSize: 28, fontWeight: 700, color: theme.colors.text },
    subtitle: { margin: "8px 0 0", fontSize: 15, color: theme.colors.textMuted },
    steps: { display: "flex", gap: 8, marginBottom: 24 },
    step: { flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, opacity: 0.5 },
    stepActive: { opacity: 1, borderColor: theme.colors.primary },
    stepNum: { width: 24, height: 24, borderRadius: "50%", background: theme.colors.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 },
    stepLabel: { fontSize: 13, fontWeight: 500, color: theme.colors.text },
    section: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: 24 },
    sectionTitle: { margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: theme.colors.text },
    typeGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 },
    typeCard: { padding: "20px", background: theme.colors.bg, border: `2px solid ${theme.colors.border}`, borderRadius: theme.radius.md, cursor: "pointer", textAlign: "center", transition: "border-color 0.2s" },
    typeSelected: { borderColor: theme.colors.primary, background: "rgba(99,102,241,0.08)" },
    typeName: { display: "block", fontSize: 15, fontWeight: 600, color: theme.colors.text },
    typeIcon: { display: "block", fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
    regionRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
    label: { fontSize: 13, fontWeight: 500, color: theme.colors.textMuted },
    select: { padding: "8px 12px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.inputBorder}`, background: theme.colors.input, color: theme.colors.text, fontSize: 13 },
    input: { padding: "10px 14px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.inputBorder}`, background: theme.colors.input, color: theme.colors.text, fontSize: 13, width: "100%", outline: "none" },
    primaryBtn: { padding: "10px 24px", borderRadius: theme.radius.sm, border: "none", background: theme.colors.primary, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" },
    backBtn: { padding: "10px 20px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: theme.colors.card, color: theme.colors.text, fontSize: 13, cursor: "pointer" },
    scanSummary: { marginBottom: 16 },
    scanInfo: { fontSize: 13, color: theme.colors.textMuted },
    selectAllRow: { marginBottom: 12 },
    checkbox: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.colors.text, cursor: "pointer" },
    resourceList: { display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflow: "auto" },
    resourceCard: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: theme.colors.bg, borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}` },
    resourceSelected: { borderColor: theme.colors.primary, background: "rgba(99,102,241,0.05)" },
    resourceInfo: { display: "flex", flexDirection: "column", gap: 2, minWidth: 150 },
    resourceName: { fontSize: 14, fontWeight: 600, color: theme.colors.text },
    resourceId: { fontSize: 11, color: theme.colors.textMuted, fontFamily: theme.fonts.mono },
    resourceDetails: { display: "flex", gap: 6, flexWrap: "wrap" },
    detailTag: { fontSize: 11, padding: "2px 6px", background: "rgba(99,102,241,0.08)", borderRadius: 4, color: theme.colors.textMuted },
    actionRow: { display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end" },
    field: { marginBottom: 16 },
    configInfo: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
    emptyBox: { textAlign: "center", padding: 40, color: theme.colors.textMuted },
    successBox: { textAlign: "center", padding: 40 },
    successTitle: { fontSize: 24, fontWeight: 700, color: theme.colors.success, margin: "0 0 8px" },
    successText: { fontSize: 15, color: theme.colors.textMuted, marginBottom: 24 },
  };
}

export default ImportPage;
