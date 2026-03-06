import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

const NODE_COLORS = {
  vpc: "#6366f1",
  ec2: "#f59e0b",
  s3: "#22c55e",
  rds: "#3b82f6",
  "security-group": "#ef4444",
  lambda: "#8b5cf6",
  eks: "#06b6d4",
  alb: "#ec4899",
  elasticache: "#f97316",
  dynamodb: "#10b981",
};

function GraphPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const canvasRef = useRef(null);
  const [blastRadius, setBlastRadius] = useState(new Set());

  useEffect(() => {
    authFetch(`${API}/api/graph`)
      .then((r) => r.json())
      .then((data) => {
        setGraph(data);
        // Auto-layout nodes in a circle
        const positions = {};
        const count = data.nodes.length;
        const cx = 400, cy = 300, radius = Math.min(250, count * 40);
        data.nodes.forEach((n, i) => {
          const angle = (2 * Math.PI * i) / count - Math.PI / 2;
          positions[n.id] = {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
          };
        });
        setNodePositions(positions);
      })
      .catch(() => {});
  }, []);

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

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Resource Graph</h1>
          <p style={styles.subtitle}>Visualize dependencies between your infrastructure resources</p>
        </div>
        <div style={styles.legend}>
          {Object.entries(NODE_COLORS).slice(0, 6).map(([type, color]) => (
            <div key={type} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: color }} />
              <span style={styles.legendLabel}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {graph.nodes.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No managed resources found. Deploy some resources to see the dependency graph.</p>
        </div>
      ) : (
        <div style={styles.graphContainer}>
          <svg ref={canvasRef} style={styles.svg} viewBox="0 0 800 600">
            {/* Edges */}
            {graph.edges.map((e, i) => {
              const from = nodePositions[e.from];
              const to = nodePositions[e.to];
              if (!from || !to) return null;
              const isHighlighted = selectedNode && (e.from === selectedNode.id || blastRadius.has(e.from));
              return (
                <g key={i}>
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={isHighlighted ? theme.colors.danger : theme.colors.border}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeDasharray={isHighlighted ? "" : "4 4"}
                  />
                  <text
                    x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}
                    fill={theme.colors.textMuted} fontSize="9" textAnchor="middle"
                  >
                    {e.label}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {graph.nodes.map((n) => {
              const pos = nodePositions[n.id];
              if (!pos) return null;
              const isSelected = selectedNode?.id === n.id;
              const isBlasted = blastRadius.has(n.id);
              const color = NODE_COLORS[n.schema_id] || theme.colors.textMuted;
              return (
                <g key={n.id} onClick={() => handleNodeClick(n)} style={{ cursor: "pointer" }}>
                  <circle
                    cx={pos.x} cy={pos.y} r={isSelected ? 28 : 22}
                    fill={isBlasted ? `${theme.colors.danger}44` : `${color}33`}
                    stroke={isSelected ? theme.colors.text : isBlasted ? theme.colors.danger : color}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <text
                    x={pos.x} y={pos.y - 1}
                    fill={theme.colors.text} fontSize="10" fontWeight="600"
                    textAnchor="middle" dominantBaseline="middle"
                  >
                    {n.name.length > 10 ? n.name.substring(0, 10) + ".." : n.name}
                  </text>
                  <text
                    x={pos.x} y={pos.y + 32}
                    fill={color} fontSize="8" fontWeight="500"
                    textAnchor="middle"
                  >
                    {n.type}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Detail Panel */}
          {selectedNode && (
            <div style={styles.detailPanel}>
              <h3 style={styles.detailTitle}>{selectedNode.name}</h3>
              <div style={styles.detailRow}><span style={styles.detailLabel}>Type</span><span style={styles.detailValue}>{selectedNode.type}</span></div>
              <div style={styles.detailRow}><span style={styles.detailLabel}>Status</span><span style={{ ...styles.detailValue, color: selectedNode.status === "active" ? theme.colors.success : theme.colors.warning }}>{selectedNode.status}</span></div>
              <div style={styles.detailRow}><span style={styles.detailLabel}>Env</span><span style={styles.detailValue}>{selectedNode.env}</span></div>
              <div style={styles.detailRow}><span style={styles.detailLabel}>Region</span><span style={styles.detailValue}>{selectedNode.region}</span></div>
              {blastRadius.size > 0 && (
                <div style={styles.blastWarning}>
                  Blast Radius: {blastRadius.size} dependent resource(s) would be affected
                </div>
              )}
              <button style={styles.closeDetail} onClick={() => { setSelectedNode(null); setBlastRadius(new Set()); }}>Close</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getStyles(theme) {
  return {
  page: { maxWidth: 1200, margin: "0 auto", padding: "32px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: theme.colors.text },
  subtitle: { margin: "8px 0 0", fontSize: 15, color: theme.colors.textMuted },
  legend: { display: "flex", gap: 12, flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: "50%" },
  legendLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase" },
  emptyState: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: 60, textAlign: "center" },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },
  graphContainer: { position: "relative", background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, overflow: "hidden" },
  svg: { width: "100%", height: 600, display: "block" },
  detailPanel: { position: "absolute", top: 16, right: 16, width: 260, background: theme.colors.bg, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: 20 },
  detailTitle: { margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: theme.colors.text },
  detailRow: { display: "flex", justifyContent: "space-between", padding: "4px 0" },
  detailLabel: { fontSize: 12, color: theme.colors.textMuted },
  detailValue: { fontSize: 12, fontWeight: 500, color: theme.colors.text },
  blastWarning: { marginTop: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: theme.radius.sm, fontSize: 12, color: theme.colors.danger, fontWeight: 500 },
  closeDetail: { marginTop: 12, padding: "6px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}`, background: "transparent", color: theme.colors.text, fontSize: 12, cursor: "pointer", width: "100%" },
}; }

export default GraphPage;
