import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { API } from "../config";
import logo from "../assets/wolkvorm-logo.png";

function ParticleCanvas({ isDark }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 18000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        a: Math.random() * 0.25 + 0.05,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(255,255,255,${p.a})`
          : `rgba(0,0,80,${p.a})`;
        ctx.fill();
      }

      // draw faint connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = isDark
              ? `rgba(99,102,241,${0.08 * (1 - dist / 120)})`
              : `rgba(99,102,241,${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}

function FloatingField({ label, type = "text", value, onChange, autoFocus, required, autoComplete, minLength, maxLength, mono, theme, suffix }) {
  const [focused, setFocused] = useState(false);
  const active = focused || !!value;

  const fieldStyle = {
    position: "relative",
    marginBottom: 2,
  };

  const inputStyle = {
    width: "100%",
    padding: mono ? "16px 14px 6px" : "16px 14px 6px",
    paddingRight: suffix ? 44 : 14,
    background: theme.colors.input,
    border: `1.5px solid ${focused ? theme.colors.primary : theme.colors.inputBorder}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    fontSize: mono ? 20 : 14,
    fontFamily: mono ? "'SF Mono', 'Fira Code', monospace" : theme.fonts.body,
    fontWeight: mono ? 600 : 400,
    letterSpacing: mono ? "0.3em" : "normal",
    textAlign: mono ? "center" : "left",
    outline: "none",
    transition: "border-color 0.25s, box-shadow 0.25s",
    boxShadow: focused ? `0 0 0 3px ${theme.colors.primary}22` : "none",
  };

  const labelStyle = {
    position: "absolute",
    left: 14,
    top: active ? -8 : 14,
    fontSize: active ? 11 : 14,
    fontWeight: active ? 600 : 400,
    color: focused ? theme.colors.primary : theme.colors.textMuted,
    background: active ? theme.colors.card : "transparent",
    padding: active ? "0 6px" : 0,
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    pointerEvents: "none",
    zIndex: 1,
    fontFamily: theme.fonts.body,
  };

  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        style={inputStyle}
      />
      {suffix}
    </div>
  );
}

function EyeIcon({ open, size = 18 }) {
  if (open) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { login, changePassword, mustChangePassword } = useAuth();
  const { theme, isDark } = useTheme();

  const [view, setView] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  const [forgotUsername, setForgotUsername] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

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
        setFormSuccess(true);
        setTimeout(() => navigate("/"), 600);
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
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSuccessMessage(data.message);
      setResetUsername(forgotUsername);
      setTimeout(() => { setView("reset"); setSuccessMessage(""); }, 3000);
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
    if (newPassword !== confirmNewPassword) { setError("Passwords do not match"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: resetUsername, reset_code: resetCode, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      if (data.token) {
        localStorage.setItem("tf_token", data.token);
        if (data.user) localStorage.setItem("tf_user", JSON.stringify(data.user));
        setSuccessMessage("Password reset successful! Redirecting...");
        setTimeout(() => { window.location.href = "/"; }, 1500);
      } else {
        setSuccessMessage("Password reset successful! You can now sign in.");
        setTimeout(() => { setView("login"); setSuccessMessage(""); setError(""); }, 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchView = useCallback((v) => {
    setError("");
    setSuccessMessage("");
    setView(v);
  }, []);

  const s = getStyles(theme, formSuccess);

  const passwordToggle = (show, setShow) => (
    <button
      type="button"
      onClick={() => setShow(!show)}
      style={s.eyeBtn}
      tabIndex={-1}
      aria-label={show ? "Hide password" : "Show password"}
    >
      <EyeIcon open={!show} />
    </button>
  );

  const renderError = () => error && <div style={s.error}>{error}</div>;
  const renderSuccess = () => successMessage && <div style={s.success}>{successMessage}</div>;

  const backBtn = (to) => (
    <button onClick={() => switchView(to)} style={s.backBtn} title="Back">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
      </svg>
    </button>
  );

  // ========== Must Change Password ==========
  if (mustChangePassword) {
    return (
      <div style={s.container}>
        <ParticleCanvas isDark={isDark} />
        <div style={s.card}>
          <div style={s.logoWrap}>
            <img src={logo} alt="Wolkvorm" style={s.logo} />
            <h1 style={s.title}>Change Password</h1>
          </div>
          <div style={s.notice}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
              <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 12c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm1-4H9V6h2v4z" fill={theme.colors.warning} />
            </svg>
            <span>You must change your password before continuing.</span>
          </div>
          <form onSubmit={handleChangePassword} style={s.form}>
            <FloatingField label="New Password" type="password" value={changeNewPassword} onChange={(e) => setChangeNewPassword(e.target.value)} autoFocus required minLength={6} autoComplete="new-password" theme={theme} />
            <FloatingField label="Confirm Password" type="password" value={confirmChangePassword} onChange={(e) => setConfirmChangePassword(e.target.value)} required minLength={6} autoComplete="new-password" theme={theme} />
            {renderError()}
            <button type="submit" disabled={loading} style={{ ...s.button, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
          <p style={s.footer}>Wolkvorm &mdash; Open Source Infrastructure Management</p>
        </div>
      </div>
    );
  }

  // ========== Forgot Password ==========
  if (view === "forgot") {
    return (
      <div style={s.container}>
        <ParticleCanvas isDark={isDark} />
        <div style={s.card}>
          <div style={s.logoWrap}>
            <img src={logo} alt="Wolkvorm" style={s.logo} />
          </div>
          <div style={s.viewHeader}>{backBtn("login")}<h2 style={s.viewTitle}>Forgot Password</h2></div>
          <p style={s.desc}>Enter your username and we'll generate a reset code. Contact your administrator to receive the code.</p>
          <form onSubmit={handleForgotPassword} style={s.form}>
            <FloatingField label="Username" value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)} autoFocus required autoComplete="username" theme={theme} />
            {renderError()}
            {renderSuccess()}
            <button type="submit" disabled={loading} style={{ ...s.button, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Sending..." : "Request Reset Code"}
            </button>
          </form>
          <div style={s.linkRow}>
            <span style={s.linkText}>Already have a reset code?</span>
            <button onClick={() => switchView("reset")} style={s.link}>Enter code</button>
          </div>
          <p style={s.footer}>Wolkvorm &mdash; Open Source Infrastructure Management</p>
        </div>
      </div>
    );
  }

  // ========== Reset Password ==========
  if (view === "reset") {
    return (
      <div style={s.container}>
        <ParticleCanvas isDark={isDark} />
        <div style={s.card}>
          <div style={s.logoWrap}>
            <img src={logo} alt="Wolkvorm" style={s.logo} />
          </div>
          <div style={s.viewHeader}>{backBtn("login")}<h2 style={s.viewTitle}>Reset Password</h2></div>
          <p style={s.desc}>Enter the reset code you received from your administrator along with your new password.</p>
          <form onSubmit={handleResetPassword} style={s.form}>
            <FloatingField label="Username" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} required autoComplete="username" theme={theme} />
            <FloatingField label="Reset Code" value={resetCode} onChange={(e) => setResetCode(e.target.value)} autoFocus required maxLength={6} autoComplete="one-time-code" mono theme={theme} />
            <FloatingField
              label="New Password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              theme={theme}
              suffix={passwordToggle(showNewPassword, setShowNewPassword)}
            />
            <FloatingField label="Confirm New Password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required minLength={6} autoComplete="new-password" theme={theme} />
            {renderError()}
            {renderSuccess()}
            <button type="submit" disabled={loading} style={{ ...s.button, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
          <div style={s.linkRow}>
            <span style={s.linkText}>Don't have a code?</span>
            <button onClick={() => switchView("forgot")} style={s.link}>Request one</button>
          </div>
          <p style={s.footer}>Wolkvorm &mdash; Open Source Infrastructure Management</p>
        </div>
      </div>
    );
  }

  // ========== Login View ==========
  return (
    <div style={s.container}>
      <ParticleCanvas isDark={isDark} />

      <div style={s.card}>
        <div style={s.logoWrap}>
          <img src={logo} alt="Wolkvorm" style={s.logo} />
          <h1 style={s.title}>Welcome</h1>
          <p style={s.subtitle}>Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} style={s.form}>
          <FloatingField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            autoComplete="username"
            theme={theme}
          />
          <FloatingField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            theme={theme}
            suffix={passwordToggle(showPassword, setShowPassword)}
          />

          {renderError()}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...s.button,
              opacity: loading ? 0.7 : 1,
              ...(formSuccess ? s.buttonSuccess : {}),
            }}
          >
            {loading ? (
              <span style={s.spinnerWrap}>
                <span style={s.spinner} />
                Signing in...
              </span>
            ) : formSuccess ? (
              <span style={s.spinnerWrap}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Success
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div style={s.separator}>
          <div style={s.separatorLine} />
          <span style={s.separatorText}>or</span>
          <div style={s.separatorLine} />
        </div>

        <div style={s.forgotRow}>
          <button onClick={() => { setForgotUsername(username); switchView("forgot"); }} style={s.forgotLink}>
            Forgot password?
          </button>
        </div>

        <p style={s.footer}>
          Wolkvorm &mdash; Open Source Infrastructure Management
        </p>
      </div>
    </div>
  );
}

function getStyles(theme, formSuccess) {
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
    card: {
      position: "relative",
      zIndex: 1,
      width: "100%",
      maxWidth: 420,
      padding: "44px 40px 36px",
      background: `${theme.colors.card}e6`,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: theme.radius.lg,
      border: `1px solid ${theme.colors.border}`,
      boxShadow: formSuccess
        ? `0 0 30px ${theme.colors.success}40`
        : "0 25px 60px -12px rgba(0, 0, 0, 0.5)",
      animation: "loginCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      transition: "box-shadow 0.4s",
    },
    logoWrap: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginBottom: 28,
    },
    logo: {
      height: 72,
      width: "auto",
      objectFit: "contain",
      marginBottom: 16,
      filter: "drop-shadow(0 4px 12px rgba(99, 102, 241, 0.3))",
    },
    title: {
      fontSize: 24,
      fontWeight: 700,
      color: theme.colors.text,
      margin: 0,
      fontFamily: theme.fonts.body,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 14,
      margin: "6px 0 0",
      fontFamily: theme.fonts.body,
    },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
    },
    eyeBtn: {
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      color: theme.colors.textMuted,
      cursor: "pointer",
      padding: 4,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 4,
      transition: "color 0.2s",
    },
    button: {
      padding: "13px 20px",
      background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})`,
      color: "#fff",
      border: "none",
      borderRadius: theme.radius.sm,
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: theme.fonts.body,
      transition: "all 0.3s",
      marginTop: 4,
      position: "relative",
      overflow: "hidden",
    },
    buttonSuccess: {
      background: `linear-gradient(135deg, ${theme.colors.success}, #15803d)`,
      animation: "loginSuccessPulse 0.6s ease-out",
    },
    spinnerWrap: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
    },
    spinner: {
      display: "inline-block",
      width: 16,
      height: 16,
      border: "2px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "spin 0.6s linear infinite",
    },
    separator: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "20px 0 0",
    },
    separatorLine: {
      flex: 1,
      height: 1,
      background: theme.colors.border,
    },
    separatorText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: theme.fonts.body,
    },
    error: {
      background: `${theme.colors.danger}15`,
      border: `1px solid ${theme.colors.danger}40`,
      color: theme.colors.danger,
      padding: "10px 14px",
      borderRadius: theme.radius.sm,
      fontSize: 13,
      fontFamily: theme.fonts.body,
      animation: "fadeIn 0.2s",
    },
    success: {
      background: `${theme.colors.success}15`,
      border: `1px solid ${theme.colors.success}40`,
      color: theme.colors.success,
      padding: "10px 14px",
      borderRadius: theme.radius.sm,
      fontSize: 13,
      fontFamily: theme.fonts.body,
      lineHeight: 1.5,
      animation: "fadeIn 0.2s",
    },
    notice: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: `${theme.colors.warning}12`,
      border: `1px solid ${theme.colors.warning}40`,
      color: theme.colors.warning,
      padding: "12px 14px",
      borderRadius: theme.radius.sm,
      fontSize: 13,
      fontFamily: theme.fonts.body,
      marginBottom: 16,
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
    desc: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 1.5,
      margin: "0 0 24px",
      fontFamily: theme.fonts.body,
    },
    backBtn: {
      background: "none",
      border: "none",
      color: theme.colors.textMuted,
      cursor: "pointer",
      padding: 4,
      display: "flex",
      alignItems: "center",
      borderRadius: theme.radius.sm,
    },
    forgotRow: {
      display: "flex",
      justifyContent: "center",
      marginTop: 14,
    },
    forgotLink: {
      background: "none",
      border: "none",
      color: theme.colors.primary,
      fontSize: 13,
      cursor: "pointer",
      fontFamily: theme.fonts.body,
      padding: 0,
      opacity: 0.85,
      transition: "opacity 0.2s",
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
      fontWeight: 500,
    },
    footer: {
      textAlign: "center",
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 28,
      marginBottom: 0,
      opacity: 0.5,
      fontFamily: theme.fonts.body,
    },
  };
}

export default LoginPage;
