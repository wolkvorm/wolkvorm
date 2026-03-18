import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

// Maps resource type to API endpoint, display config, and optional create schema
const RESOURCE_CONFIG = {
  vpc: {
    endpoint: "/api/aws/vpcs",
    idField: "id",
    label: (item) => item.name ? `${item.name} (${item.id})` : item.id,
    detail: (item) => `${item.cidr}${item.is_default ? " - Default VPC" : ""}`,
    createSchemaId: "vpc",
  },
  subnet: {
    endpoint: "/api/aws/subnets",
    idField: "id",
    label: (item) => item.name ? `${item.name} (${item.id})` : item.id,
    detail: (item) => `${item.az} | ${item.cidr}${item.public ? " | Public" : ""}`,
    createSchemaId: "vpc",
  },
  "security-group": {
    endpoint: "/api/aws/security-groups",
    idField: "id",
    label: (item) => `${item.name} (${item.id})`,
    detail: (item) => item.description || "",
    createSchemaId: "security-group",
  },
  "key-pair": {
    endpoint: "/api/aws/key-pairs",
    idField: "name",
    label: (item) => item.name,
    detail: (item) => item.type,
    createSchemaId: "key-pair",
  },
  ami: {
    endpoint: "/api/aws/amis",
    idField: "id",
    label: (item) => item.id,
    detail: (item) => {
      const name = item.name || "";
      if (name.includes("al2023")) return `Amazon Linux 2023 (${item.architecture})`;
      if (name.includes("ubuntu") && name.includes("24.04")) return `Ubuntu 24.04 (${item.architecture})`;
      if (name.includes("ubuntu") && name.includes("22.04")) return `Ubuntu 22.04 (${item.architecture})`;
      return `${item.description || name} (${item.architecture})`;
    },
    // No createSchemaId — AMI is selection-only
  },
};

function AwsResourceSelect({ resourceType, region, multi, value, onChange, placeholder }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const config = RESOURCE_CONFIG[resourceType];

  // Selected values as array
  const selectedValues = multi
    ? (value || "").split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const fetchItems = useCallback(() => {
    if (!config) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (region) params.set("region", region);

    authFetch(`${API}${config.endpoint}?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setItems([]);
        } else {
          setItems(Array.isArray(data) ? data : []);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setItems([]);
        setLoading(false);
      });
  }, [config, region]);

  // Fetch when region changes
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Navigate to create page for the resource
  const handleCreate = () => {
    if (config?.createSchemaId) {
      window.open(`/resource/${config.createSchemaId}`, "_blank");
    }
  };

  if (!config) {
    return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} style={styles.input} />;
  }

  // Manual mode fallback
  if (manualMode) {
    return (
      <div style={styles.manualContainer}>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Enter ID manually..."}
          style={styles.input}
        />
        <button
          type="button"
          style={styles.switchBtn}
          onClick={() => setManualMode(false)}
          title="Switch to dropdown"
        >
          Browse
        </button>
        {config.createSchemaId && (
          <button
            type="button"
            style={styles.createBtn}
            onClick={handleCreate}
            title={`Create new ${resourceType}`}
          >
            + Create
          </button>
        )}
      </div>
    );
  }

  // Error state - show manual input with retry
  if (error && items.length === 0) {
    return (
      <div style={styles.manualContainer}>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Enter ID manually..."}
          style={styles.input}
        />
        <button
          type="button"
          style={styles.retryBtn}
          onClick={fetchItems}
          title="Retry loading from AWS"
        >
          Retry
        </button>
        {config.createSchemaId && (
          <button
            type="button"
            style={styles.createBtn}
            onClick={handleCreate}
            title={`Create new ${resourceType}`}
          >
            + Create
          </button>
        )}
      </div>
    );
  }

  // Filter items by search
  const filtered = items.filter((item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const id = (item[config.idField] || "").toLowerCase();
    const name = (item.name || "").toLowerCase();
    const desc = (item.description || "").toLowerCase();
    return id.includes(s) || name.includes(s) || desc.includes(s);
  });

  // Multi-select handlers
  const toggleItem = (itemId) => {
    if (multi) {
      const current = new Set(selectedValues);
      if (current.has(itemId)) {
        current.delete(itemId);
      } else {
        current.add(itemId);
      }
      onChange([...current].join(","));
    } else {
      onChange(itemId);
      setIsOpen(false);
      setSearch("");
    }
  };

  const removeItem = (itemId) => {
    const current = selectedValues.filter((v) => v !== itemId);
    onChange(current.join(","));
  };

  // Display value for single select
  const getDisplayValue = () => {
    if (!value) return "";
    const item = items.find((i) => i[config.idField] === value);
    if (item) return config.label(item);
    return value;
  };

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Multi-select: show selected tags */}
      {multi && selectedValues.length > 0 && (
        <div style={styles.tags}>
          {selectedValues.map((v) => {
            const item = items.find((i) => i[config.idField] === v);
            return (
              <span key={v} style={styles.tag}>
                <span style={styles.tagText}>{item ? config.label(item) : v}</span>
                <button
                  type="button"
                  style={styles.tagRemove}
                  onClick={(e) => { e.stopPropagation(); removeItem(v); }}
                >
                  x
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Input / trigger */}
      <div style={styles.inputRow}>
        <div
          style={{
            ...styles.selectTrigger,
            ...(isOpen ? styles.selectTriggerOpen : {}),
          }}
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setTimeout(() => searchRef.current?.focus(), 50);
          }}
        >
          {loading ? (
            <span style={styles.loadingText}>Loading...</span>
          ) : multi ? (
            <span style={styles.placeholder}>
              {selectedValues.length > 0 ? `${selectedValues.length} selected - click to add more` : (placeholder || "Select...")}
            </span>
          ) : (
            <span style={value ? styles.selectedText : styles.placeholder}>
              {value ? getDisplayValue() : (placeholder || "Select...")}
            </span>
          )}
          <span style={styles.chevron}>{isOpen ? "\u25B2" : "\u25BC"}</span>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          style={styles.refreshBtn}
          onClick={(e) => { e.stopPropagation(); fetchItems(); }}
          title="Refresh list from AWS"
        >
          ↻
        </button>

        {/* Manual entry button */}
        <button
          type="button"
          style={styles.switchBtn}
          onClick={() => setManualMode(true)}
          title="Enter ID manually"
        >
          Manual
        </button>

        {/* Create button — only if schema exists */}
        {config.createSchemaId && (
          <button
            type="button"
            style={styles.createBtn}
            onClick={handleCreate}
            title={`Create new ${resourceType}`}
          >
            + Create
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.searchRow}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={styles.searchInput}
              onClick={(e) => e.stopPropagation()}
            />
            <span style={styles.countLabel}>{filtered.length} found</span>
          </div>
          <div style={styles.itemList}>
            {filtered.length === 0 ? (
              <div style={styles.emptyMessage}>
                {loading ? "Loading..." : (
                  <div style={styles.emptyContent}>
                    <span>No resources found</span>
                    {config.createSchemaId && (
                      <button
                        type="button"
                        style={styles.emptyCreateBtn}
                        onClick={handleCreate}
                      >
                        + Create {resourceType === "subnet" ? "VPC" : resourceType.replace("-", " ")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              filtered.map((item) => {
                const itemId = item[config.idField];
                const isSelected = multi ? selectedValues.includes(itemId) : value === itemId;
                return (
                  <div
                    key={itemId}
                    style={{
                      ...styles.item,
                      ...(isSelected ? styles.itemSelected : {}),
                    }}
                    onClick={() => toggleItem(itemId)}
                  >
                    {multi && (
                      <span style={{
                        ...styles.checkbox,
                        ...(isSelected ? styles.checkboxChecked : {}),
                      }}>
                        {isSelected ? "\u2713" : ""}
                      </span>
                    )}
                    <div style={styles.itemContent}>
                      <div style={styles.itemLabel}>{config.label(item)}</div>
                      <div style={styles.itemDetail}>{config.detail(item)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme) => ({
  container: {
    position: "relative",
    width: "100%",
  },
  inputRow: {
    display: "flex",
    gap: 6,
  },
  selectTrigger: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 14,
    cursor: "pointer",
    minHeight: 42,
    transition: "border-color 0.2s",
  },
  selectTriggerOpen: {
    borderColor: theme.colors.primary,
  },
  placeholder: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  selectedText: {
    color: theme.colors.text,
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginLeft: 8,
    flexShrink: 0,
  },
  switchBtn: {
    padding: "8px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.textMuted,
    fontSize: 11,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  refreshBtn: {
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.textMuted,
    fontSize: 14,
    cursor: "pointer",
    flexShrink: 0,
    transition: "color 0.2s, border-color 0.2s",
    lineHeight: 1,
  },
  createBtn: {
    padding: "8px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.primary}50`,
    background: `${theme.colors.primary}15`,
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    transition: "background 0.2s, border-color 0.2s",
  },
  retryBtn: {
    padding: "8px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.warning}`,
    background: "rgba(245,158,11,0.1)",
    color: theme.colors.warning,
    fontSize: 11,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  manualContainer: {
    display: "flex",
    gap: 6,
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 14,
    outline: "none",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    zIndex: 100,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.primary}`,
    borderRadius: theme.radius.sm,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    overflow: "hidden",
  },
  searchRow: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    borderBottom: `1px solid ${theme.colors.border}`,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: 4,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 13,
    outline: "none",
  },
  countLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  itemList: {
    maxHeight: 280,
    overflowY: "auto",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    cursor: "pointer",
    borderBottom: `1px solid ${theme.colors.border}`,
    transition: "background 0.15s",
  },
  itemSelected: {
    background: "rgba(99,102,241,0.12)",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    border: `1.5px solid ${theme.colors.inputBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: theme.colors.primary,
    flexShrink: 0,
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    background: "rgba(99,102,241,0.2)",
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemLabel: {
    fontSize: 13,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  itemDetail: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  emptyMessage: {
    padding: "20px 14px",
    textAlign: "center",
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  emptyContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  emptyCreateBtn: {
    padding: "8px 16px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.primary}50`,
    background: `${theme.colors.primary}15`,
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    borderRadius: 4,
    background: "rgba(99,102,241,0.15)",
    border: `1px solid rgba(99,102,241,0.3)`,
    fontSize: 12,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
  },
  tagText: {
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagRemove: {
    background: "none",
    border: "none",
    color: theme.colors.textMuted,
    cursor: "pointer",
    fontSize: 12,
    padding: "0 2px",
    lineHeight: 1,
  },
});

export default AwsResourceSelect;
