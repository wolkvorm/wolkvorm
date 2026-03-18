import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ResourceCard from "../components/ResourceCard";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

const PROVIDERS = [
  { id: "aws",          label: "AWS",          color: "#FF9900", bg: "rgba(255,153,0,0.12)",   icon: "☁️" },
  { id: "azurerm",      label: "Azure",         color: "#0078D4", bg: "rgba(0,120,212,0.12)",   icon: "🔷" },
  { id: "google",       label: "GCP",           color: "#4285F4", bg: "rgba(66,133,244,0.12)",  icon: "🌐" },
  { id: "huaweicloud",  label: "Huawei",        color: "#CF0A2C", bg: "rgba(207,10,44,0.12)",   icon: "🔴" },
  { id: "digitalocean", label: "DigitalOcean",  color: "#0080FF", bg: "rgba(0,128,255,0.12)",   icon: "🌊" },
];

const CATEGORIES = [
  { id: "all",        label: "All" },
  { id: "compute",    label: "Compute" },
  { id: "networking", label: "Networking" },
  { id: "database",   label: "Database" },
  { id: "storage",    label: "Storage" },
  { id: "containers", label: "Containers" },
  { id: "messaging",  label: "Messaging" },
  { id: "security",   label: "Security" },
];

function HomePage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [searchParams, setSearchParams] = useSearchParams();

  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const activeProvider = searchParams.get("provider") || "aws";

  const setProvider = (id) => {
    setSearchParams({ provider: id });
    setActiveCategory("all");
    setSearch("");
  };

  useEffect(() => {
    authFetch(`${API}/api/schemas`)
      .then((res) => res.json())
      .then((data) => {
        setSchemas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load schemas:", err);
        setLoading(false);
      });
  }, []);

  const providerSchemas = useMemo(() =>
    schemas.filter((s) => s.provider === activeProvider),
    [schemas, activeProvider]
  );

  const filtered = useMemo(() => {
    return providerSchemas.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "all" || s.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [providerSchemas, search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts = { all: providerSchemas.length };
    providerSchemas.forEach((s) => {
      counts[s.category] = (counts[s.category] || 0) + 1;
    });
    return counts;
  }, [providerSchemas]);

  const providerCounts = useMemo(() => {
    const counts = {};
    schemas.forEach((s) => {
      counts[s.provider] = (counts[s.provider] || 0) + 1;
    });
    return counts;
  }, [schemas]);

  const currentProvider = PROVIDERS.find((p) => p.id === activeProvider) || PROVIDERS[0];

  return (
    <div style={styles.page}>
      {/* Provider Tab Bar */}
      <div style={styles.providerBar}>
        {PROVIDERS.map((p) => {
          const active = p.id === activeProvider;
          return (
            <button
              key={p.id}
              style={{
                ...styles.providerTab,
                ...(active ? { ...styles.providerTabActive, borderColor: p.color, color: p.color, background: p.bg } : {}),
              }}
              onClick={() => setProvider(p.id)}
            >
              <span style={styles.providerIcon}>{p.icon}</span>
              <span>{p.label}</span>
              {providerCounts[p.id] > 0 && (
                <span style={{
                  ...styles.providerCount,
                  background: active ? p.bg : "rgba(148,163,184,0.1)",
                  color: active ? p.color : theme.colors.textMuted,
                }}>
                  {providerCounts[p.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>{currentProvider.label} Resources</h1>
            <p style={styles.subtitle}>
              Select a resource to configure and deploy with Terraform
            </p>
          </div>
          <div style={{ ...styles.countBadge, background: currentProvider.bg, color: currentProvider.color }}>
            {providerSchemas.length} resources
          </div>
        </div>

        {/* Search */}
        <div style={styles.searchBox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
            <circle cx="11" cy="11" r="8" stroke="#64748b" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            style={styles.searchInput}
            placeholder={`Search ${currentProvider.label} resources...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button style={styles.clearBtn} onClick={() => setSearch("")}>×</button>
          )}
        </div>

        {/* Category filter — only show categories that have resources */}
        <div style={styles.categories}>
          {CATEGORIES.filter((cat) => cat.id === "all" || (categoryCounts[cat.id] || 0) > 0).map((cat) => (
            <button
              key={cat.id}
              style={{
                ...styles.categoryBtn,
                ...(activeCategory === cat.id ? styles.categoryActive : {}),
              }}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
              {categoryCounts[cat.id] > 0 && (
                <span style={{
                  ...styles.categoryCount,
                  ...(activeCategory === cat.id ? styles.categoryCountActive : {}),
                }}>
                  {categoryCounts[cat.id] || 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading resources...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          {providerSchemas.length === 0
            ? `No ${currentProvider.label} resource schemas found.`
            : "No resources match your search."}
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((schema) => (
            <ResourceCard key={schema.id} resource={schema} />
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
      padding: "32px 32px",
    },
    providerBar: {
      display: "flex",
      gap: 8,
      marginBottom: 28,
      flexWrap: "wrap",
    },
    providerTab: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "10px 18px",
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.border}`,
      background: "transparent",
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.18s",
      fontFamily: theme.fonts.body,
    },
    providerTabActive: {
      fontWeight: 700,
      borderWidth: 2,
    },
    providerIcon: {
      fontSize: 16,
      lineHeight: 1,
    },
    providerCount: {
      fontSize: 11,
      fontWeight: 600,
      padding: "1px 7px",
      borderRadius: 10,
    },
    header: {
      marginBottom: 28,
    },
    headerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    title: {
      fontSize: 26,
      fontWeight: 700,
      color: theme.colors.text,
      margin: 0,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 6,
    },
    countBadge: {
      padding: "8px 16px",
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: "nowrap",
    },
    searchBox: {
      position: "relative",
      marginBottom: 14,
    },
    searchIcon: {
      position: "absolute",
      left: 14,
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
    },
    searchInput: {
      width: "100%",
      padding: "11px 40px 11px 42px",
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.border}`,
      background: theme.colors.card,
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: theme.fonts.body,
      outline: "none",
      transition: "border-color 0.2s",
      boxSizing: "border-box",
    },
    clearBtn: {
      position: "absolute",
      right: 12,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      color: theme.colors.textMuted,
      fontSize: 20,
      cursor: "pointer",
      padding: "0 4px",
      lineHeight: 1,
    },
    categories: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    },
    categoryBtn: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "7px 14px",
      borderRadius: 20,
      border: `1px solid ${theme.colors.border}`,
      background: "transparent",
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.2s",
      fontFamily: theme.fonts.body,
    },
    categoryActive: {
      background: theme.colors.primary,
      borderColor: theme.colors.primary,
      color: "#fff",
    },
    categoryCount: {
      fontSize: 11,
      fontWeight: 600,
      padding: "1px 7px",
      borderRadius: 10,
      background: "rgba(148,163,184,0.15)",
      color: theme.colors.textMuted,
    },
    categoryCountActive: {
      background: "rgba(255,255,255,0.2)",
      color: "#fff",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: 16,
    },
    loading: {
      textAlign: "center",
      color: theme.colors.textMuted,
      padding: 60,
      fontSize: 16,
    },
    empty: {
      textAlign: "center",
      color: theme.colors.textMuted,
      padding: 60,
      fontSize: 16,
    },
  };
}

export default HomePage;
