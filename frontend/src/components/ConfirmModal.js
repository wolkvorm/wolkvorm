import { useTheme } from "../contexts/ThemeContext";

function ConfirmModal({ visible, title, message, confirmText, cancelText, type, onConfirm, onCancel }) {
    const { theme } = useTheme();

    if (!visible) return null;

    const isDanger = type === "danger";
    const isWarning = type === "warning";
    const accentColor = isDanger ? "#ef4444" : isWarning ? "#f59e0b" : theme.colors.primary;

    return (
        <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            animation: "fadeIn 0.15s ease",
        }}>
            <div style={{
                background: theme.colors.card,
                borderRadius: theme.radius.lg,
                border: `1px solid ${theme.colors.border}`,
                padding: 0,
                maxWidth: 440,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                animation: "slideUp 0.2s ease",
                overflow: "hidden",
            }}>
                {/* Header with icon */}
                <div style={{
                    padding: "24px 28px 16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: isDanger ? "rgba(239,68,68,0.12)" : isWarning ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}>
                        {isDanger ? (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                                    stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{
                            margin: "0 0 8px",
                            fontSize: 17,
                            fontWeight: 700,
                            color: theme.colors.text,
                        }}>{title}</h3>
                        <p style={{
                            margin: 0,
                            fontSize: 14,
                            color: theme.colors.textMuted,
                            lineHeight: 1.6,
                        }}>{message}</p>
                    </div>
                </div>

                {/* Actions */}
                <div style={{
                    padding: "16px 28px 24px",
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: "10px 20px",
                            borderRadius: theme.radius.sm,
                            border: `1px solid ${theme.colors.border}`,
                            background: theme.colors.input,
                            color: theme.colors.text,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        {cancelText || "İptal"}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: "10px 24px",
                            borderRadius: theme.radius.sm,
                            border: "none",
                            background: accentColor,
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        {confirmText || "Onayla"}
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
        </div>
    );
}

export default ConfirmModal;
