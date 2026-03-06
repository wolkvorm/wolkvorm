import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { API } from "../config";
import logo from "../assets/logo-terraforge-transparent.png";

function LoginPage() {
  const navigate = useNavigate();
  const { login, changePassword, mustChangePassword } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  // View state: 'login', 'forgot', 'reset'
  const [view, setView] = useState("login");

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Forgot password state
  const [forgotUsername, setForgotUsername] = useState("");

  // Reset password state
  const [resetUsername, setResetUsername] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Change password state (for must_change_password flow)
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [confirmChangePassword, setConfirmChangePassword] = useState("");
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const data = await login(username, password);
      if (data.user?.must_change_password) {
        setCurrentPasswordForChange(password);
        setLoading(false);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");

    if (changeNewPassword !== confirmChangePassword) {
      setError("Passwords do not match");
      return;
    }
    if (changeNewPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPasswordForChange, changeNewPassword);
      navigate("/");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setSuccessMessage(data.message);
      // Pre-fill username for reset view
      setResetUsername(forgotUsername);

      // After a short delay, show reset form
      setTimeout(() => {
        setView("reset");
        setSuccessMessage("");
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: resetUsername,
          reset_code: resetCode,
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Reset failed");
      }

      // If the backend returned a token, log the user in
      if (data.token) {
        localStorage.setItem("tf_token", data.token);
        if (data.user) {
          localStorage.setItem("tf_user", JSON.stringify(data.user));
        }
        setSuccessMessage("Password reset successful! Redirecting...");
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      } else {
        setSuccessMessage("Password reset successful! You can now sign in.");
        setTimeout(() => {
          setView("login");
          setSuccessMessage("");
          setError("");
        }, 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchToForgot = () => {
    setError("");
    setSuccessMessage("");
    setForgotUsername(username);
    setView("forgot");
  };

  const switchToLogin = () => {
    setError("");
    setSuccessMessage("");
    setView("login");
  };

  const switchToReset = () => {
    setError("");
    setSuccessMessage("");
    setView("reset");
  };

  // ========== Must Change Password View ==========
  if (mustChangePassword) {
    return (
      <div style={styles.container}>
        <div style={styles.backdrop} />
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <img src={logo} alt="TerraForge" style={styles.logo} />
          </div>

          <div style={styles.changePasswordNotice}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
              <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 12c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm1-4H9V6h2v4z" fill={theme.colors.warning} />
            </svg>
            <span>You must change your password before continuing.</span>
          </div>

          <form onSubmit={handleChangePassword} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={changeNewPassword}
                onChange={(e) => setChangeNewPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter new password"
                autoFocus
                required
                minLength={6}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                value={confirmChangePassword}
                onChange={(e) => setConfirmChangePassword(e.target.value)}
                style={styles.input}
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ========== Forgot Password View ==========
  if (view === "forgot") {
    return (
      <div style={styles.container}>
        <div style={styles.backdrop} />
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <img src={logo} alt="TerraForge" style={styles.logo} />
          </div>

          <div style={styles.viewHeader}>
            <button onClick={switchToLogin} style={styles.backButton} title="Back to login">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h2 style={styles.viewTitle}>Forgot Password</h2>
          </div>

          <p style={styles.viewDescription}>
            Enter your username and we'll generate a reset code. Contact your administrator to receive the code.
          </p>

          <form onSubmit={handleForgotPassword} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input
                type="text"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                style={styles.input}
                placeholder="Enter your username"
                autoFocus
                required
                autoComplete="username"
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {successMessage && <div style={styles.success}>{successMessage}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span style={styles.spinnerText}>Sending...</span>
              ) : (
                "Request Reset Code"
              )}
            </button>
          </form>

          <div style={styles.linkRow}>
            <span style={styles.linkText}>Already have a reset code?</span>
            <button onClick={switchToReset} style={styles.link}>
              Enter code
            </button>
          </div>

          <p style={styles.footer}>
            TerraForge &mdash; Open Source Infrastructure Management
          </p>
        </div>
      </div>
    );
  }

  // ========== Reset Password View ==========
  if (view === "reset") {
    return (
      <div style={styles.container}>
        <div style={styles.backdrop} />
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <img src={logo} alt="TerraForge" style={styles.logo} />
          </div>

          <div style={styles.viewHeader}>
            <button onClick={switchToLogin} style={styles.backButton} title="Back to login">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h2 style={styles.viewTitle}>Reset Password</h2>
          </div>

          <p style={styles.viewDescription}>
            Enter the reset code you received from your administrator along with your new password.
          </p>

          <form onSubmit={handleResetPassword} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input
                type="text"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                style={styles.input}
                placeholder="Enter your username"
                required
                autoComplete="username"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Reset Code</label>
              <input
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                style={styles.codeInput}
                placeholder="000000"
                required
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter new password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                style={styles.input}
                placeholder="Confirm new password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {successMessage && <div style={styles.success}>{successMessage}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span style={styles.spinnerText}>Resetting...</span>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>

          <div style={styles.linkRow}>
            <span style={styles.linkText}>Don't have a code?</span>
            <button onClick={switchToForgot} style={styles.link}>
              Request one
            </button>
          </div>

          <p style={styles.footer}>
            TerraForge &mdash; Open Source Infrastructure Management
          </p>
        </div>
      </div>
    );
  }

  // ========== Login View ==========
  return (
    <div style={styles.container}>
      <div style={styles.backdrop} />
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src={logo} alt="TerraForge" style={styles.logo} />
        </div>

        <p style={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Enter username"
              autoFocus
              required
              autoComplete="username"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <span style={styles.spinnerText}>Signing in...</span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div style={styles.forgotRow}>
          <button onClick={switchToForgot} style={styles.forgotLink}>
            Forgot password?
          </button>
        </div>

        <p style={styles.footer}>
          TerraForge &mdash; Open Source Infrastructure Management
        </p>
      </div>
    </div>
  );
}

function getStyles(theme) {
  return {
    container: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: theme.colors.bg,
      position: "relative",
      overflow: "hidden",
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `radial-gradient(ellipse at 50% 0%, ${theme.colors.primary}15 0%, transparent 60%)`,
      pointerEvents: "none",
    },
    card: {
      position: "relative",
      width: "100%",
      maxWidth: 400,
      padding: "40px 36px",
      background: theme.colors.card,
      borderRadius: theme.radius.lg,
      border: `1px solid ${theme.colors.border}`,
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    },
    logoWrap: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 24,
    },
    logo: {
      height: 80,
      width: "auto",
      objectFit: "contain",
    },
    subtitle: {
      textAlign: "center",
      color: theme.colors.textMuted,
      fontSize: 14,
      margin: "0 0 28px",
      fontFamily: theme.fonts.body,
    },
    viewHeader: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    viewTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: theme.colors.text,
      margin: 0,
      fontFamily: theme.fonts.body,
    },
    viewDescription: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 1.5,
      margin: "0 0 24px",
      fontFamily: theme.fonts.body,
    },
    backButton: {
      background: "none",
      border: "none",
      color: theme.colors.textMuted,
      cursor: "pointer",
      padding: 4,
      display: "flex",
      alignItems: "center",
      borderRadius: theme.radius.sm,
      transition: "color 0.2s, background 0.2s",
    },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: 18,
    },
    field: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: 500,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
    },
    input: {
      padding: "10px 14px",
      background: theme.colors.input,
      border: `1px solid ${theme.colors.inputBorder}`,
      borderRadius: theme.radius.sm,
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: theme.fonts.body,
      outline: "none",
      transition: "border-color 0.2s",
    },
    codeInput: {
      padding: "12px 14px",
      background: theme.colors.input,
      border: `1px solid ${theme.colors.inputBorder}`,
      borderRadius: theme.radius.sm,
      color: theme.colors.text,
      fontSize: 22,
      fontFamily: "'SF Mono', 'Fira Code', 'Courier New', monospace",
      fontWeight: 600,
      letterSpacing: "0.35em",
      textAlign: "center",
      outline: "none",
      transition: "border-color 0.2s",
    },
    button: {
      padding: "11px 20px",
      background: theme.colors.primary,
      color: "#fff",
      border: "none",
      borderRadius: theme.radius.sm,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: theme.fonts.body,
      transition: "background 0.2s, opacity 0.2s",
      marginTop: 4,
    },
    error: {
      background: `${theme.colors.danger}18`,
      border: `1px solid ${theme.colors.danger}40`,
      color: theme.colors.danger,
      padding: "10px 14px",
      borderRadius: theme.radius.sm,
      fontSize: 13,
      fontFamily: theme.fonts.body,
    },
    success: {
      background: `${theme.colors.success}18`,
      border: `1px solid ${theme.colors.success}40`,
      color: theme.colors.success,
      padding: "10px 14px",
      borderRadius: theme.radius.sm,
      fontSize: 13,
      fontFamily: theme.fonts.body,
      lineHeight: 1.5,
    },
    changePasswordNotice: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: `${theme.colors.warning}15`,
      border: `1px solid ${theme.colors.warning}40`,
      color: theme.colors.warning,
      padding: "12px 14px",
      borderRadius: theme.radius.sm,
      fontSize: 13,
      fontFamily: theme.fonts.body,
      marginBottom: 12,
    },
    spinnerText: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    forgotRow: {
      display: "flex",
      justifyContent: "center",
      marginTop: 18,
    },
    forgotLink: {
      background: "none",
      border: "none",
      color: theme.colors.primary,
      fontSize: 13,
      cursor: "pointer",
      fontFamily: theme.fonts.body,
      padding: 0,
      textDecoration: "none",
      transition: "opacity 0.2s",
      opacity: 0.85,
    },
    linkRow: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginTop: 18,
    },
    linkText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: theme.fonts.body,
    },
    link: {
      background: "none",
      border: "none",
      color: theme.colors.primary,
      fontSize: 12,
      cursor: "pointer",
      fontFamily: theme.fonts.body,
      padding: 0,
      textDecoration: "none",
      fontWeight: 500,
    },
    footer: {
      textAlign: "center",
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 24,
      marginBottom: 0,
      opacity: 0.6,
      fontFamily: theme.fonts.body,
    },
  };
}

export default LoginPage;
