const darkTheme = {
  colors: {
    bg: "#0f172a",
    card: "#1e293b",
    cardHover: "#334155",
    primary: "#6366f1",
    primaryHover: "#818cf8",
    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f59e0b",
    text: "#f8fafc",
    textMuted: "#94a3b8",
    border: "#334155",
    terminal: "#020617",
    terminalText: "#22c55e",
    input: "#0f172a",
    inputBorder: "#475569",
  },
  fonts: {
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
  },
};

const lightTheme = {
  colors: {
    bg: "#f1f5f9",
    card: "#ffffff",
    cardHover: "#f8fafc",
    primary: "#6366f1",
    primaryHover: "#4f46e5",
    success: "#16a34a",
    danger: "#dc2626",
    warning: "#d97706",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    terminal: "#f8fafc",
    terminalText: "#16a34a",
    input: "#ffffff",
    inputBorder: "#cbd5e1",
  },
  fonts: darkTheme.fonts,
  radius: darkTheme.radius,
};

// Default export for backward compat
const theme = darkTheme;
export { darkTheme, lightTheme };
export default theme;
