import { useMemo, useState, useEffect } from "react";
import { useOperations } from "../contexts/OperationContext";
import { useTheme } from "../contexts/ThemeContext";

function OperationBars() {
  const { operations, dismissOperation, toggleExpand } = useOperations();
  const { theme } = useTheme();

  const visible = operations.filter((op) => op.status !== "dismissed");

  if (visible.length === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column-reverse", gap: 8 }}>
      {visible.map((op) => (
        <OperationBar
          key={op.id}
          op={op}
          theme={theme}
          onDismiss={() => dismissOperation(op.id)}
          onToggle={() => toggleExpand(op.id)}
        />
      ))}
    </div>
  );
}

function OperationBar({ op, theme, onDismiss, onToggle }) {
  const elapsed = useElapsed(op);
  const lastLines = useMemo(() => {
    const lines = op.logs.split("\n").filter(Boolean);
    return lines.slice(-15).join("\n");
  }, [op.logs]);

  const isRunning = op.status === "running";
  const isError = op.status === "error";
  const accentColor = isRunning
    ? theme.colors.warning
    : isError
    ? "#ef4444"
    : "#22c55e";

  const actionLabel = { plan: "Plan", apply: "Apply", destroy: "Destroy" }[op.action] || op.action;

  return (
    <div style={{ width: op.expanded ? 520 : 360, background: theme.colors.card, border: `1px solid ${accentColor}`, borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", overflow: "hidden", transition: "width 0.2s" }}>
      {/* Header bar */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
      >
        {/* Status dot */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: accentColor,
            flexShrink: 0,
            ...(isRunning ? { animation: "pulse 1.5s infinite" } : {}),
          }}
        />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {op.schemaName} — {actionLabel}
          </div>
          <div style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 1 }}>
            {isRunning
              ? `Running... ${elapsed}`
              : isError
              ? `Failed (${op.duration || elapsed})`
              : `Completed (${op.duration || elapsed})`}
          </div>
        </div>

        {/* Expand arrow */}
        <span style={{ fontSize: 10, color: theme.colors.textMuted }}>
          {op.expanded ? "\u25BC" : "\u25B2"}
        </span>

        {/* Dismiss */}
        {!isRunning && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            style={{
              background: "none",
              border: "none",
              color: theme.colors.textMuted,
              fontSize: 16,
              cursor: "pointer",
              padding: "0 4px",
              lineHeight: 1,
            }}
            title="Dismiss"
          >
            \u00D7
          </button>
        )}
      </div>

      {/* Mini log viewer */}
      {op.expanded && (
        <div
          style={{
            maxHeight: 220,
            overflow: "auto",
            padding: "8px 12px",
            background: "rgba(0,0,0,0.25)",
            borderTop: `1px solid ${theme.colors.border}`,
            fontFamily: theme.fonts.mono,
            fontSize: 11,
            lineHeight: 1.5,
            color: theme.colors.textMuted,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {lastLines || "Waiting for output..."}
        </div>
      )}
    </div>
  );
}

function useElapsed(op) {
  const [, setTick] = useState(0);
  const isRunning = op.status === "running";

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const diff = Math.floor((Date.now() - op.startedAt) / 1000);
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}m${s}s`;
}

export default OperationBars;
