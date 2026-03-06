import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { API } from "../config";
import logo from "../assets/logo-terraforge-transparent.png";

function SetupPage() {
    const navigate = useNavigate();
    const { completeSetup } = useAuth();
    const { theme } = useTheme();
    const styles = getStyles(theme);

    const [username, setUsername] = useState("admin");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const getPasswordStrength = (pw) => {
        if (!pw) return { label: "", color: "transparent", width: "0%" };
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 10) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        if (score <= 1) return { label: "Weak", color: "#ef4444", width: "20%" };
        if (score <= 2) return { label: "Fair", color: "#f59e0b", width: "40%" };
        if (score <= 3) return { label: "Good", color: "#3b82f6", width: "60%" };
        if (score <= 4) return { label: "Strong", color: "#22c55e", width: "80%" };
        return { label: "Very Strong", color: "#10b981", width: "100%" };
    };

    const strength = getPasswordStrength(password);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!username.trim()) {
            setError("Username is required");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API}/api/auth/setup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: username.trim(),
                    password,
                    display_name: displayName.trim() || "Administrator",
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Setup failed");
            }

            // Auto-login with the returned token
            completeSetup(data.token, data.user);
            navigate("/");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.backdrop} />
            <div style={styles.card}>
                <div style={styles.logoWrap}>
                    <img src={logo} alt="TerraForge" style={styles.logo} />
                </div>

                <h1 style={styles.title}>Welcome to TerraForge</h1>
                <p style={styles.subtitle}>
                    Set up your admin account to get started.
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.field}>
                        <label style={styles.label}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={styles.input}
                            placeholder="admin"
                            autoComplete="username"
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            style={styles.input}
                            placeholder="Administrator"
                            autoComplete="name"
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                            placeholder="••••••••"
                            autoComplete="new-password"
                        />
                        {password && (
                            <div style={styles.strengthWrap}>
                                <div style={styles.strengthTrack}>
                                    <div
                                        style={{
                                            ...styles.strengthBar,
                                            width: strength.width,
                                            background: strength.color,
                                        }}
                                    />
                                </div>
                                <span style={{ ...styles.strengthLabel, color: strength.color }}>
                                    {strength.label}
                                </span>
                            </div>
                        )}
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={styles.input}
                            placeholder="••••••••"
                            autoComplete="new-password"
                        />
                    </div>

                    {error && <div style={styles.error}>{error}</div>}

                    <button type="submit" disabled={loading} style={styles.submitBtn}>
                        {loading ? "Creating..." : "Create Admin Account"}
                    </button>
                </form>

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
            maxWidth: 420,
            padding: "40px 36px",
            background: theme.colors.card,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.border}`,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        },
        logoWrap: {
            display: "flex",
            justifyContent: "center",
            marginBottom: 16,
        },
        logo: {
            height: 80,
            width: "auto",
            objectFit: "contain",
        },
        title: {
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            color: theme.colors.text,
            margin: "0 0 6px",
            fontFamily: theme.fonts.body,
        },
        subtitle: {
            textAlign: "center",
            color: theme.colors.textMuted,
            fontSize: 14,
            margin: "0 0 28px",
            fontFamily: theme.fonts.body,
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
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.bg,
            color: theme.colors.text,
            fontSize: 14,
            outline: "none",
            transition: "border-color 0.2s",
            fontFamily: theme.fonts.body,
        },
        strengthWrap: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
        },
        strengthTrack: {
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: theme.colors.border,
            overflow: "hidden",
        },
        strengthBar: {
            height: "100%",
            borderRadius: 2,
            transition: "width 0.3s, background 0.3s",
        },
        strengthLabel: {
            fontSize: 11,
            fontWeight: 600,
            fontFamily: theme.fonts.body,
            whiteSpace: "nowrap",
        },
        error: {
            background: `${theme.colors.danger}15`,
            border: `1px solid ${theme.colors.danger}40`,
            color: theme.colors.danger,
            padding: "10px 14px",
            borderRadius: theme.radius.sm,
            fontSize: 13,
            fontFamily: theme.fonts.body,
        },
        submitBtn: {
            padding: "12px 20px",
            borderRadius: theme.radius.sm,
            border: "none",
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}dd)`,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.2s, transform 0.1s",
            fontFamily: theme.fonts.body,
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

export default SetupPage;
