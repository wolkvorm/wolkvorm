import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/wolkvorm-logo.png";
import { API, authFetch } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

const PROVIDERS = [
  { id: "aws",          label: "AWS",         icon: "☁️",  color: "#FF9900" },
  { id: "azurerm",      label: "Azure",        icon: "🔷", color: "#0078D4" },
  { id: "google",       label: "GCP",          icon: "🌐", color: "#4285F4" },
  { id: "huaweicloud",  label: "Huawei",       icon: "🔴", color: "#CF0A2C" },
  { id: "digitalocean", label: "DigitalOcean", icon: "🌊", color: "#0080FF" },
];

const ROLE_COLORS = {
  admin: "#a78bfa",
  operator: "#60a5fa",
  deployer: "#fbbf24",
  viewer: "#94a3b8",
};

// Icons
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function ChevronIcon({ collapsed }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "transform 0.2s", transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function Navbar() {
  const location = useLocation();
  const { user, logout, role, canAdmin, canOperate } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [settingsStatus, setSettingsStatus] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(true);

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
    { to: "/graph", label: "Graph", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
    { to: "/costs", label: "Costs", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
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

  const s = getStyles(theme, collapsed);

  return (
    <nav style={s.sidebar}>
      {/* Logo & Collapse */}
      <div style={s.logoSection}>
        <Link to="/" style={s.logoLink}>
          <img src={logo} alt="Wolkvorm" style={s.logoImg} />
          {!collapsed && <span style={s.logoText}>Wolkvorm</span>}
        </Link>
        <button onClick={() => setCollapsed(!collapsed)} style={s.collapseBtn} title={collapsed ? "Expand" : "Collapse"}>
          <ChevronIcon collapsed={collapsed} />
        </button>
      </div>

      {/* Navigation Links */}
      <div style={s.navSection}>
        <div style={s.navGroup}>
          {!collapsed && <span style={s.navGroupLabel}>MAIN</span>}
          {navLinks.slice(0, 4).map((link) => {
            const active = link.match ? link.match(location.pathname) : isActive(link.to);
            const isResources = link.to === "/resources";
            return (
              <div key={link.to}>
                <div
                  style={{ ...s.navItem, ...(active ? s.navItemActive : {}), cursor: "pointer" }}
                  title={collapsed ? link.label : undefined}
                  onClick={() => {
                    if (isResources && !collapsed) {
                      setResourcesOpen((v) => !v);
                    } else {
                      navigate(link.to);
                    }
                  }}
                >
                  <div style={{ ...s.navIconWrap, ...(active ? s.navIconWrapActive : {}) }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={link.icon} />
                      {link.icon2 && <path d={link.icon2} />}
                    </svg>
                  </div>
                  {!collapsed && <span style={s.navLabel}>{link.label}</span>}
                  {!collapsed && link.badge > 0 && <span style={s.badge}>{link.badge}</span>}
                  {!collapsed && isResources && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      style={{ transition: "transform 0.2s", transform: resourcesOpen ? "rotate(-90deg)" : "rotate(0deg)", marginLeft: "auto", opacity: 0.5 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                  {active && <div style={s.activeBar} />}
                </div>
                {isResources && !collapsed && resourcesOpen && (
                  <div style={s.subLinks}>
                    {PROVIDERS.map((p) => {
                      const subActive = location.pathname === "/resources" && location.search.includes(`provider=${p.id}`);
                      return (
                        <Link
                          key={p.id}
                          to={`/resources?provider=${p.id}`}
                          style={{ ...s.subLink, ...(subActive ? { color: p.color, background: `rgba(0,0,0,0.04)` } : {}) }}
                        >
                          <span style={{ fontSize: 13 }}>{p.icon}</span>
                          <span>{p.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={s.navGroup}>
          {!collapsed && <span style={s.navGroupLabel}>MANAGEMENT</span>}
          {navLinks.slice(4).map((link) => {
            const active = link.match ? link.match(location.pathname) : isActive(link.to);
            return (
              <Link key={link.to} to={link.to} style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }} title={collapsed ? link.label : undefined}>
                <div style={{ ...s.navIconWrap, ...(active ? s.navIconWrapActive : {}) }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={link.icon} />
                    {link.icon2 && <path d={link.icon2} />}
                  </svg>
                </div>
                {!collapsed && <span style={s.navLabel}>{link.label}</span>}
                {!collapsed && link.badge > 0 && <span style={s.badge}>{link.badge}</span>}
                {!collapsed && link.statusDot && (
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%", marginLeft: "auto",
                    background: allConfigured ? theme.colors.success : settingsStatus ? theme.colors.warning : theme.colors.textMuted,
                  }} />
                )}
                {active && <div style={s.activeBar} />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Section */}
      <div style={s.bottomSection}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} style={s.themeToggle} title={isDark ? "Switch to light" : "Switch to dark"}>
          {isDark ? <SunIcon /> : <MoonIcon />}
          {!collapsed && <span style={s.themeLabel}>{isDark ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        {/* User info */}
        <div style={s.userBlock}>
          <div style={s.userAvatar}>
            {(user?.display_name || user?.username || "U").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div style={s.userInfo}>
              <span style={s.userName}>{user?.display_name || user?.username || "User"}</span>
              <span style={{ ...s.roleBadge, color: ROLE_COLORS[role] || "#94a3b8" }}>{role}</span>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} style={s.logoutBtn} title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function getStyles(theme, collapsed) {
  const width = collapsed ? 68 : 240;
  return {
    sidebar: {
      width,
      minWidth: width,
      height: "100vh",
      position: "sticky",
      top: 0,
      display: "flex",
      flexDirection: "column",
      background: theme.colors.card,
      borderRight: `1px solid ${theme.colors.border}`,
      transition: "width 0.25s cubic-bezier(.4,0,.2,1), min-width 0.25s cubic-bezier(.4,0,.2,1)",
      overflow: "hidden",
      zIndex: 100,
    },
    logoSection: {
      display: "flex",
      alignItems: "center",
      justifyContent: collapsed ? "center" : "space-between",
      padding: collapsed ? "16px 8px" : "16px 16px",
      borderBottom: `1px solid ${theme.colors.border}`,
      minHeight: 64,
    },
    logoLink: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      textDecoration: "none",
      overflow: "hidden",
    },
    logoImg: {
      height: 36,
      width: "auto",
      objectFit: "contain",
      flexShrink: 0,
    },
    logoText: {
      fontSize: 16,
      fontWeight: 700,
      color: theme.colors.text,
      whiteSpace: "nowrap",
      letterSpacing: -0.3,
    },
    collapseBtn: {
      background: "none",
      border: "none",
      color: theme.colors.textMuted,
      cursor: "pointer",
      padding: 4,
      borderRadius: theme.radius.sm,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      transition: "color 0.2s",
    },
    navSection: {
      flex: 1,
      overflow: "auto",
      padding: "12px 8px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    },
    navGroup: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
    },
    navGroupLabel: {
      fontSize: 10,
      fontWeight: 700,
      color: theme.colors.textMuted,
      letterSpacing: 1.2,
      padding: "8px 12px 6px",
      opacity: 0.5,
    },
    navItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: collapsed ? "10px 0" : "8px 12px",
      justifyContent: collapsed ? "center" : "flex-start",
      borderRadius: theme.radius.sm,
      color: theme.colors.textMuted,
      textDecoration: "none",
      fontSize: 13,
      fontWeight: 500,
      transition: "all 0.15s ease",
      position: "relative",
      whiteSpace: "nowrap",
    },
    navItemActive: {
      color: theme.colors.text,
      background: `${theme.colors.primary}15`,
    },
    navIconWrap: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.sm,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      transition: "background 0.15s",
    },
    navIconWrapActive: {
      background: `${theme.colors.primary}22`,
    },
    navLabel: {
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    badge: {
      background: theme.colors.danger,
      color: "#fff",
      fontSize: 10,
      fontWeight: 700,
      padding: "1px 6px",
      borderRadius: 8,
      minWidth: 16,
      textAlign: "center",
    },
    activeBar: {
      position: "absolute",
      left: 0,
      top: "50%",
      transform: "translateY(-50%)",
      width: 3,
      height: 20,
      borderRadius: "0 3px 3px 0",
      background: theme.colors.primary,
    },
    subLinks: {
      display: "flex",
      flexDirection: "column",
      marginLeft: 20,
      borderLeft: `2px solid ${theme.colors.border}`,
      paddingLeft: 8,
      marginBottom: 4,
    },
    subLink: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "6px 10px",
      borderRadius: theme.radius.sm,
      textDecoration: "none",
      fontSize: 12,
      fontWeight: 500,
      color: theme.colors.textMuted,
      transition: "all 0.15s",
      whiteSpace: "nowrap",
    },
    bottomSection: {
      padding: collapsed ? "12px 8px" : "12px 16px",
      borderTop: `1px solid ${theme.colors.border}`,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    },
    themeToggle: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      justifyContent: collapsed ? "center" : "flex-start",
      padding: "8px 12px",
      borderRadius: theme.radius.sm,
      border: "none",
      background: "transparent",
      color: theme.colors.textMuted,
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 500,
      transition: "background 0.15s",
      width: "100%",
    },
    themeLabel: {
      whiteSpace: "nowrap",
    },
    userBlock: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 6px",
      borderRadius: theme.radius.sm,
      background: `${theme.colors.bg}`,
      justifyContent: collapsed ? "center" : "flex-start",
    },
    userAvatar: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${theme.colors.primary}, #818cf8)`,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 13,
      fontWeight: 700,
      flexShrink: 0,
    },
    userInfo: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      overflow: "hidden",
      flex: 1,
    },
    userName: {
      fontSize: 12,
      fontWeight: 600,
      color: theme.colors.text,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    roleBadge: {
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    logoutBtn: {
      background: "none",
      border: "none",
      color: theme.colors.textMuted,
      cursor: "pointer",
      padding: 4,
      borderRadius: theme.radius.sm,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      transition: "color 0.2s",
    },
  };
}

export default Navbar;
