import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/logo-terraforge-transparent.png";
import { API, authFetch } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

const ROLE_COLORS = {
  admin: "#a78bfa",
  operator: "#60a5fa",
  deployer: "#fbbf24",
  viewer: "#94a3b8",
};

// Sun icon for light mode
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

// Moon icon for dark mode
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

// Hamburger/menu icon
function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function Navbar() {
  const location = useLocation();
  const { user, logout, role, canAdmin, canOperate } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [settingsStatus, setSettingsStatus] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    authFetch(`${API}/api/settings`)
      .then((res) => res.json())
      .then(setSettingsStatus)
      .catch(() => { });

    authFetch(`${API}/api/approvals/pending-count`)
      .then((res) => res.json())
      .then((data) => setPendingApprovals(data.count || 0))
      .catch(() => { });
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const awsOk = settingsStatus?.aws?.configured;
  const ghOk = settingsStatus?.github?.configured;
  const allConfigured = awsOk && ghOk;

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { to: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { to: "/resources", label: "Resources", match: (p) => p === "/resources" || p.startsWith("/resource/"), icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    { to: "/my-resources", label: "My Resources", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
    { to: "/costs", label: "Costs", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { to: "/graph", label: "Graph", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
    ...(canOperate ? [{ to: "/import", label: "Import", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" }] : []),
    { to: "/approvals", label: "Approvals", badge: pendingApprovals, icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    ...(canOperate ? [{ to: "/policies", label: "Policies", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" }] : []),
    { to: "/audit", label: "Audit", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
    ...(canAdmin ? [{
      to: "/settings",
      label: "Settings",
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
      icon2: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
      statusDot: true,
    }] : []),
  ];

  const s = getStyles(theme);

  return (
    <nav style={s.nav}>
      {/* Logo */}
      <Link to="/" style={s.logo}>
        <img src={logo} alt="TerraForge" style={s.logoImg} />
      </Link>

      {/* Right section */}
      <div style={s.rightSection}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} style={s.iconBtn} title={isDark ? "Switch to light theme" : "Switch to dark theme"}>
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* User info */}
        <div style={s.userChip}>
          <span style={s.userName}>{user?.display_name || user?.username || "User"}</span>
          <span style={{ ...s.roleBadge, color: ROLE_COLORS[role] || "#94a3b8", borderColor: (ROLE_COLORS[role] || "#94a3b8") + "40", background: (ROLE_COLORS[role] || "#94a3b8") + "15" }}>
            {role}
          </span>
        </div>

        {/* Logout */}
        <button onClick={logout} style={s.iconBtn} title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>

        {/* Menu button */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ ...s.menuBtn, ...(menuOpen ? s.menuBtnActive : {}) }}>
            <MenuIcon />
            <span style={s.menuLabel}>Menu</span>
            {pendingApprovals > 0 && !menuOpen && (
              <span style={s.menuBadge}>{pendingApprovals}</span>
            )}
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div style={s.dropdown}>
              <div style={s.dropdownHeader}>Navigation</div>
              {navLinks.map((link) => {
                const active = link.match ? link.match(location.pathname) : isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    style={{ ...s.dropdownItem, ...(active ? s.dropdownItemActive : {}) }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: active ? 1 : 0.5 }}>
                      <path d={link.icon} />
                      {link.icon2 && <path d={link.icon2} />}
                    </svg>
                    <span style={{ flex: 1 }}>{link.label}</span>
                    {link.badge > 0 && (
                      <span style={s.dropdownBadge}>{link.badge}</span>
                    )}
                    {link.statusDot && (
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: allConfigured ? theme.colors.success : settingsStatus ? theme.colors.warning : theme.colors.textMuted,
                      }} />
                    )}
                    {active && <span style={s.activeIndicator} />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function getStyles(theme) {
  return {
    nav: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 24px",
      background: theme.colors.card,
      borderBottom: `1px solid ${theme.colors.border}`,
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    logo: {
      display: "flex",
      alignItems: "center",
      textDecoration: "none",
    },
    logoImg: {
      height: 64,
      width: "auto",
      objectFit: "contain",
    },
    rightSection: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    iconBtn: {
      background: "none",
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.textMuted,
      cursor: "pointer",
      padding: "6px 8px",
      borderRadius: theme.radius.sm,
      display: "flex",
      alignItems: "center",
      transition: "all 0.2s",
    },
    userChip: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border}`,
      background: theme.colors.bg,
    },
    userName: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: 500,
    },
    roleBadge: {
      fontSize: 9,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      padding: "2px 6px",
      borderRadius: 8,
      border: "1px solid",
    },
    menuBtn: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border}`,
      background: theme.colors.bg,
      color: theme.colors.text,
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 500,
      transition: "all 0.2s",
      position: "relative",
    },
    menuBtnActive: {
      background: theme.colors.primary,
      borderColor: theme.colors.primary,
      color: "#fff",
    },
    menuLabel: {
      fontSize: 13,
      fontWeight: 500,
    },
    menuBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      background: theme.colors.danger,
      color: "#fff",
      fontSize: 9,
      fontWeight: 700,
      padding: "1px 5px",
      borderRadius: 8,
      minWidth: 14,
      textAlign: "center",
    },
    dropdown: {
      position: "absolute",
      top: "calc(100% + 8px)",
      right: 0,
      width: 240,
      background: theme.colors.card,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      boxShadow: "0 20px 40px -8px rgba(0,0,0,0.4)",
      padding: "6px",
      zIndex: 200,
      animation: "fadeIn 0.15s ease-out",
    },
    dropdownHeader: {
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: 1,
      color: theme.colors.textMuted,
      padding: "8px 12px 6px",
      opacity: 0.6,
    },
    dropdownItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 12px",
      borderRadius: theme.radius.sm,
      color: theme.colors.textMuted,
      textDecoration: "none",
      fontSize: 13,
      fontWeight: 500,
      transition: "all 0.15s",
      position: "relative",
    },
    dropdownItemActive: {
      color: theme.colors.text,
      background: `${theme.colors.primary}15`,
    },
    dropdownBadge: {
      background: theme.colors.danger,
      color: "#fff",
      fontSize: 10,
      fontWeight: 700,
      padding: "1px 6px",
      borderRadius: 8,
      minWidth: 16,
      textAlign: "center",
    },
    activeIndicator: {
      width: 4,
      height: 4,
      borderRadius: "50%",
      background: theme.colors.primary,
    },
  };
}

export default Navbar;
