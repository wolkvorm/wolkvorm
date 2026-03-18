import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import ResourcePage from "./pages/ResourcePage";
import MyResourcesPage from "./pages/MyResourcesPage";
import SettingsPage from "./pages/SettingsPage";
import AuditLogPage from "./pages/AuditLogPage";
import CostDashboardPage from "./pages/CostDashboardPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import PoliciesPage from "./pages/PoliciesPage";
import GraphPage from "./pages/GraphPage";
import ImportPage from "./pages/ImportPage";
import LoginPage from "./pages/LoginPage";
import SetupPage from "./pages/SetupPage";

// ProtectedRoute redirects to /login if the user is not authenticated.
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, needsSetup } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <div style={{ ...getStyles(theme).loading }}>
        <div style={{ ...getStyles(theme).spinner }} />
        <span style={{ color: theme.colors.textMuted, fontSize: 14 }}>Loading...</span>
      </div>
    );
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// PublicRoute redirects to / if the user is already authenticated.
// Does NOT redirect if password change is required.
function PublicRoute({ children }) {
  const { isAuthenticated, loading, mustChangePassword, needsSetup } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <div style={{ ...getStyles(theme).loading }}>
        <div style={{ ...getStyles(theme).spinner }} />
      </div>
    );
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (isAuthenticated && !mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// RequireRole redirects to / if user doesn't have the required role level.
function RequireRole({ children, check }) {
  const auth = useAuth();
  if (!check(auth)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppLayout() {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.colors.bg, color: theme.colors.text, fontFamily: theme.fonts.body }}>
      <Navbar />
      <main style={{ flex: 1, overflow: "auto", minHeight: "100vh" }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/resources" element={<HomePage />} />
          <Route path="/my-resources" element={<MyResourcesPage />} />
          <Route path="/resource/:id" element={<ResourcePage />} />
          <Route path="/settings" element={<RequireRole check={a => a.canAdmin}><SettingsPage /></RequireRole>} />
          <Route path="/costs" element={<CostDashboardPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/import" element={<RequireRole check={a => a.canImport}><ImportPage /></RequireRole>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/setup"
              element={
                <SetupPage />
              }
            />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function getStyles(theme) {
  return {
    loading: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      background: theme.colors.bg,
    },
    spinner: {
      width: 32,
      height: 32,
      border: `3px solid ${theme.colors.border}`,
      borderTopColor: theme.colors.primary,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    },
  };
}

export default App;
