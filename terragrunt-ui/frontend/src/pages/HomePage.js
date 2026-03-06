import { useState, useEffect, useMemo } from "react";
import ResourceCard from "../components/ResourceCard";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

const categories = [
  { id: "all", label: "All" },
  { id: "compute", label: "Compute" },
  { id: "networking", label: "Networking" },
  { id: "database", label: "Database" },
  { id: "storage", label: "Storage" },
  { id: "messaging", label: "Messaging" },
  { id: "security", label: "Security" },
];

function HomePage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

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

  const filtered = useMemo(() => {
    return schemas.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "all" || s.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [schemas, search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts = { all: schemas.length };
    schemas.forEach((s) => {
      counts[s.category] = (counts[s.category] || 0) + 1;
    });
    return counts;
  }, [schemas]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>AWS Resources</h1>
            <p style={styles.subtitle}>
              Select a resource to configure and deploy with Terragrunt
            </p>
          </div>
          <div style={styles.countBadge}>
            {schemas.length} resources
          </div>
        </div>

        {/* Search */}
        <div style={styles.searchBox}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            style={styles.searchIcon}
          >
            <circle cx="11" cy="11" r="8" stroke="#64748b" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            style={styles.searchInput}
            placeholder="Search resources... (e.g. S3, Lambda, VPC)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              style={styles.clearBtn}
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}
        </div>

        {/* Category filter */}
        <div style={styles.categories}>
          {categories.map((cat) => (
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
                <span
                  style={{
                    ...styles.categoryCount,
                    ...(activeCategory === cat.id
                      ? styles.categoryCountActive
                      : {}),
                  }}
                >
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
          {schemas.length === 0
            ? "No resource schemas found. Make sure the backend is running."
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
    padding: "40px 32px",
  },
  header: {
    marginBottom: 32,
  },
  headerTop: {
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
  countBadge: {
    padding: "8px 16px",
    background: "rgba(99,102,241,0.1)",
    color: theme.colors.primary,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  searchBox: {
    position: "relative",
    marginBottom: 16,
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
    padding: "12px 40px 12px 42px",
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
    padding: "8px 16px",
    borderRadius: 20,
    border: `1px solid ${theme.colors.border}`,
    background: "transparent",
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
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
