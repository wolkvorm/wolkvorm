import { useEffect, useRef, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";

// Parse terraform plan output and apply colors
function parseTerraformLine(line) {
  // Resource creation
  if (line.match(/^\s*\+\s/) || line.includes("will be created")) {
    return { color: "#22c55e", prefix: "+" };
  }
  // Resource destruction
  if (line.match(/^\s*-\s/) || line.includes("will be destroyed")) {
    return { color: "#ef4444", prefix: "-" };
  }
  // Resource modification
  if (line.match(/^\s*~\s/) || line.includes("will be updated") || line.includes("must be replaced")) {
    return { color: "#f59e0b", prefix: "~" };
  }
  // Plan summary line
  if (line.match(/Plan:\s+\d+\s+to add/)) {
    return { color: "#6366f1", bold: true };
  }
  // No changes
  if (line.includes("No changes") || line.includes("Infrastructure is up-to-date")) {
    return { color: "#22c55e", bold: true };
  }
  // Error lines
  if (line.match(/^\s*Error/i) || line.includes("error")) {
    return { color: "#ef4444" };
  }
  return null;
}

function PlanModal({ logs, onClose, visible, title = "Terraform Plan", isRunning = false }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Parse and colorize logs
  const colorizedLogs = useMemo(() => {
    if (!logs) return null;
    const lines = logs.split("\n");
    return lines.map((line, i) => {
      const style = parseTerraformLine(line);
      if (style) {
        return (
          <span key={i} style={{ color: style.color, fontWeight: style.bold ? 700 : 400 }}>
            {line}
            {"\n"}
          </span>
        );
      }
      return <span key={i}>{line}{"\n"}</span>;
    });
  }, [logs]);

  // Summary stats from plan output
  const planSummary = useMemo(() => {
    if (!logs) return null;
    const summaryMatch = logs.match(/Plan:\s+(\d+)\s+to add,\s+(\d+)\s+to change,\s+(\d+)\s+to destroy/);
    if (summaryMatch) {
      return {
        add: parseInt(summaryMatch[1]),
        change: parseInt(summaryMatch[2]),
        destroy: parseInt(summaryMatch[3]),
      };
    }
    if (logs.includes("No changes")) {
      return { add: 0, change: 0, destroy: 0, noChanges: true };
    }
    return null;
  }, [logs]);

  // Completion status from logs
  const completionStatus = useMemo(() => {
    if (!logs || isRunning) return null;

    // Apply complete
    const applyMatch = logs.match(/Apply complete! Resources: (\d+) added, (\d+) changed, (\d+) destroyed/);
    if (applyMatch) {
      return {
        type: "success",
        icon: "\u2705",
        title: "Apply Completed Successfully",
        detail: `${applyMatch[1]} added, ${applyMatch[2]} changed, ${applyMatch[3]} destroyed`,
      };
    }

    // Destroy complete
    const destroyMatch = logs.match(/Destroy complete! Resources: (\d+) destroyed/);
    if (destroyMatch) {
      return {
        type: "success",
        icon: "\ud83d\uddd1\ufe0f",
        title: "Destroy Completed Successfully",
        detail: `${destroyMatch[1]} resources destroyed`,
      };
    }

    // Plan completed (no errors)
    if (logs.includes("Plan:") && !logs.match(/Error:/i)) {
      const planMatch = logs.match(/Plan:\s+(\d+)\s+to add,\s+(\d+)\s+to change,\s+(\d+)\s+to destroy/);
      if (planMatch) {
        return {
          type: "info",
          icon: "\ud83d\udccb",
          title: "Plan Completed",
          detail: `${planMatch[1]} to add, ${planMatch[2]} to change, ${planMatch[3]} to destroy`,
        };
      }
    }

    // No changes
    if (logs.includes("No changes")) {
      return {
        type: "info",
        icon: "\u2714\ufe0f",
        title: "No Changes Required",
        detail: "Infrastructure is up-to-date",
      };
    }

    // Error
    if (logs.match(/Error:/i) || logs.includes("exit status 1")) {
      const errorMatch = logs.match(/Error:\s*(.+)/);
      return {
        type: "error",
        icon: "\u274c",
        title: "Operation Failed",
        detail: errorMatch ? errorMatch[1].substring(0, 120) : "Check logs above for details",
      };
    }

    return null;
  }, [logs, isRunning]);

  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.titleGroup}>
            <h2 style={styles.title}>{title}</h2>
            <div style={{
              ...styles.statusDot,
              background: isRunning
                ? theme.colors.warning
                : completionStatus?.type === "error"
                ? "#ef4444"
                : theme.colors.success,
              animation: isRunning ? "pulse 1s infinite" : "none",
            }} />
            {isRunning && <span style={styles.runningText}>Running...</span>}
            {!isRunning && completionStatus && (
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: completionStatus.type === "error" ? "#ef4444" : theme.colors.success,
              }}>
                {completionStatus.type === "error" ? "Failed" : "Completed"}
              </span>
            )}
          </div>

          <div style={styles.headerRight}>
            {/* Plan summary badges */}
            {planSummary && !planSummary.noChanges && (
              <div style={styles.summaryBadges}>
                {planSummary.add > 0 && (
                  <span style={{ ...styles.badge, background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                    +{planSummary.add} add
                  </span>
                )}
                {planSummary.change > 0 && (
                  <span style={{ ...styles.badge, background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                    ~{planSummary.change} change
                  </span>
                )}
                {planSummary.destroy > 0 && (
                  <span style={{ ...styles.badge, background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                    -{planSummary.destroy} destroy
                  </span>
                )}
              </div>
            )}
            {planSummary?.noChanges && (
              <span style={{ ...styles.badge, background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                No changes
              </span>
            )}

            <button style={styles.closeBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div style={styles.terminal} ref={terminalRef}>
          <pre style={styles.code}>
            {colorizedLogs || "Waiting for output..."}
          </pre>
          {completionStatus && (
            <div style={{
              ...styles.completionBanner,
              background: completionStatus.type === "success"
                ? "rgba(34,197,94,0.1)"
                : completionStatus.type === "error"
                ? "rgba(239,68,68,0.1)"
                : "rgba(99,102,241,0.1)",
              borderColor: completionStatus.type === "success"
                ? "#22c55e"
                : completionStatus.type === "error"
                ? "#ef4444"
                : "#6366f1",
            }}>
              <span style={styles.completionIcon}>{completionStatus.icon}</span>
              <div>
                <div style={{
                  ...styles.completionTitle,
                  color: completionStatus.type === "success"
                    ? "#22c55e"
                    : completionStatus.type === "error"
                    ? "#ef4444"
                    : "#6366f1",
                }}>
                  {completionStatus.title}
                </div>
                <div style={styles.completionDetail}>{completionStatus.detail}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStyles(theme) {
  return {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
  },
  modal: {
    width: "85%",
    maxWidth: 1000,
    height: "75%",
    background: theme.colors.terminal,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    background: theme.colors.card,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: theme.colors.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  runningText: {
    fontSize: 12,
    color: theme.colors.warning,
    fontWeight: 500,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  summaryBadges: {
    display: "flex",
    gap: 6,
  },
  badge: {
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: theme.fonts.mono,
  },
  closeBtn: {
    padding: "6px 16px",
    background: "transparent",
    color: theme.colors.textMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  terminal: {
    flex: 1,
    overflow: "auto",
    padding: 20,
  },
  code: {
    margin: 0,
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    lineHeight: 1.6,
    color: theme.colors.terminalText,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  completionBanner: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginTop: 16,
    padding: "16px 20px",
    borderRadius: 10,
    border: "1px solid",
  },
  completionIcon: {
    fontSize: 28,
    lineHeight: 1,
    flexShrink: 0,
  },
  completionTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  completionDetail: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.mono,
  },
};
}

export default PlanModal;
