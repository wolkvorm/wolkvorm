import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

import { API, authFetch } from "../config";

const ROLE_COLORS = {
  admin: { bg: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "rgba(139,92,246,0.3)" },
  operator: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  deployer: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
  viewer: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", border: "rgba(148,163,184,0.3)" },
};

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.viewer;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      {role}
    </span>
  );
}

function SettingsPage() {
  const { canManageUsers } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  // AWS state
  const [awsRegion, setAwsRegion] = useState("eu-central-1");
  const [awsStatus, setAwsStatus] = useState(null);
  const [awsSaving, setAwsSaving] = useState(false);

  // GitHub state
  const [ghAuthMethod, setGhAuthMethod] = useState("pat"); // "pat" or "app"
  const [ghToken, setGhToken] = useState("");
  const [ghAppId, setGhAppId] = useState("");
  const [ghPem, setGhPem] = useState("");
  const [ghStatus, setGhStatus] = useState(null);
  const [ghSaving, setGhSaving] = useState(false);

  // Infracost state
  const [icKey, setIcKey] = useState("");
  const [icStatus, setIcStatus] = useState(null);
  const [icSaving, setIcSaving] = useState(false);
  const [icMsg, setIcMsg] = useState(null);

  // State backend
  const [stateInfo, setStateInfo] = useState(null);
  const [stateInitializing, setStateInitializing] = useState(false);
  const [stateError, setStateError] = useState(null);

  // Notifications state
  const [notifConfig, setNotifConfig] = useState({ slack_webhook: "", teams_webhook: "", discord_webhook: "", email_smtp: { host: "", port: "", user: "", password: "", from: "", to: "" }, enabled_events: [] });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState(null);
  const [testingChannel, setTestingChannel] = useState("");

  // Approval workflow
  const [approvalRequired, setApprovalRequired] = useState(false);

  // Drift detection
  const [driftEnabled, setDriftEnabled] = useState(false);
  const [driftInterval, setDriftInterval] = useState(6);

  // API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRole, setNewKeyRole] = useState("viewer");
  const [generatedKey, setGeneratedKey] = useState("");

  // AWS Accounts
  const [accounts, setAccounts] = useState([]);
  const [newAccName, setNewAccName] = useState("");
  const [newAccRoleARN, setNewAccRoleARN] = useState("");
  const [newAccExternalID, setNewAccExternalID] = useState("");
  const [newAccRegion, setNewAccRegion] = useState("us-east-1");
  const [verifyingAccount, setVerifyingAccount] = useState(null);

  // User Management state
  const [users, setUsers] = useState([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [newUserRole, setNewUserRole] = useState("viewer");
  const [userMsg, setUserMsg] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);

  // Messages
  const [awsMsg, setAwsMsg] = useState(null);
  const [ghMsg, setGhMsg] = useState(null);

  useEffect(() => {
    authFetch(`${API}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        setAwsStatus(data.aws);
        setGhStatus(data.github);
        setIcStatus(data.infracost);
        if (data.aws?.default_region) {
          setAwsRegion(data.aws.default_region);
        }
        if (data.github?.auth_method) {
          setGhAuthMethod(data.github.auth_method);
        }
        if (data.github?.app_id) {
          setGhAppId(data.github.app_id);
        }
      })
      .catch(() => { });

    authFetch(`${API}/api/state`)
      .then((res) => res.json())
      .then((data) => { if (data.ready) setStateInfo(data); })
      .catch(() => { });

    authFetch(`${API}/api/settings/notifications`)
      .then((res) => res.json())
      .then(setNotifConfig)
      .catch(() => { });

    authFetch(`${API}/api/settings/approval`)
      .then((res) => res.json())
      .then((data) => setApprovalRequired(data.required || false))
      .catch(() => { });

    authFetch(`${API}/api/settings/drift`)
      .then((res) => res.json())
      .then((data) => { setDriftEnabled(data.enabled || false); setDriftInterval(data.interval_hours || 6); })
      .catch(() => { });

    authFetch(`${API}/api/api-keys`)
      .then((res) => res.json())
      .then((data) => setApiKeys(Array.isArray(data) ? data : []))
      .catch(() => { });

    authFetch(`${API}/api/accounts`)
      .then((res) => res.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => { });

    if (canManageUsers) {
      authFetch(`${API}/api/auth/users`)
        .then((res) => res.json())
        .then((data) => setUsers(Array.isArray(data) ? data : []))
        .catch(() => { });
    }
  }, [canManageUsers]);

  const saveAWS = async () => {
    setAwsSaving(true);
    setAwsMsg(null);
    try {
      const res = await authFetch(`${API}/api/settings/aws`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_region: awsRegion }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      setAwsMsg({ type: "success", text: "AWS configuration saved (IAM Role)" });
      const statusRes = await authFetch(`${API}/api/settings/aws`);
      const statusData = await statusRes.json();
      setAwsStatus(statusData);
    } catch (err) {
      setAwsMsg({ type: "error", text: err.message });
    }
    setAwsSaving(false);
  };

  const verifyAccount = async (accId) => {
    setVerifyingAccount(accId);
    try {
      const res = await authFetch(`${API}/api/accounts/${accId}/verify`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert("Verification failed: " + data.error);
      } else {
        alert("Verified! AWS Account ID: " + data.account_id);
        const r = await authFetch(`${API}/api/accounts`);
        setAccounts(await r.json());
      }
    } catch (err) {
      alert("Verification failed: " + err.message);
    }
    setVerifyingAccount(null);
  };

  const saveGitHub = async () => {
    setGhSaving(true);
    setGhMsg(null);
    try {
      const body =
        ghAuthMethod === "pat"
          ? { auth_method: "pat", pat: ghToken }
          : { auth_method: "app", app_id: ghAppId, private_key: ghPem };

      const res = await authFetch(`${API}/api/settings/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      setGhMsg({ type: "success", text: "GitHub config saved successfully" });
      setGhToken("");
      setGhPem("");
      // Refresh status
      const statusRes = await authFetch(`${API}/api/settings`);
      const statusData = await statusRes.json();
      setGhStatus(statusData.github);
    } catch (err) {
      setGhMsg({ type: "error", text: err.message });
    }
    setGhSaving(false);
  };

  const initStateBackend = async () => {
    setStateInitializing(true);
    setStateError(null);
    try {
      const res = await authFetch(`${API}/api/state/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        setStateError(data.error);
      } else {
        setStateInfo(data);
      }
    } catch (err) {
      setStateError(err.message);
    }
    setStateInitializing(false);
  };

  const saveInfracost = async () => {
    setIcSaving(true);
    setIcMsg(null);
    try {
      const res = await authFetch(`${API}/api/settings/infracost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: icKey }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      setIcMsg({ type: "success", text: "Infracost API key saved successfully" });
      setIcKey("");
      const statusRes = await authFetch(`${API}/api/settings`);
      const statusData = await statusRes.json();
      setIcStatus(statusData.infracost);
    } catch (err) {
      setIcMsg({ type: "error", text: err.message });
    }
    setIcSaving(false);
  };

  const handlePemFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setGhPem(ev.target.result);
    };
    reader.readAsText(file);
  };

  const ghSaveDisabled =
    ghSaving ||
    (ghAuthMethod === "pat" ? !ghToken : !ghAppId || !ghPem);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>
          Configure your cloud provider credentials and integrations
        </p>
      </div>

      {/* AWS Configuration */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={{ ...styles.sectionIcon, background: "rgba(245,158,11,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>AWS Configuration</h2>
            <p style={styles.sectionDesc}>
              IAM Role authentication via EC2 instance profile
            </p>
          </div>
          {awsStatus?.configured && (
            <div style={styles.badge}>
              <span style={styles.badgeDot} />
              IAM Role Active
            </div>
          )}
        </div>

        {awsStatus?.configured && (
          <div style={styles.currentConfig}>
            <div style={styles.configItem}>
              <span style={styles.configLabel}>Auth Method</span>
              <span style={styles.configValue}>IAM Role (EC2 Instance Profile)</span>
            </div>
            <div style={styles.configItem}>
              <span style={styles.configLabel}>Default Region</span>
              <span style={styles.configValue}>{awsStatus.default_region}</span>
            </div>
          </div>
        )}

        <div style={styles.form}>
          <div style={styles.infoBoxSmall}>
            Wolkvorm uses the EC2 instance&apos;s attached IAM Role for AWS operations. No static access keys are stored.
            To configure, attach an IAM Role to your EC2 instance via AWS Console &rarr; EC2 &rarr; Actions &rarr; Security &rarr; Modify IAM Role.
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Default Region</label>
            <select
              style={styles.input}
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
            >
              <option value="us-east-1">us-east-1 (N. Virginia)</option>
              <option value="us-east-2">us-east-2 (Ohio)</option>
              <option value="us-west-1">us-west-1 (N. California)</option>
              <option value="us-west-2">us-west-2 (Oregon)</option>
              <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
              <option value="eu-west-1">eu-west-1 (Ireland)</option>
              <option value="eu-west-2">eu-west-2 (London)</option>
              <option value="eu-north-1">eu-north-1 (Stockholm)</option>
              <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
              <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
            </select>
          </div>

          {awsMsg && (
            <div
              style={{
                ...styles.message,
                background: awsMsg.type === "success" ? `${theme.colors.success}18` : `${theme.colors.danger}18`,
                borderColor: awsMsg.type === "success" ? theme.colors.success : theme.colors.danger,
                color: awsMsg.type === "success" ? theme.colors.success : theme.colors.danger,
              }}
            >
              {awsMsg.text}
            </div>
          )}

          <button
            style={{ ...styles.saveBtn, opacity: awsSaving ? 0.5 : 1 }}
            onClick={saveAWS}
            disabled={awsSaving}
          >
            {awsSaving ? "Saving..." : "Save AWS Configuration"}
          </button>
        </div>
      </div>

      {/* GitHub */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" fill="#e2e8f0" />
            </svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>GitHub</h2>
            <p style={styles.sectionDesc}>
              Connect GitHub for automated PR creation
            </p>
          </div>
          {ghStatus?.configured && (
            <div style={styles.badge}>
              <span style={styles.badgeDot} />
              Connected ({ghStatus.auth_method === "pat" ? "Token" : "App"})
            </div>
          )}
        </div>

        {ghStatus?.configured && (
          <div style={styles.currentConfig}>
            {ghStatus.auth_method === "pat" ? (
              <div style={styles.configItem}>
                <span style={styles.configLabel}>Token</span>
                <span style={styles.configValue}>{ghStatus.token_preview}</span>
              </div>
            ) : (
              <>
                <div style={styles.configItem}>
                  <span style={styles.configLabel}>App ID</span>
                  <span style={styles.configValue}>{ghStatus.app_id}</span>
                </div>
                <div style={styles.configItem}>
                  <span style={styles.configLabel}>Private Key</span>
                  <span style={styles.configValue}>Configured</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Auth Method Toggle */}
        <div style={styles.toggleRow}>
          <button
            style={{
              ...styles.toggleBtn,
              ...(ghAuthMethod === "pat" ? styles.toggleActive : {}),
            }}
            onClick={() => setGhAuthMethod("pat")}
          >
            Personal Access Token
          </button>
          <button
            style={{
              ...styles.toggleBtn,
              ...(ghAuthMethod === "app" ? styles.toggleActive : {}),
            }}
            onClick={() => setGhAuthMethod("app")}
          >
            GitHub App
          </button>
        </div>

        <div style={styles.form}>
          {ghAuthMethod === "pat" ? (
            <>
              <div style={styles.field}>
                <label style={styles.label}>Personal Access Token</label>
                <input
                  type="password"
                  style={styles.input}
                  placeholder="github_pat_xxxxxxxxxxxxxxxxxxxx"
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                />
                <span style={styles.hint}>
                  GitHub Settings &rarr; Developer Settings &rarr; Personal Access Tokens &rarr; Fine-grained tokens
                </span>
              </div>

              <div style={styles.infoBoxSmall}>
                <strong>Required permissions:</strong> Repository access (select repos) + Contents (Read and Write) + Pull Requests (Read and Write)
              </div>
            </>
          ) : (
            <>
              <div style={styles.field}>
                <label style={styles.label}>GitHub App ID</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="123456"
                  value={ghAppId}
                  onChange={(e) => setGhAppId(e.target.value)}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Private Key (.pem)</label>
                <div style={styles.pemRow}>
                  <label style={styles.fileBtn}>
                    Choose .pem file
                    <input
                      type="file"
                      accept=".pem"
                      onChange={handlePemFile}
                      style={{ display: "none" }}
                    />
                  </label>
                  <span style={styles.pemHint}>
                    {ghPem ? "File loaded" : "or paste below"}
                  </span>
                </div>
                <textarea
                  style={{ ...styles.input, ...styles.textarea }}
                  placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
                  value={ghPem}
                  onChange={(e) => setGhPem(e.target.value)}
                  rows={6}
                />
              </div>
            </>
          )}

          {ghMsg && (
            <div
              style={{
                ...styles.message,
                background: ghMsg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                borderColor: ghMsg.type === "success" ? theme.colors.success : theme.colors.danger,
                color: ghMsg.type === "success" ? theme.colors.success : theme.colors.danger,
              }}
            >
              {ghMsg.text}
            </div>
          )}

          <button
            style={{ ...styles.saveBtn, opacity: ghSaveDisabled ? 0.5 : 1 }}
            onClick={saveGitHub}
            disabled={ghSaveDisabled}
          >
            {ghSaving
              ? "Saving..."
              : ghStatus?.configured
                ? "Update GitHub Config"
                : "Save GitHub Config"}
          </button>
        </div>
      </div>

      {/* State Backend */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={{ ...styles.sectionIcon, background: "rgba(99,102,241,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4M4 12c0 2.21 3.58 4 8 4s8-1.79 8-4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>Terraform State Backend</h2>
            <p style={styles.sectionDesc}>
              Remote S3 bucket for storing Terraform state files
            </p>
          </div>
          {stateInfo && (
            <div style={styles.badge}>
              <span style={styles.badgeDot} />
              Active
            </div>
          )}
        </div>

        {stateInfo ? (
          <div style={styles.currentConfig}>
            <div style={styles.configItem}>
              <span style={styles.configLabel}>Bucket</span>
              <span style={styles.configValue}>{stateInfo.bucket}</span>
            </div>
            <div style={styles.configItem}>
              <span style={styles.configLabel}>Lock Table</span>
              <span style={styles.configValue}>{stateInfo.lock_table}</span>
            </div>
            <div style={styles.configItem}>
              <span style={styles.configLabel}>Region</span>
              <span style={styles.configValue}>{stateInfo.region}</span>
            </div>
          </div>
        ) : (
          <div style={styles.form}>
            <div style={styles.infoBoxSmall}>
              State backend stores Terraform state files in S3 with DynamoDB locking.
              This is required for tracking and managing deployed resources.
              Initializing will create a bucket and DynamoDB table in your AWS account.
            </div>

            {stateError && (
              <div style={{
                ...styles.message,
                background: "rgba(239,68,68,0.1)",
                borderColor: theme.colors.danger,
                color: theme.colors.danger,
              }}>
                {stateError}
              </div>
            )}

            <button
              style={{ ...styles.saveBtn, opacity: stateInitializing ? 0.5 : 1 }}
              onClick={initStateBackend}
              disabled={stateInitializing}
            >
              {stateInitializing ? "Initializing..." : "Initialize State Backend"}
            </button>
          </div>
        )}
      </div>

      {/* Infracost */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={{ ...styles.sectionIcon, background: "rgba(16,185,129,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>Infracost</h2>
            <p style={styles.sectionDesc}>
              Cost estimation for infrastructure changes
            </p>
          </div>
          {icStatus?.configured && (
            <div style={styles.badge}>
              <span style={styles.badgeDot} />
              Connected
            </div>
          )}
        </div>

        {icStatus?.configured && (
          <div style={styles.currentConfig}>
            <div style={styles.configItem}>
              <span style={styles.configLabel}>API Key</span>
              <span style={styles.configValue}>{icStatus.key_preview}</span>
            </div>
          </div>
        )}

        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Infracost API Key</label>
            <input
              type="password"
              style={styles.input}
              placeholder="ico-xxxxxxxxxxxxxxxxxxxx"
              value={icKey}
              onChange={(e) => setIcKey(e.target.value)}
            />
            <span style={styles.hint}>
              Get your free key at{" "}
              <a href="https://www.infracost.io" target="_blank" rel="noreferrer" style={{ color: "#10b981" }}>
                infracost.io
              </a>{" "}
              or run <code style={styles.code}>infracost auth login</code>
            </span>
          </div>

          {icMsg && (
            <div
              style={{
                ...styles.message,
                background: icMsg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                borderColor: icMsg.type === "success" ? theme.colors.success : theme.colors.danger,
                color: icMsg.type === "success" ? theme.colors.success : theme.colors.danger,
              }}
            >
              {icMsg.text}
            </div>
          )}

          <button
            style={{ ...styles.saveBtn, opacity: icSaving || !icKey ? 0.5 : 1, background: "#10b981" }}
            onClick={saveInfracost}
            disabled={icSaving || !icKey}
          >
            {icSaving ? "Saving..." : icStatus?.configured ? "Update API Key" : "Save API Key"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={{ ...styles.sectionIcon, background: "rgba(236,72,153,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>Notifications</h2>
            <p style={styles.sectionDesc}>Get notified about infrastructure changes</p>
          </div>
        </div>
        <div style={styles.form}>
          <div style={styles.fieldRow}>
            <div style={styles.field}>
              <label style={styles.label}>Slack Webhook URL</label>
              <input style={styles.input} placeholder="https://hooks.slack.com/services/..." value={notifConfig.slack_webhook || ""} onChange={e => setNotifConfig({ ...notifConfig, slack_webhook: e.target.value })} />
            </div>
            <button style={styles.testChannelBtn} onClick={async () => {
              try {
                setTestingChannel("slack");
                await authFetch(`${API}/api/settings/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notifConfig) });
                const res = await authFetch(`${API}/api/settings/notifications/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "slack" }) });
                if (!res.ok) { const t = await res.text(); setNotifMsg({ type: "error", text: t }); } else { setNotifMsg({ type: "success", text: "Slack test sent" }); }
              } catch (err) { setNotifMsg({ type: "error", text: "Failed: " + err.message }); }
              setTestingChannel("");
            }}>
              {testingChannel === "slack" ? "..." : "Test"}
            </button>
          </div>
          <div style={styles.fieldRow}>
            <div style={styles.field}>
              <label style={styles.label}>Microsoft Teams Webhook URL</label>
              <input style={styles.input} placeholder="https://outlook.office.com/webhook/..." value={notifConfig.teams_webhook || ""} onChange={e => setNotifConfig({ ...notifConfig, teams_webhook: e.target.value })} />
            </div>
            <button style={styles.testChannelBtn} onClick={async () => {
              try {
                setTestingChannel("teams");
                await authFetch(`${API}/api/settings/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notifConfig) });
                const res = await authFetch(`${API}/api/settings/notifications/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "teams" }) });
                if (!res.ok) { const t = await res.text(); setNotifMsg({ type: "error", text: t }); } else { setNotifMsg({ type: "success", text: "Teams test sent" }); }
              } catch (err) { setNotifMsg({ type: "error", text: "Failed: " + err.message }); }
              setTestingChannel("");
            }}>
              {testingChannel === "teams" ? "..." : "Test"}
            </button>
          </div>
          <div style={styles.fieldRow}>
            <div style={styles.field}>
              <label style={styles.label}>Discord Webhook URL</label>
              <input style={styles.input} placeholder="https://discord.com/api/webhooks/..." value={notifConfig.discord_webhook || ""} onChange={e => setNotifConfig({ ...notifConfig, discord_webhook: e.target.value })} />
            </div>
            <button style={styles.testChannelBtn} onClick={async () => {
              try {
                setTestingChannel("discord");
                await authFetch(`${API}/api/settings/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notifConfig) });
                const res = await authFetch(`${API}/api/settings/notifications/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "discord" }) });
                if (!res.ok) { const t = await res.text(); setNotifMsg({ type: "error", text: t }); } else { setNotifMsg({ type: "success", text: "Discord test sent" }); }
              } catch (err) { setNotifMsg({ type: "error", text: "Failed: " + err.message }); }
              setTestingChannel("");
            }}>
              {testingChannel === "discord" ? "..." : "Test"}
            </button>
          </div>
          {notifMsg && <div style={{ ...styles.message, background: notifMsg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", borderColor: notifMsg.type === "success" ? theme.colors.success : theme.colors.danger, color: notifMsg.type === "success" ? theme.colors.success : theme.colors.danger }}>{notifMsg.text}</div>}
          <button style={{ ...styles.saveBtn, opacity: notifSaving ? 0.5 : 1, background: "#ec4899" }} onClick={async () => {
            setNotifSaving(true);
            try {
              await authFetch(`${API}/api/settings/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notifConfig) });
              setNotifMsg({ type: "success", text: "Notification settings saved" });
            } catch (err) { setNotifMsg({ type: "error", text: "Failed to save: " + err.message }); }
            setNotifSaving(false);
          }} disabled={notifSaving}>
            {notifSaving ? "Saving..." : "Save Notification Settings"}
          </button>
        </div>
      </div>

      {/* Approval Workflow */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={{ ...styles.sectionIcon, background: "rgba(245,158,11,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>Approval Workflow</h2>
            <p style={styles.sectionDesc}>Require approval before apply/destroy operations</p>
          </div>
        </div>
        <div style={styles.form}>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={approvalRequired} onChange={async (e) => {
              const val = e.target.checked;
              setApprovalRequired(val);
              await authFetch(`${API}/api/settings/approval`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ required: val }) });
            }} />
            <span style={{ fontSize: 14, color: theme.colors.text }}>Require approval for apply and destroy operations</span>
          </label>
        </div>
      </div>

      {/* Drift Detection */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={{ ...styles.sectionIcon, background: "rgba(6,182,212,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>Drift Detection</h2>
            <p style={styles.sectionDesc}>Automatically check for infrastructure drift</p>
          </div>
        </div>
        <div style={styles.form}>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={driftEnabled} onChange={(e) => setDriftEnabled(e.target.checked)} />
            <span style={{ fontSize: 14, color: theme.colors.text }}>Enable automatic drift detection</span>
          </label>
          {driftEnabled && (
            <div style={styles.field}>
              <label style={styles.label}>Check Interval (hours)</label>
              <input style={{ ...styles.input, width: 100 }} type="number" min={1} value={driftInterval} onChange={e => setDriftInterval(parseInt(e.target.value) || 6)} />
            </div>
          )}
          <button style={{ ...styles.saveBtn, background: "#06b6d4" }} onClick={async () => {
            await authFetch(`${API}/api/settings/drift`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: driftEnabled, interval_hours: driftInterval }) });
          }}>Save Drift Settings</button>
        </div>
      </div>

      {/* API Keys */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={{ ...styles.sectionIcon, background: "rgba(139,92,246,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>API Keys</h2>
            <p style={styles.sectionDesc}>Manage access with role-based API keys</p>
          </div>
        </div>
        <div style={styles.form}>
          {generatedKey && (
            <div style={{ ...styles.message, background: "rgba(34,197,94,0.1)", borderColor: theme.colors.success, color: theme.colors.success }}>
              API Key generated (copy now, it won't be shown again):<br />
              <code style={{ ...styles.code, fontSize: 14, display: "block", marginTop: 8, wordBreak: "break-all" }}>{generatedKey}</code>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={styles.field}>
              <label style={styles.label}>Name</label>
              <input style={styles.input} placeholder="e.g. CI/CD Pipeline" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Role</label>
              <select style={styles.input} value={newKeyRole} onChange={e => setNewKeyRole(e.target.value)}>
                <option value="viewer">Viewer (read-only)</option>
                <option value="deployer">Deployer (plan/apply)</option>
                <option value="operator">Operator (approve/policies)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </div>
            <button style={{ ...styles.saveBtn, background: "#8b5cf6" }} onClick={async () => {
              const res = await authFetch(`${API}/api/api-keys`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newKeyName, role: newKeyRole }) });
              const data = await res.json();
              if (data.key) { setGeneratedKey(data.key); setNewKeyName(""); }
              const keysRes = await authFetch(`${API}/api/api-keys`);
              setApiKeys(await keysRes.json());
            }} disabled={!newKeyName}>Generate Key</button>
          </div>
          {apiKeys.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {apiKeys.filter(k => k.is_active).map(k => (
                <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: theme.colors.bg, borderRadius: theme.radius.sm, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: theme.colors.text }}>{k.name}</span>
                  <span style={{ fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase" }}>{k.role}</span>
                  <span style={{ fontSize: 11, color: theme.colors.textMuted }}>{k.last_used_at || "Never used"}</span>
                  <button style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "rgba(239,68,68,0.1)", color: theme.colors.danger, fontSize: 11, cursor: "pointer" }} onClick={async () => {
                    await authFetch(`${API}/api/api-keys/${k.id}`, { method: "DELETE" });
                    const keysRes = await authFetch(`${API}/api/api-keys`);
                    setApiKeys(await keysRes.json());
                  }}>Revoke</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AWS Accounts */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={{ ...styles.sectionIcon, background: "rgba(245,158,11,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <h2 style={styles.sectionTitle}>AWS Accounts</h2>
            <p style={styles.sectionDesc}>Connect multiple AWS accounts via IAM Role (AssumeRole)</p>
          </div>
        </div>
        <div style={styles.form}>
          <div style={styles.infoBoxSmall}>
            <strong>How to connect an AWS account:</strong><br />
            1. In the target AWS account, go to IAM &rarr; Roles &rarr; Create Role<br />
            2. Select &quot;Another AWS account&quot; and enter the Wolkvorm EC2 account ID<br />
            3. Optionally set an External ID for extra security<br />
            4. Attach required permissions (e.g. AdministratorAccess or custom policy)<br />
            5. Copy the Role ARN and paste it below
          </div>

          {accounts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {accounts.map(a => (
                <div key={a.id} style={{
                  padding: "12px 14px",
                  background: theme.colors.bg,
                  borderRadius: theme.radius.sm,
                  marginBottom: 6,
                  borderLeft: a.is_default ? `3px solid ${theme.colors.success}` : "3px solid transparent",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text }}>{a.name}</span>
                      {a.is_default ? <span style={{ fontSize: 10, color: theme.colors.success, marginLeft: 8, fontWeight: 600 }}>DEFAULT</span> : null}
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {a.account_id ? (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${theme.colors.success}22`, color: theme.colors.success, fontWeight: 600 }}>Verified</span>
                      ) : (
                        <button
                          style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${theme.colors.primary}`, background: "transparent", color: theme.colors.primary, fontSize: 11, cursor: "pointer", opacity: verifyingAccount === a.id ? 0.5 : 1 }}
                          onClick={() => verifyAccount(a.id)}
                          disabled={verifyingAccount === a.id}
                        >
                          {verifyingAccount === a.id ? "Verifying..." : "Verify"}
                        </button>
                      )}
                      {!a.is_default && <button style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${theme.colors.border}`, background: "transparent", color: theme.colors.text, fontSize: 11, cursor: "pointer" }} onClick={async () => {
                        await authFetch(`${API}/api/accounts/${a.id}/default`, { method: "POST" });
                        const r = await authFetch(`${API}/api/accounts`); setAccounts(await r.json());
                      }}>Set Default</button>}
                      <button style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: `${theme.colors.danger}18`, color: theme.colors.danger, fontSize: 11, cursor: "pointer" }} onClick={async () => {
                        await authFetch(`${API}/api/accounts/${a.id}`, { method: "DELETE" });
                        const r = await authFetch(`${API}/api/accounts`); setAccounts(await r.json());
                      }}>Remove</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: theme.colors.textMuted }}>
                    <span>Role: <span style={{ fontFamily: theme.fonts.mono, fontSize: 11 }}>{a.role_arn_preview || a.role_arn}</span></span>
                    <span>Region: {a.default_region}</span>
                    {a.account_id && <span>Account: {a.account_id}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Account Name</label>
            <input style={styles.input} placeholder="e.g. Production, Staging" value={newAccName} onChange={e => setNewAccName(e.target.value)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Role ARN</label>
            <input style={styles.input} placeholder="arn:aws:iam::123456789012:role/WolkvormRole" value={newAccRoleARN} onChange={e => setNewAccRoleARN(e.target.value)} />
          </div>
          <div style={styles.fieldRow}>
            <div style={styles.field}>
              <label style={styles.label}>External ID (optional)</label>
              <input style={styles.input} placeholder="Optional security identifier" value={newAccExternalID} onChange={e => setNewAccExternalID(e.target.value)} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Default Region</label>
              <select style={styles.input} value={newAccRegion} onChange={e => setNewAccRegion(e.target.value)}>
                <option value="us-east-1">us-east-1</option>
                <option value="us-east-2">us-east-2</option>
                <option value="us-west-1">us-west-1</option>
                <option value="us-west-2">us-west-2</option>
                <option value="eu-central-1">eu-central-1</option>
                <option value="eu-west-1">eu-west-1</option>
                <option value="eu-west-2">eu-west-2</option>
                <option value="eu-north-1">eu-north-1</option>
                <option value="ap-northeast-1">ap-northeast-1</option>
                <option value="ap-southeast-1">ap-southeast-1</option>
              </select>
            </div>
          </div>
          <button style={{ ...styles.saveBtn, background: "#f59e0b" }} disabled={!newAccName || !newAccRoleARN} onClick={async () => {
            const res = await authFetch(`${API}/api/accounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newAccName, role_arn: newAccRoleARN, external_id: newAccExternalID, default_region: newAccRegion }) });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            setNewAccName(""); setNewAccRoleARN(""); setNewAccExternalID("");
            const r = await authFetch(`${API}/api/accounts`); setAccounts(await r.json());
          }}>Connect AWS Account</button>
        </div>
      </div>

      {/* User Management (admin only) */}
      {canManageUsers && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={{ ...styles.sectionIcon, background: "rgba(34,197,94,0.1)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <h2 style={styles.sectionTitle}>User Management</h2>
              <p style={styles.sectionDesc}>Create and manage user accounts with role-based access</p>
            </div>
          </div>
          <div style={styles.form}>
            {/* Existing users list */}
            {users.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 140px 80px", gap: 8, padding: "0 14px", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Username</span>
                  <span style={{ fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Display Name</span>
                  <span style={{ fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Role</span>
                  <span style={{ fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Last Login</span>
                  <span style={{ fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}></span>
                </div>
                {users.map(u => (
                  <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 140px 80px", gap: 8, alignItems: "center", padding: "10px 14px", background: theme.colors.bg, borderRadius: theme.radius.sm, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: theme.colors.text, fontWeight: 500 }}>{u.username}</span>
                    <span style={{ fontSize: 13, color: theme.colors.textMuted }}>{u.display_name || "-"}</span>
                    <RoleBadge role={u.role} />
                    <span style={{ fontSize: 11, color: theme.colors.textMuted }}>{u.last_login_at || "Never"}</span>
                    <div style={{ textAlign: "right" }}>
                      {deletingUserId === u.id ? (
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: "rgba(239,68,68,0.2)", color: theme.colors.danger, fontSize: 11, cursor: "pointer", fontWeight: 600 }} onClick={async () => {
                            try {
                              await authFetch(`${API}/api/auth/users/${u.id}`, { method: "DELETE" });
                              setUsers(prev => prev.filter(x => x.id !== u.id));
                              setUserMsg({ type: "success", text: `User "${u.username}" deleted` });
                            } catch (err) {
                              setUserMsg({ type: "error", text: err.message });
                            }
                            setDeletingUserId(null);
                          }}>Yes</button>
                          <button style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${theme.colors.border}`, background: "transparent", color: theme.colors.textMuted, fontSize: 11, cursor: "pointer" }} onClick={() => setDeletingUserId(null)}>No</button>
                        </div>
                      ) : (
                        <button style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "rgba(239,68,68,0.1)", color: theme.colors.danger, fontSize: 11, cursor: "pointer" }} onClick={() => setDeletingUserId(u.id)}>Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new user form */}
            <div style={{ padding: "16px", background: "rgba(34,197,94,0.04)", borderRadius: theme.radius.sm, border: `1px solid rgba(34,197,94,0.15)` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text, marginBottom: 12 }}>Add New User</div>
              <div style={styles.fieldRow}>
                <div style={styles.field}>
                  <label style={styles.label}>Username</label>
                  <input style={styles.input} placeholder="e.g. john.doe" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Display Name</label>
                  <input style={styles.input} placeholder="e.g. John Doe" value={newUserDisplayName} onChange={e => setNewUserDisplayName(e.target.value)} />
                </div>
              </div>
              <div style={{ ...styles.fieldRow, marginTop: 12 }}>
                <div style={styles.field}>
                  <label style={styles.label}>Password</label>
                  <input type="password" style={styles.input} placeholder="Min 6 characters" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Role</label>
                  <select style={styles.input} value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                    <option value="viewer">Viewer (read-only)</option>
                    <option value="deployer">Deployer (plan/apply)</option>
                    <option value="operator">Operator (approve/policies)</option>
                    <option value="admin">Admin (full access)</option>
                  </select>
                </div>
              </div>

              {userMsg && (
                <div style={{ ...styles.message, marginTop: 12, background: userMsg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", borderColor: userMsg.type === "success" ? theme.colors.success : theme.colors.danger, color: userMsg.type === "success" ? theme.colors.success : theme.colors.danger }}>
                  {userMsg.text}
                </div>
              )}

              <button style={{ ...styles.saveBtn, background: "#22c55e", marginTop: 16 }} disabled={!newUserName || !newUserPassword || newUserPassword.length < 6} onClick={async () => {
                setUserMsg(null);
                try {
                  const res = await authFetch(`${API}/api/auth/users`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username: newUserName,
                      password: newUserPassword,
                      display_name: newUserDisplayName || newUserName,
                      role: newUserRole,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    throw new Error(data.error || "Failed to create user");
                  }
                  setUserMsg({ type: "success", text: `User "${data.username}" created successfully` });
                  setNewUserName(""); setNewUserPassword(""); setNewUserDisplayName(""); setNewUserRole("viewer");
                  // Refresh user list
                  const usersRes = await authFetch(`${API}/api/auth/users`);
                  setUsers(await usersRes.json());
                } catch (err) {
                  setUserMsg({ type: "error", text: err.message });
                }
              }}>
                Create User
              </button>
            </div>

            <div style={styles.infoBoxSmall}>
              <strong>Role Hierarchy:</strong> Admin &gt; Operator &gt; Deployer &gt; Viewer.
              New users will be required to change their password on first login.
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div style={styles.infoBox}>
        <strong>Security Note:</strong> Credentials are encrypted with AES-256-GCM
        and stored on the server. Set the <code style={styles.code}>WOLKVORM_SECRET_KEY</code>{" "}
        environment variable for a custom encryption key.
      </div>
    </div>
  );
}

function getStyles(theme) {
  return {
    page: {
      maxWidth: 800,
      margin: "0 auto",
      padding: "40px 32px",
    },
    header: {
      marginBottom: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: 700,
      color: theme.colors.text,
      margin: 0,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textMuted,
      marginTop: 8,
    },
    section: {
      background: theme.colors.card,
      borderRadius: theme.radius.lg,
      border: `1px solid ${theme.colors.border}`,
      padding: 28,
      marginBottom: 24,
    },
    sectionHeader: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      marginBottom: 20,
    },
    sectionIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      background: "rgba(99,102,241,0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: theme.colors.text,
      margin: 0,
    },
    sectionDesc: {
      fontSize: 13,
      color: theme.colors.textMuted,
      margin: "4px 0 0",
    },
    badge: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "rgba(34,197,94,0.1)",
      color: theme.colors.success,
      padding: "6px 14px",
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 500,
      whiteSpace: "nowrap",
    },
    badgeDot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: theme.colors.success,
    },
    currentConfig: {
      display: "flex",
      gap: 24,
      padding: "12px 16px",
      background: "rgba(99,102,241,0.06)",
      borderRadius: theme.radius.sm,
      marginBottom: 20,
    },
    configItem: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    configLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    configValue: {
      fontSize: 14,
      color: theme.colors.text,
      fontFamily: theme.fonts.mono,
    },
    toggleRow: {
      display: "flex",
      gap: 0,
      marginBottom: 20,
      borderRadius: theme.radius.sm,
      overflow: "hidden",
      border: `1px solid ${theme.colors.border}`,
      width: "fit-content",
    },
    toggleBtn: {
      padding: "10px 20px",
      border: "none",
      background: theme.colors.bg,
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.2s",
    },
    toggleActive: {
      background: theme.colors.primary,
      color: "#fff",
    },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
    },
    fieldRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
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
    },
    hint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      opacity: 0.7,
    },
    input: {
      padding: "10px 14px",
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.inputBorder}`,
      background: theme.colors.input,
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: theme.fonts.body,
      outline: "none",
      transition: "border-color 0.2s",
    },
    textarea: {
      fontFamily: theme.fonts.mono,
      fontSize: 12,
      resize: "vertical",
      minHeight: 120,
    },
    pemRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    fileBtn: {
      padding: "8px 16px",
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.inputBorder}`,
      background: theme.colors.card,
      color: theme.colors.text,
      fontSize: 13,
      cursor: "pointer",
      transition: "background 0.2s",
    },
    pemHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    message: {
      padding: "10px 16px",
      borderRadius: theme.radius.sm,
      border: "1px solid",
      fontSize: 13,
      fontWeight: 500,
    },
    saveBtn: {
      padding: "12px 24px",
      borderRadius: theme.radius.sm,
      border: "none",
      background: theme.colors.primary,
      color: "#fff",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      transition: "opacity 0.2s, transform 0.1s",
      alignSelf: "flex-start",
    },
    infoBox: {
      padding: "16px 20px",
      borderRadius: theme.radius.md,
      background: "rgba(99,102,241,0.06)",
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 1.6,
    },
    infoBoxSmall: {
      padding: "10px 14px",
      borderRadius: theme.radius.sm,
      background: "rgba(99,102,241,0.06)",
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 1.5,
    },
    code: {
      background: "rgba(99,102,241,0.15)",
      padding: "2px 6px",
      borderRadius: 4,
      fontFamily: theme.fonts.mono,
      fontSize: 12,
      color: theme.colors.primaryHover,
    },
    testChannelBtn: {
      padding: "8px 16px",
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border}`,
      background: theme.colors.card,
      color: theme.colors.text,
      fontSize: 12,
      cursor: "pointer",
      alignSelf: "flex-end",
      marginBottom: 0,
      whiteSpace: "nowrap",
      height: 38,
    },
  };
}

export default SettingsPage;
