import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";

const iconMap = {
  s3: "🪣",
  ec2: "🖥️",
  rds: "🗄️",
  vpc: "🌐",
  "security-group": "🛡️",
  eks: "☸️",
  ecs: "🐳",
  lambda: "⚡",
  autoscaling: "📈",
  alb: "⚖️",
  cloudfront: "🌍",
  route53: "🔗",
  apigateway: "🚪",
  dynamodb: "📊",
  elasticache: "💾",
  ecr: "📦",
  sns: "📢",
  sqs: "📬",
  kms: "🔐",
  acm: "📜",
  iam: "👤",
  secrets: "🔑",
};

const categoryColors = {
  compute: { bg: "rgba(99,102,241,0.12)", text: "#818cf8" },
  networking: { bg: "rgba(34,211,238,0.12)", text: "#22d3ee" },
  database: { bg: "rgba(251,146,60,0.12)", text: "#fb923c" },
  storage: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
  messaging: { bg: "rgba(168,85,247,0.12)", text: "#a855f7" },
  security: { bg: "rgba(239,68,68,0.12)", text: "#f87171" },
};

const providerBadge = {
  aws:          { label: "AWS",         color: "#FF9900", bg: "rgba(255,153,0,0.13)",   icon: "☁️" },
  azurerm:      { label: "Azure",       color: "#0078D4", bg: "rgba(0,120,212,0.13)",   icon: "🔷" },
  google:       { label: "GCP",         color: "#4285F4", bg: "rgba(66,133,244,0.13)",  icon: "🌐" },
  huaweicloud:  { label: "Huawei",      color: "#CF0A2C", bg: "rgba(207,10,44,0.13)",   icon: "🔴" },
  digitalocean: { label: "DO",          color: "#0080FF", bg: "rgba(0,128,255,0.13)",   icon: "🌊" },
};

function ResourceCard({ resource }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const navigate = useNavigate();
  const cat = categoryColors[resource.category] || categoryColors.compute;
  const prov = providerBadge[resource.provider] || { label: resource.provider?.toUpperCase(), color: "#64748b", bg: "rgba(100,116,139,0.12)", icon: "☁️" };

  return (
    <div
      style={styles.card}
      onClick={() => navigate(`/resource/${resource.id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = theme.colors.cardHover;
        e.currentTarget.style.borderColor = theme.colors.primary;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = theme.colors.card;
        e.currentTarget.style.borderColor = theme.colors.border;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={styles.topRow}>
        <div style={styles.icon}>{iconMap[resource.icon] || "📦"}</div>
        <span
          style={{
            ...styles.categoryBadge,
            background: cat.bg,
            color: cat.text,
          }}
        >
          {resource.category || "general"}
        </span>
      </div>
      <div style={styles.info}>
        <div style={styles.name}>{resource.name}</div>
        <div style={styles.description}>{resource.description}</div>
      </div>
      <div style={styles.footer}>
        <span style={{ ...styles.providerBadge, background: prov.bg, color: prov.color }}>
          <span style={{ fontSize: 12 }}>{prov.icon}</span>
          {prov.label}
        </span>
        <span style={styles.inputs}>
          {resource.inputs?.length || 0} inputs
        </span>
      </div>
    </div>
  );
}

function getStyles(theme) {
  return {
  card: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: 22,
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minHeight: 180,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  icon: {
    fontSize: 36,
    lineHeight: 1,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 12,
    textTransform: "capitalize",
    letterSpacing: 0.3,
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.colors.text,
  },
  description: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 1.5,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  providerBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 10,
    letterSpacing: "0.3px",
  },
  inputs: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
};
}

export default ResourceCard;
