import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";

// Predefined rule types with auto-filled protocol/port
const RULE_PRESETS = [
  { type: "All traffic", protocol: "all", from_port: 0, to_port: 0 },
  { type: "All TCP", protocol: "tcp", from_port: 0, to_port: 65535 },
  { type: "All UDP", protocol: "udp", from_port: 0, to_port: 65535 },
  { type: "Custom TCP", protocol: "tcp", from_port: null, to_port: null },
  { type: "Custom UDP", protocol: "udp", from_port: null, to_port: null },
  { type: "SSH", protocol: "tcp", from_port: 22, to_port: 22 },
  { type: "HTTP", protocol: "tcp", from_port: 80, to_port: 80 },
  { type: "HTTPS", protocol: "tcp", from_port: 443, to_port: 443 },
  { type: "MySQL/Aurora", protocol: "tcp", from_port: 3306, to_port: 3306 },
  { type: "PostgreSQL", protocol: "tcp", from_port: 5432, to_port: 5432 },
  { type: "MSSQL", protocol: "tcp", from_port: 1433, to_port: 1433 },
  { type: "Redis", protocol: "tcp", from_port: 6379, to_port: 6379 },
  { type: "MongoDB", protocol: "tcp", from_port: 27017, to_port: 27017 },
  { type: "RDP", protocol: "tcp", from_port: 3389, to_port: 3389 },
  { type: "DNS (TCP)", protocol: "tcp", from_port: 53, to_port: 53 },
  { type: "DNS (UDP)", protocol: "udp", from_port: 53, to_port: 53 },
  { type: "SMTP", protocol: "tcp", from_port: 25, to_port: 25 },
  { type: "SMTPS", protocol: "tcp", from_port: 465, to_port: 465 },
  { type: "NFS", protocol: "tcp", from_port: 2049, to_port: 2049 },
  { type: "Elasticsearch", protocol: "tcp", from_port: 9200, to_port: 9200 },
];

const SOURCE_PRESETS = [
  { label: "Anywhere (0.0.0.0/0)", value: "0.0.0.0/0" },
  { label: "Anywhere IPv6 (::/0)", value: "::/0" },
  { label: "Custom CIDR...", value: "custom" },
];

const DEFAULT_RULE = {
  type: "Custom TCP",
  protocol: "tcp",
  from_port: "",
  to_port: "",
  cidr: "0.0.0.0/0",
  description: "",
};

function SecurityGroupRules({ value, onChange, label }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [rules, setRules] = useState([]);

  // Initialize and sync from value prop
  useEffect(() => {
    if (Array.isArray(value) && value.length > 0) {
      setRules(value);
    }
  }, [value]);

  // Sync rules to parent
  const syncToParent = useCallback((newRules) => {
    setRules(newRules);
    onChange(newRules);
  }, [onChange]);

  const addRule = () => {
    syncToParent([...rules, { ...DEFAULT_RULE }]);
  };

  const removeRule = (index) => {
    const newRules = rules.filter((_, i) => i !== index);
    syncToParent(newRules);
  };

  const updateRule = (index, field, val) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: val };

    // If type changed, auto-fill protocol and ports
    if (field === "type") {
      const preset = RULE_PRESETS.find((p) => p.type === val);
      if (preset) {
        newRules[index].protocol = preset.protocol;
        if (preset.from_port !== null) {
          newRules[index].from_port = preset.from_port;
          newRules[index].to_port = preset.to_port;
        } else {
          newRules[index].from_port = "";
          newRules[index].to_port = "";
        }
      }
    }

    syncToParent(newRules);
  };

  const isCustomPort = (rule) => {
    return rule.type === "Custom TCP" || rule.type === "Custom UDP";
  };

  const getPortDisplay = (rule) => {
    if (rule.protocol === "all") return "All";
    if (rule.from_port === rule.to_port) return String(rule.from_port);
    return `${rule.from_port}-${rule.to_port}`;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.tableHeader}>
        <div style={styles.colType}>Type</div>
        <div style={styles.colProtocol}>Protocol</div>
        <div style={styles.colPort}>Port Range</div>
        <div style={styles.colSource}>Source / Dest</div>
        <div style={styles.colDesc}>Description</div>
        <div style={styles.colAction}></div>
      </div>

      {/* Rules */}
      {rules.map((rule, idx) => (
        <div key={idx} style={styles.row}>
          {/* Type */}
          <div style={styles.colType}>
            <select
              style={styles.select}
              value={rule.type || "Custom TCP"}
              onChange={(e) => updateRule(idx, "type", e.target.value)}
            >
              {RULE_PRESETS.map((p) => (
                <option key={p.type} value={p.type}>{p.type}</option>
              ))}
            </select>
          </div>

          {/* Protocol (auto-filled, read-only) */}
          <div style={styles.colProtocol}>
            <div style={styles.readonlyField}>
              {(rule.protocol || "tcp").toUpperCase()}
            </div>
          </div>

          {/* Port Range */}
          <div style={styles.colPort}>
            {isCustomPort(rule) ? (
              <input
                style={styles.portInput}
                type="text"
                placeholder="80 or 80-90"
                value={rule.from_port === rule.to_port ? (rule.from_port || "") : `${rule.from_port || ""}-${rule.to_port || ""}`}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes("-")) {
                    const [from, to] = val.split("-");
                    updateRule(idx, "from_port", parseInt(from) || 0);
                    // Directly update to_port too
                    const newRules = [...rules];
                    newRules[idx] = { ...newRules[idx], from_port: parseInt(from) || 0, to_port: parseInt(to) || 0 };
                    syncToParent(newRules);
                  } else {
                    const port = parseInt(val) || 0;
                    const newRules = [...rules];
                    newRules[idx] = { ...newRules[idx], from_port: port, to_port: port };
                    syncToParent(newRules);
                  }
                }}
              />
            ) : (
              <div style={styles.readonlyField}>
                {getPortDisplay(rule)}
              </div>
            )}
          </div>

          {/* Source / Destination */}
          <div style={styles.colSource}>
            {rule.cidr === "0.0.0.0/0" || rule.cidr === "::/0" ? (
              <select
                style={styles.select}
                value={rule.cidr}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    updateRule(idx, "cidr", "");
                  } else {
                    updateRule(idx, "cidr", e.target.value);
                  }
                }}
              >
                {SOURCE_PRESETS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            ) : (
              <div style={styles.cidrRow}>
                <input
                  style={styles.cidrInput}
                  type="text"
                  placeholder="10.0.0.0/16"
                  value={rule.cidr || ""}
                  onChange={(e) => updateRule(idx, "cidr", e.target.value)}
                  onBlur={(e) => {
                    // Auto-fix: add /32 for single IPs, /0 for 0.0.0.0
                    let val = e.target.value.trim();
                    if (val && !val.includes("/")) {
                      if (val === "0.0.0.0") {
                        val = "0.0.0.0/0";
                      } else {
                        val = val + "/32";
                      }
                      updateRule(idx, "cidr", val);
                    }
                  }}
                />
                <button
                  type="button"
                  style={styles.cidrResetBtn}
                  onClick={() => updateRule(idx, "cidr", "0.0.0.0/0")}
                  title="Reset to Anywhere"
                >
                  x
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div style={styles.colDesc}>
            <input
              style={styles.descInput}
              type="text"
              placeholder="Optional"
              value={rule.description || ""}
              onChange={(e) => updateRule(idx, "description", e.target.value)}
            />
          </div>

          {/* Delete */}
          <div style={styles.colAction}>
            <button
              type="button"
              style={styles.deleteBtn}
              onClick={() => removeRule(idx)}
              title="Delete rule"
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {/* Empty state */}
      {rules.length === 0 && (
        <div style={styles.emptyRow}>
          No rules defined. Click "Add Rule" to create one.
        </div>
      )}

      {/* Add button */}
      <div style={styles.addRow}>
        <button type="button" style={styles.addBtn} onClick={addRule}>
          + Add Rule
        </button>
      </div>
    </div>
  );
}

function getStyles(theme) {
  return {
  container: {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    background: "rgba(99,102,241,0.06)",
    borderBottom: `1px solid ${theme.colors.border}`,
    gap: 6,
  },
  row: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    borderBottom: `1px solid ${theme.colors.border}`,
    gap: 6,
  },
  colType: { flex: "0 0 150px", fontSize: 12, color: theme.colors.textMuted, fontWeight: 600 },
  colProtocol: { flex: "0 0 70px", fontSize: 12, color: theme.colors.textMuted, fontWeight: 600 },
  colPort: { flex: "0 0 90px", fontSize: 12, color: theme.colors.textMuted, fontWeight: 600 },
  colSource: { flex: "1 1 160px", fontSize: 12, color: theme.colors.textMuted, fontWeight: 600 },
  colDesc: { flex: "1 1 120px", fontSize: 12, color: theme.colors.textMuted, fontWeight: 600 },
  colAction: { flex: "0 0 55px", textAlign: "right", fontSize: 12, color: theme.colors.textMuted, fontWeight: 600 },
  select: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 4,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 12,
    cursor: "pointer",
  },
  readonlyField: {
    padding: "6px 8px",
    borderRadius: 4,
    background: "rgba(99,102,241,0.06)",
    border: `1px solid transparent`,
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  portInput: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 4,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 12,
    outline: "none",
  },
  cidrRow: {
    display: "flex",
    gap: 4,
  },
  cidrInput: {
    flex: 1,
    padding: "6px 8px",
    borderRadius: 4,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 12,
    outline: "none",
  },
  cidrResetBtn: {
    padding: "4px 8px",
    borderRadius: 4,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.textMuted,
    fontSize: 11,
    cursor: "pointer",
    flexShrink: 0,
  },
  descInput: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 4,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 12,
    outline: "none",
  },
  deleteBtn: {
    padding: "5px 8px",
    borderRadius: 4,
    border: `1px solid rgba(239,68,68,0.3)`,
    background: "rgba(239,68,68,0.08)",
    color: "#ef4444",
    fontSize: 11,
    cursor: "pointer",
    fontWeight: 600,
  },
  emptyRow: {
    padding: "20px 14px",
    textAlign: "center",
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  addRow: {
    padding: "8px 10px",
    background: "rgba(99,102,241,0.03)",
  },
  addBtn: {
    padding: "6px 16px",
    borderRadius: 4,
    border: `1px dashed ${theme.colors.border}`,
    background: "transparent",
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
};
}

export default SecurityGroupRules;
