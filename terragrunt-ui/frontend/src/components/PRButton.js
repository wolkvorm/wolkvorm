import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

import { API, authFetch } from "../config";

function PRButton({ schemaId, inputs, env, repos, selectedRepo, onRepoChange }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  const generatePR = async () => {
    if (!selectedRepo) {
      alert("Please select a repository first");
      return;
    }

    setCreating(true);
    setResult(null);

    const branchName = `grandform-${schemaId}-${env}-${Date.now()}`;

    try {
      // 1. Get main branch SHA
      const shaRes = await authFetch(
        `${API}/api/github/branch-sha?repo=${selectedRepo}`
      );
      if (!shaRes.ok) {
        const errText = await shaRes.text();
        throw new Error(`Branch SHA failed: ${errText}`);
      }
      const shaData = await shaRes.json();
      const mainSHA = shaData.commit?.sha;
      if (!mainSHA) {
        throw new Error("Could not get main branch SHA. Does the repo have a 'main' branch?");
      }

      // 2. Create branch
      const branchRes = await authFetch(`${API}/api/github/create-branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: selectedRepo,
          branch: branchName,
          sha: mainSHA,
        }),
      });
      if (!branchRes.ok) {
        const errText = await branchRes.text();
        throw new Error(`Branch creation failed: ${errText}`);
      }

      // 3. Commit file
      const commitRes = await authFetch(`${API}/api/github/commit-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaId,
          repo: selectedRepo,
          branch: branchName,
          inputs,
          env,
        }),
      });
      if (!commitRes.ok) {
        const errText = await commitRes.text();
        throw new Error(`File commit failed: ${errText}`);
      }

      // 4. Create PR
      const prRes = await authFetch(`${API}/api/github/create-pr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaId,
          repo: selectedRepo,
          branch: branchName,
          env,
        }),
      });
      if (!prRes.ok) {
        const errText = await prRes.text();
        throw new Error(`PR creation failed: ${errText}`);
      }

      const prData = await prRes.json();
      setResult({ success: true, url: prData.html_url || null });
    } catch (err) {
      console.error(err);
      setResult({ success: false, error: err.message });
    }

    setCreating(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.repoSelect}>
        <label style={styles.label}>Target Repository</label>
        <select
          style={styles.input}
          value={selectedRepo}
          onChange={(e) => onRepoChange(e.target.value)}
        >
          <option value="">Select a repository</option>
          {repos.map((repo) => (
            <option key={repo.full_name} value={repo.full_name}>
              {repo.full_name}
            </option>
          ))}
        </select>
      </div>

      <button
        style={{
          ...styles.button,
          ...(creating ? styles.buttonDisabled : {}),
        }}
        onClick={generatePR}
        disabled={creating}
      >
        {creating ? "Creating PR..." : "Generate Pull Request"}
      </button>

      {result && (
        <div
          style={{
            ...styles.result,
            background: result.success ? "#052e16" : "#450a0a",
            borderColor: result.success
              ? theme.colors.success
              : theme.colors.danger,
          }}
        >
          {result.success ? (
            <>
              PR created successfully!
              {result.url && (
                <>
                  {" "}
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.prLink}
                  >
                    View PR
                  </a>
                </>
              )}
            </>
          ) : (
            <>PR creation failed: {result.error}</>
          )}
        </div>
      )}
    </div>
  );
}

function getStyles(theme) {
  return {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  repoSelect: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.colors.text,
  },
  input: {
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 14,
    outline: "none",
  },
  button: {
    padding: "12px 20px",
    background: "transparent",
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}`,
    borderRadius: theme.radius.sm,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  result: {
    padding: "10px 14px",
    borderRadius: theme.radius.sm,
    border: "1px solid",
    fontSize: 13,
    color: theme.colors.text,
  },
  prLink: {
    color: theme.colors.primary,
    textDecoration: "underline",
  },
};
}

export default PRButton;
