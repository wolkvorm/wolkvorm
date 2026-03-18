import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { API, authFetch } from "../config";

// Service group colors
const GROUP_COLORS = {
  "IAM":              { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", dot: "#f59e0b" },
  "EC2":              { bg: "#fce7f3", border: "#ec4899", text: "#9d174d", dot: "#ec4899" },
  "S3":               { bg: "#d1fae5", border: "#10b981", text: "#065f46", dot: "#10b981" },
  "VPC / Networking": { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3", dot: "#6366f1" },
  "RDS":              { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af", dot: "#3b82f6" },
  "Lambda":           { bg: "#ede9fe", border: "#8b5cf6", text: "#5b21b6", dot: "#8b5cf6" },
  "EKS":              { bg: "#cffafe", border: "#06b6d4", text: "#155e75", dot: "#06b6d4" },
  "ECR":              { bg: "#fce7f3", border: "#f472b6", text: "#9d174d", dot: "#f472b6" },
  "DynamoDB":         { bg: "#d1fae5", border: "#059669", text: "#064e3b", dot: "#059669" },
  "ElastiCache":      { bg: "#ffedd5", border: "#f97316", text: "#9a3412", dot: "#f97316" },
  "Messaging":        { bg: "#fef9c3", border: "#eab308", text: "#854d0e", dot: "#eab308" },
  "Security":         { bg: "#fee2e2", border: "#ef4444", text: "#991b1b", dot: "#ef4444" },
  "MSK":              { bg: "#e0f2fe", border: "#0ea5e9", text: "#075985", dot: "#0ea5e9" },
  "Other":            { bg: "#f1f5f9", border: "#94a3b8", text: "#475569", dot: "#94a3b8" },
};

// Dark mode group colors
const GROUP_COLORS_DARK = {
  "IAM":              { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", text: "#fbbf24", dot: "#f59e0b" },
  "EC2":              { bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.3)", text: "#f472b6", dot: "#ec4899" },
  "S3":               { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.3)", text: "#34d399", dot: "#10b981" },
  "VPC / Networking": { bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.3)", text: "#818cf8", dot: "#6366f1" },
  "RDS":              { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)", text: "#60a5fa", dot: "#3b82f6" },
  "Lambda":           { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.3)", text: "#a78bfa", dot: "#8b5cf6" },
  "EKS":              { bg: "rgba(6,182,212,0.08)",  border: "rgba(6,182,212,0.3)",  text: "#22d3ee", dot: "#06b6d4" },
  "ECR":              { bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.3)", text: "#f472b6", dot: "#f472b6" },
  "DynamoDB":         { bg: "rgba(5,150,105,0.08)",  border: "rgba(5,150,105,0.3)",  text: "#34d399", dot: "#059669" },
  "ElastiCache":      { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)", text: "#fb923c", dot: "#f97316" },
  "Messaging":        { bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.3)",  text: "#facc15", dot: "#eab308" },
  "Security":         { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.3)",  text: "#f87171", dot: "#ef4444" },
  "MSK":              { bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.3)", text: "#38bdf8", dot: "#0ea5e9" },
  "Other":            { bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.3)", text: "#94a3b8", dot: "#94a3b8" },
};

const NODE_RADIUS = 26;
const GROUP_PADDING = 24;
const GROUP_HEADER = 32;
const NODE_SPACING_X = 100;
const NODE_SPACING_Y = 80;
const GROUP_GAP = 40;
const NODES_PER_ROW = 3;

function GraphPage() {
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);

  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [blastRadius, setBlastRadius] = useState(new Set());
  const [hoveredNode, setHoveredNode] = useState(null);

  useEffect(() => {
    authFetch(`${API}/api/graph`)
      .then((r) => r.json())
      .then((data) => {
        setGraph(data);
      })
      .catch(() => {});
  }, []);

  // Compute groups and positions
  const { groups, nodePositions, svgWidth, svgHeight } = useMemo(() => {
    const groupMap = {};
    graph.nodes.forEach((n) => {
      const g = n.group || "Other";
      if (!groupMap[g]) groupMap[g] = [];
      groupMap[g].push(n);
    });

    // Sort groups by size (largest first)
    const sortedGroupNames = Object.keys(groupMap).sort((a, b) => groupMap[b].length - groupMap[a].length);

    const positions = {};
    const groupBoxes = {};
    let cursorX = GROUP_GAP;

    // Layout groups in a row, wrapping as needed
    const maxRowWidth = 1200;
    let rowY = GROUP_GAP;
    let rowMaxHeight = 0;

    sortedGroupNames.forEach((groupName) => {
      const nodes = groupMap[groupName];
      const cols = Math.min(nodes.length, NODES_PER_ROW);
      const rows = Math.ceil(nodes.length / NODES_PER_ROW);

      const boxWidth = cols * NODE_SPACING_X + GROUP_PADDING * 2;
      const boxHeight = rows * NODE_SPACING_Y + GROUP_HEADER + GROUP_PADDING * 2;

      // Check if we need to wrap to next row
      if (cursorX + boxWidth + GROUP_GAP > maxRowWidth && cursorX > GROUP_GAP + 1) {
        rowY += rowMaxHeight + GROUP_GAP;
        cursorX = GROUP_GAP;
        rowMaxHeight = 0;
      }

      const boxX = cursorX;
      const boxY = rowY;

      groupBoxes[groupName] = { x: boxX, y: boxY, width: boxWidth, height: boxHeight, nodes };

      // Position nodes within the group
      nodes.forEach((n, i) => {
        const col = i % NODES_PER_ROW;
        const row = Math.floor(i / NODES_PER_ROW);
        positions[n.id] = {
          x: boxX + GROUP_PADDING + col * NODE_SPACING_X + NODE_SPACING_X / 2,
          y: boxY + GROUP_HEADER + GROUP_PADDING + row * NODE_SPACING_Y + NODE_SPACING_Y / 2,
        };
      });

      cursorX += boxWidth + GROUP_GAP;
      rowMaxHeight = Math.max(rowMaxHeight, boxHeight);
    });

    const maxHeight = rowY + rowMaxHeight + GROUP_GAP;
    const totalWidth = Math.max(maxRowWidth, cursorX + GROUP_GAP);

    return {
      groups: groupBoxes,
      nodePositions: positions,
      svgWidth: totalWidth,
      svgHeight: maxHeight,
    };
  }, [graph.nodes]);

  const getBlastRadius = useCallback((nodeId) => {
    const affected = new Set();
    const findDependents = (id) => {
      graph.edges.forEach((e) => {
        if (e.to === id && !affected.has(e.from)) {
          affected.add(e.from);
          findDependents(e.from);
        }
      });
    };
    findDependents(nodeId);
    return affected;
  }, [graph.edges]);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    const radius = getBlastRadius(node.id);
    setBlastRadius(radius);
  };

  const colorMap = isDark ? GROUP_COLORS_DARK : GROUP_COLORS;

  // Compute edge paths with curves
  const edgePaths = useMemo(() => {
    return graph.edges.map((e) => {
      const from = nodePositions[e.from];
      const to = nodePositions[e.to];
      if (!from || !to) return null;

      // Calculate direction for arrow
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return null;

      // Start/end points offset by node radius
      const sx = from.x + (dx / dist) * NODE_RADIUS;
      const sy = from.y + (dy / dist) * NODE_RADIUS;
      const ex = to.x - (dx / dist) * (NODE_RADIUS + 6);
      const ey = to.y - (dy / dist) * (NODE_RADIUS + 6);

      // Curved path
      const midX = (sx + ex) / 2;
      const midY = (sy + ey) / 2;
      const perpX = -(ey - sy) * 0.15;
      const perpY = (ex - sx) * 0.15;

      const path = `M ${sx} ${sy} Q ${midX + perpX} ${midY + perpY} ${ex} ${ey}`;

      return { ...e, path, from: nodePositions[e.from], to: nodePositions[e.to], sx, sy, ex, ey };
    }).filter(Boolean);
  }, [graph.edges, nodePositions]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Resource Graph</h1>
          <p style={styles.subtitle}>Visualize dependencies between your infrastructure resources</p>
        </div>
        <div style={styles.legend}>
          {Object.entries(colorMap).filter(([name]) => groups[name]).map(([name, c]) => (
            <div key={name} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: c.dot }} />
              <span style={styles.legendLabel}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {graph.nodes.length === 0 ? (
        <div style={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 16 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={styles.emptyText}>No managed resources found. Deploy some resources to see the dependency graph.</p>
        </div>
      ) : (
        <div style={styles.graphContainer}>
          <div style={styles.scrollContainer}>
            <svg style={{ width: svgWidth, height: svgHeight, display: "block", minWidth: "100%" }}>
              {/* Arrow marker definition */}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill={theme.colors.textMuted} opacity="0.6" />
                </marker>
                <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill={theme.colors.primary} />
                </marker>
                <marker id="arrowhead-danger" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill={theme.colors.danger} />
                </marker>
              </defs>

              {/* Group boxes */}
              {Object.entries(groups).map(([groupName, box]) => {
                const c = colorMap[groupName] || colorMap["Other"];
                return (
                  <g key={groupName}>
                    <rect
                      x={box.x} y={box.y}
                      width={box.width} height={box.height}
                      rx="12" ry="12"
                      fill={c.bg}
                      stroke={c.border}
                      strokeWidth="1.5"
                      strokeDasharray="none"
                    />
                    {/* Group header */}
                    <text
                      x={box.x + 16} y={box.y + 22}
                      fill={c.text}
                      fontSize="12" fontWeight="700"
                      letterSpacing="0.5"
                    >
                      {groupName}
                    </text>
                    {/* Node count */}
                    <text
                      x={box.x + box.width - 16} y={box.y + 22}
                      fill={c.text}
                      fontSize="10" fontWeight="500"
                      textAnchor="end"
                      opacity="0.6"
                    >
                      {box.nodes.length} resource{box.nodes.length > 1 ? "s" : ""}
                    </text>
                  </g>
                );
              })}

              {/* Edges with arrows */}
              {edgePaths.map((e, i) => {
                const isSelected = selectedNode && (e.from === selectedNode.id || e.to === selectedNode.id);
                const isBlast = selectedNode && blastRadius.has(e.from);
                const isHighlighted = isSelected || isBlast;
                const markerEnd = isBlast ? "url(#arrowhead-danger)" : isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)";

                return (
                  <g key={i}>
                    <path
                      d={e.path}
                      fill="none"
                      stroke={isBlast ? theme.colors.danger : isHighlighted ? theme.colors.primary : theme.colors.textMuted}
                      strokeWidth={isHighlighted ? 2.5 : 1.5}
                      strokeOpacity={isHighlighted ? 1 : 0.35}
                      markerEnd={markerEnd}
                    />
                    {/* Edge label */}
                    {isHighlighted && (
                      <text
                        x={(e.sx + e.ex) / 2}
                        y={(e.sy + e.ey) / 2 - 8}
                        fill={isBlast ? theme.colors.danger : theme.colors.primary}
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {e.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {graph.nodes.map((n) => {
                const pos = nodePositions[n.id];
                if (!pos) return null;
                const isSelected = selectedNode?.id === n.id;
                const isBlasted = blastRadius.has(n.id);
                const isHovered = hoveredNode === n.id;
                const gc = colorMap[n.group] || colorMap["Other"];
                const nodeRadius = isSelected ? NODE_RADIUS + 4 : isHovered ? NODE_RADIUS + 2 : NODE_RADIUS;

                return (
                  <g
                    key={n.id}
                    onClick={() => handleNodeClick(n)}
                    onMouseEnter={() => setHoveredNode(n.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Glow for selected */}
                    {(isSelected || isBlasted) && (
                      <circle
                        cx={pos.x} cy={pos.y} r={nodeRadius + 6}
                        fill="none"
                        stroke={isBlasted ? theme.colors.danger : theme.colors.primary}
                        strokeWidth="2"
                        strokeOpacity="0.3"
                      />
                    )}
                    {/* Node circle */}
                    <circle
                      cx={pos.x} cy={pos.y} r={nodeRadius}
                      fill={isBlasted ? `${theme.colors.danger}15` : isDark ? theme.colors.card : "#ffffff"}
                      stroke={isSelected ? theme.colors.primary : isBlasted ? theme.colors.danger : gc.border}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    {/* Node name */}
                    <text
                      x={pos.x} y={pos.y - 2}
                      fill={theme.colors.text}
                      fontSize="10" fontWeight="600"
                      textAnchor="middle" dominantBaseline="middle"
                    >
                      {n.name.length > 10 ? n.name.substring(0, 10) + ".." : n.name}
                    </text>
                    {/* Node type */}
                    <text
                      x={pos.x} y={pos.y + 12}
                      fill={gc.dot}
                      fontSize="8" fontWeight="500"
                      textAnchor="middle"
                      opacity="0.8"
                    >
                      {n.type}
                    </text>
                    {/* Status indicator */}
                    <circle
                      cx={pos.x + nodeRadius - 4}
                      cy={pos.y - nodeRadius + 4}
                      r="4"
                      fill={n.status === "active" ? theme.colors.success : theme.colors.warning}
                      stroke={isDark ? theme.colors.card : "#ffffff"}
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Detail Panel */}
          {selectedNode && (
            <div style={styles.detailPanel}>
              <div style={styles.detailHeader}>
                <div style={{ ...styles.detailDot, background: (colorMap[selectedNode.group] || colorMap["Other"]).dot }} />
                <h3 style={styles.detailTitle}>{selectedNode.name}</h3>
              </div>
              <div style={styles.detailGrid}>
                <div style={styles.detailRow}><span style={styles.detailLabel}>Type</span><span style={styles.detailValue}>{selectedNode.type}</span></div>
                <div style={styles.detailRow}><span style={styles.detailLabel}>Group</span><span style={styles.detailValue}>{selectedNode.group}</span></div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Status</span>
                  <span style={{ ...styles.detailValue, color: selectedNode.status === "active" ? theme.colors.success : theme.colors.warning }}>{selectedNode.status}</span>
                </div>
                <div style={styles.detailRow}><span style={styles.detailLabel}>Env</span><span style={styles.detailValue}>{selectedNode.env}</span></div>
                <div style={styles.detailRow}><span style={styles.detailLabel}>Region</span><span style={styles.detailValue}>{selectedNode.region}</span></div>
              </div>
              {blastRadius.size > 0 && (
                <div style={styles.blastWarning}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Blast Radius: <strong>{blastRadius.size}</strong> dependent resource{blastRadius.size > 1 ? "s" : ""} affected</span>
                </div>
              )}
              <button style={styles.closeDetail} onClick={() => { setSelectedNode(null); setBlastRadius(new Set()); }}>
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getStyles(theme) {
  return {
    page: { maxWidth: 1400, margin: "0 auto", padding: "32px" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 },
    title: { margin: 0, fontSize: 28, fontWeight: 700, color: theme.colors.text },
    subtitle: { margin: "8px 0 0", fontSize: 15, color: theme.colors.textMuted },
    legend: { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" },
    legendItem: { display: "flex", alignItems: "center", gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
    legendLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: 500 },
    emptyState: {
      background: theme.colors.card, border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg, padding: 60, textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center",
    },
    emptyText: { color: theme.colors.textMuted, fontSize: 14, margin: 0 },
    graphContainer: {
      position: "relative",
      background: theme.colors.card,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: "hidden",
    },
    scrollContainer: {
      overflow: "auto",
      maxHeight: "calc(100vh - 180px)",
      padding: 16,
    },
    detailPanel: {
      position: "absolute", top: 16, right: 16, width: 280,
      background: theme.colors.bg,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      padding: 20,
      boxShadow: "0 8px 32px -4px rgba(0,0,0,0.2)",
      animation: "fadeIn 0.2s ease-out",
    },
    detailHeader: {
      display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
    },
    detailDot: {
      width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
    },
    detailTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: theme.colors.text },
    detailGrid: { display: "flex", flexDirection: "column", gap: 4 },
    detailRow: { display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${theme.colors.border}22` },
    detailLabel: { fontSize: 12, color: theme.colors.textMuted },
    detailValue: { fontSize: 12, fontWeight: 500, color: theme.colors.text },
    blastWarning: {
      marginTop: 14, padding: "10px 12px",
      background: "rgba(239,68,68,0.1)", borderRadius: theme.radius.sm,
      fontSize: 12, color: theme.colors.danger, fontWeight: 500,
      display: "flex", alignItems: "center", gap: 8,
    },
    closeDetail: {
      marginTop: 14, padding: "8px 16px",
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border}`,
      background: "transparent", color: theme.colors.text,
      fontSize: 12, cursor: "pointer", width: "100%",
      fontWeight: 500, transition: "background 0.15s",
    },
  };
}

export default GraphPage;
