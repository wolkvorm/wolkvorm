import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";

const INSTANCE_FAMILIES = [
  { label: "T3 - Burstable", value: "t3", sizes: ["nano", "micro", "small", "medium", "large", "xlarge", "2xlarge"] },
  { label: "T3a - Burstable (AMD)", value: "t3a", sizes: ["nano", "micro", "small", "medium", "large", "xlarge", "2xlarge"] },
  { label: "M5 - General Purpose", value: "m5", sizes: ["large", "xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge", "24xlarge"] },
  { label: "M6i - General Purpose", value: "m6i", sizes: ["large", "xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge", "24xlarge"] },
  { label: "M7i - General Purpose", value: "m7i", sizes: ["large", "xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge", "24xlarge"] },
  { label: "C5 - Compute Optimized", value: "c5", sizes: ["large", "xlarge", "2xlarge", "4xlarge", "9xlarge", "12xlarge", "18xlarge", "24xlarge"] },
  { label: "C6i - Compute Optimized", value: "c6i", sizes: ["large", "xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge", "24xlarge"] },
  { label: "C7i - Compute Optimized", value: "c7i", sizes: ["large", "xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge", "24xlarge"] },
  { label: "R5 - Memory Optimized", value: "r5", sizes: ["large", "xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge", "24xlarge"] },
  { label: "R6i - Memory Optimized", value: "r6i", sizes: ["large", "xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge", "24xlarge"] },
  { label: "G4dn - GPU", value: "g4dn", sizes: ["xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge"] },
  { label: "G5 - GPU", value: "g5", sizes: ["xlarge", "2xlarge", "4xlarge", "8xlarge", "12xlarge", "16xlarge", "24xlarge", "48xlarge"] },
  { label: "P3 - GPU (Training)", value: "p3", sizes: ["2xlarge", "8xlarge", "16xlarge"] },
];

const DEFAULT_NODE_GROUP = {
  name: "default",
  family: "t3",
  size: "medium",
  capacity_type: "ON_DEMAND",
  min_size: 1,
  max_size: 3,
  desired_size: 2,
};

function parseInstanceType(instanceType) {
  if (!instanceType) return { family: "t3", size: "medium" };
  const parts = instanceType.split(".");
  if (parts.length === 2) return { family: parts[0], size: parts[1] };
  return { family: "t3", size: "medium" };
}

function nodeGroupsFromValue(value) {
  if (Array.isArray(value) && value.length > 0) return value;
  return [{ ...DEFAULT_NODE_GROUP }];
}

function NodeGroupEditor({ value, onChange }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [groups, setGroups] = useState(() => nodeGroupsFromValue(value));

  useEffect(() => {
    if (Array.isArray(value) && value.length > 0) {
      const incoming = value.map((g) => {
        if (g.family && g.size) return g;
        const parsed = parseInstanceType(
          Array.isArray(g.instance_types) ? g.instance_types[0] : ""
        );
        return { ...g, family: parsed.family, size: parsed.size };
      });
      setGroups(incoming);
    }
  }, [value]);

  const syncToParent = useCallback(
    (newGroups) => {
      setGroups(newGroups);
      onChange(newGroups);
    },
    [onChange]
  );

  const addGroup = () => {
    const idx = groups.length + 1;
    syncToParent([
      ...groups,
      { ...DEFAULT_NODE_GROUP, name: `group-${idx}` },
    ]);
  };

  const removeGroup = (index) => {
    syncToParent(groups.filter((_, i) => i !== index));
  };

  const updateGroup = (index, field, val) => {
    const updated = [...groups];
    updated[index] = { ...updated[index], [field]: val };

    if (field === "family") {
      const fam = INSTANCE_FAMILIES.find((f) => f.value === val);
      if (fam && !fam.sizes.includes(updated[index].size)) {
        updated[index].size = fam.sizes[0];
      }
    }

    syncToParent(updated);
  };

  const getSizesForFamily = (family) => {
    const fam = INSTANCE_FAMILIES.find((f) => f.value === family);
    return fam ? fam.sizes : ["medium", "large", "xlarge"];
  };

  return (
    <div style={styles.container}>
      {groups.map((group, idx) => (
        <div key={idx} style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              Node Group {idx + 1}
            </span>
            {groups.length > 1 && (
              <button
                type="button"
                style={styles.deleteBtn}
                onClick={() => removeGroup(idx)}
              >
                Remove
              </button>
            )}
          </div>

          <div style={styles.cardBody}>
            {/* Row 1: Name + Capacity Type */}
            <div style={styles.row}>
              <div style={styles.fieldHalf}>
                <label style={styles.label}>Name</label>
                <input
                  style={styles.input}
                  type="text"
                  value={group.name || ""}
                  placeholder="default"
                  onChange={(e) => updateGroup(idx, "name", e.target.value)}
                />
              </div>
              <div style={styles.fieldHalf}>
                <label style={styles.label}>Capacity Type</label>
                <select
                  style={styles.select}
                  value={group.capacity_type || "ON_DEMAND"}
                  onChange={(e) =>
                    updateGroup(idx, "capacity_type", e.target.value)
                  }
                >
                  <option value="ON_DEMAND">On-Demand</option>
                  <option value="SPOT">Spot</option>
                </select>
              </div>
            </div>

            {/* Row 2: Instance Family + Size */}
            <div style={styles.row}>
              <div style={styles.fieldHalf}>
                <label style={styles.label}>Instance Family</label>
                <select
                  style={styles.select}
                  value={group.family || "t3"}
                  onChange={(e) => updateGroup(idx, "family", e.target.value)}
                >
                  {INSTANCE_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.fieldHalf}>
                <label style={styles.label}>Instance Size</label>
                <select
                  style={styles.select}
                  value={group.size || "medium"}
                  onChange={(e) => updateGroup(idx, "size", e.target.value)}
                >
                  {getSizesForFamily(group.family || "t3").map((s) => (
                    <option key={s} value={s}>
                      {group.family}.{s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Min / Max / Desired */}
            <div style={styles.row}>
              <div style={styles.fieldThird}>
                <label style={styles.label}>Min Size</label>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  value={group.min_size ?? 1}
                  onChange={(e) =>
                    updateGroup(idx, "min_size", parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div style={styles.fieldThird}>
                <label style={styles.label}>Max Size</label>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  value={group.max_size ?? 3}
                  onChange={(e) =>
                    updateGroup(idx, "max_size", parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <div style={styles.fieldThird}>
                <label style={styles.label}>Desired Size</label>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  value={group.desired_size ?? 2}
                  onChange={(e) =>
                    updateGroup(
                      idx,
                      "desired_size",
                      parseInt(e.target.value) || 0
                    )
                  }
                />
              </div>
            </div>

            {/* Instance type preview */}
            <div style={styles.instancePreview}>
              Instance type: <strong>{group.family || "t3"}.{group.size || "medium"}</strong>
            </div>
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <div style={styles.empty}>
          No node groups defined. Click "Add Node Group" to create one.
        </div>
      )}

      <div style={styles.addRow}>
        <button type="button" style={styles.addBtn} onClick={addGroup}>
          + Add Node Group
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
    card: {
      borderBottom: `1px solid ${theme.colors.border}`,
    },
    cardHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 14px",
      background: "rgba(99,102,241,0.06)",
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: theme.colors.text,
    },
    cardBody: {
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    row: {
      display: "flex",
      gap: 10,
    },
    fieldHalf: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    fieldThird: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: 600,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: "0.3px",
    },
    input: {
      width: "100%",
      padding: "7px 10px",
      borderRadius: 4,
      border: `1px solid ${theme.colors.inputBorder}`,
      background: theme.colors.input,
      color: theme.colors.text,
      fontSize: 13,
      outline: "none",
      boxSizing: "border-box",
    },
    select: {
      width: "100%",
      padding: "7px 10px",
      borderRadius: 4,
      border: `1px solid ${theme.colors.inputBorder}`,
      background: theme.colors.input,
      color: theme.colors.text,
      fontSize: 13,
      cursor: "pointer",
      boxSizing: "border-box",
    },
    instancePreview: {
      fontSize: 12,
      color: theme.colors.textMuted,
      padding: "6px 10px",
      background: "rgba(99,102,241,0.06)",
      borderRadius: 4,
    },
    deleteBtn: {
      padding: "4px 10px",
      borderRadius: 4,
      border: `1px solid rgba(239,68,68,0.3)`,
      background: "rgba(239,68,68,0.08)",
      color: "#ef4444",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
    },
    empty: {
      padding: "24px 14px",
      textAlign: "center",
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    addRow: {
      padding: "10px 14px",
      background: "rgba(99,102,241,0.03)",
    },
    addBtn: {
      padding: "8px 16px",
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

export default NodeGroupEditor;
