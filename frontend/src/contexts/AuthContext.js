import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API, getToken, setToken } from "../config";

const AuthContext = createContext(null);

// Role hierarchy levels
const ROLE_LEVELS = { viewer: 1, deployer: 2, operator: 3, admin: 4 };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  // Temporary storage for password change flow
  const [pendingUser, setPendingUser] = useState(null);

  // Check if this is a fresh install
  useEffect(() => {
    fetch(`${API}/api/auth/setup-status`)
      .then((res) => res.json())
      .then((data) => setNeedsSetup(data.needs_setup === true))
      .catch(() => { });
  }, []);

  // Validate token and load user on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Try to restore session from token
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Invalid token");
      })
      .then((data) => {
        if (data.must_change_password) {
          // Don't fully authenticate — force password change
          setPendingUser(data);
          setMustChangePassword(true);
        } else {
          setUser(data);
          localStorage.setItem("tf_user", JSON.stringify(data));
        }
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem("tf_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    // Always store the token (needed for change-password call)
    setToken(data.token);

    if (data.user?.must_change_password) {
      // Do NOT set user — keeps isAuthenticated = false
      // Store pending user and flag for password change
      setPendingUser(data.user);
      setMustChangePassword(true);
    } else {
      setUser(data.user);
      localStorage.setItem("tf_user", JSON.stringify(data.user));
    }

    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("tf_user");
    setUser(null);
    setMustChangePassword(false);
    setPendingUser(null);
  }, []);

  const completeSetup = useCallback((token, userData) => {
    setToken(token);
    setUser(userData);
    setNeedsSetup(false);
    localStorage.setItem("tf_user", JSON.stringify(userData));
  }, []);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const token = getToken();
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Password change failed");
      }

      // Update token and user after password change
      if (data.token) {
        setToken(data.token);
      }
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("tf_user", JSON.stringify(data.user));
      }

      // Clear password change state
      setMustChangePassword(false);
      setPendingUser(null);

      return data;
    },
    []
  );

  // Permission helpers based on role hierarchy
  const role = user?.role || pendingUser?.role || "viewer";
  const roleLevel = ROLE_LEVELS[role] || 0;

  const value = {
    user,
    loading,
    login,
    logout,
    changePassword,
    completeSetup,
    isAuthenticated: !!user,
    mustChangePassword,
    needsSetup,
    pendingUser,
    // Role and permission helpers
    role,
    canView: roleLevel >= ROLE_LEVELS.viewer,
    canDeploy: roleLevel >= ROLE_LEVELS.deployer,
    canOperate: roleLevel >= ROLE_LEVELS.operator,
    canAdmin: roleLevel >= ROLE_LEVELS.admin,
    // Granular permission shortcuts
    canPlan: roleLevel >= ROLE_LEVELS.deployer,
    canApply: roleLevel >= ROLE_LEVELS.deployer,
    canApprove: roleLevel >= ROLE_LEVELS.operator,
    canManagePolicies: roleLevel >= ROLE_LEVELS.operator,
    canImport: roleLevel >= ROLE_LEVELS.operator,
    canManageSettings: roleLevel >= ROLE_LEVELS.admin,
    canManageUsers: roleLevel >= ROLE_LEVELS.admin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
