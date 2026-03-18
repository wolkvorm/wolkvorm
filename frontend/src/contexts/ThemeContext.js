import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { darkTheme, lightTheme } from "../styles/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem("tf_theme") || "dark";
    } catch {
      return "dark";
    }
  });

  const theme = useMemo(
    () => (mode === "dark" ? darkTheme : lightTheme),
    [mode]
  );

  useEffect(() => {
    try {
      localStorage.setItem("tf_theme", mode);
    } catch {}
    // Update body styles
    document.body.style.background = theme.colors.bg;
    document.body.style.color = theme.colors.text;
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode, theme]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({ theme, mode, toggleTheme, isDark: mode === "dark" }),
    [theme, mode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export default ThemeContext;
