import { useState, useEffect, useMemo, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";
import AwsResourceSelect from "./AwsResourceSelect";
import SecurityGroupRules from "./SecurityGroupRules";
import NodeGroupEditor from "./NodeGroupEditor";

// Validation patterns
const PATTERNS = {
  cidr: /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
  subnet_id: /^subnet-[a-f0-9]+$/,
  sg_id: /^sg-[a-f0-9]+$/,
  vpc_id: /^vpc-[a-f0-9]+$/,
  ami_id: /^ami-[a-f0-9]+$/,
  arn: /^arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:\S+$/,
};

function getFieldValidation(field) {
  const name = field.name || "";
  if (name === "cidr" || name.includes("_cidr")) return { pattern: PATTERNS.cidr, hint: "e.g. 10.0.0.0/16" };
  if (name === "subnet_id") return { pattern: PATTERNS.subnet_id, hint: "e.g. subnet-abc123" };
  if (name === "vpc_id") return { pattern: PATTERNS.vpc_id, hint: "e.g. vpc-abc123" };
  if (name === "ami" && field.type === "string") return { pattern: PATTERNS.ami_id, hint: "e.g. ami-0c55b159" };
  if (name.includes("_arn") || name.includes("arn")) return { pattern: PATTERNS.arn, hint: "Must be a valid ARN" };
  return null;
}

function validateField(field, value) {
  if (field.required && (value === undefined || value === "" || value === null)) {
    return `${field.label} is required`;
  }
  if (!value || value === "") return null;

  // Check comma-separated lists for IDs
  const name = field.name || "";
  if (name === "vpc_security_group_ids" && typeof value === "string" && value.trim()) {
    const ids = value.split(",").map((s) => s.trim()).filter(Boolean);
    for (const id of ids) {
      if (!PATTERNS.sg_id.test(id)) return `Invalid security group ID: ${id}`;
    }
    return null;
  }
  if ((name === "public_subnets" || name === "private_subnets" || name === "database_subnets") && typeof value === "string" && value.trim()) {
    const cidrs = value.split(",").map((s) => s.trim()).filter(Boolean);
    for (const c of cidrs) {
      if (!PATTERNS.cidr.test(c)) return `Invalid CIDR: ${c}`;
    }
    return null;
  }

  const validation = getFieldValidation(field);
  if (validation && typeof value === "string" && value.trim() && !validation.pattern.test(value.trim())) {
    return validation.hint;
  }
  return null;
}

function DynamicForm({ schema, onSubmit, values, onChange, defaultRegion, onRegionChange, onEnvChange, canDeploy = true }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [region, setRegion] = useState(defaultRegion || "eu-central-1");
  const [env, setEnv] = useState("dev");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Update region when defaultRegion changes (loaded async from settings)
  useEffect(() => {
    if (defaultRegion) {
      setRegion(defaultRegion);
    }
  }, [defaultRegion]);

  // Initialize default values when schema loads
  useEffect(() => {
    if (!schema) return;
    const defaults = {};
    schema.inputs.forEach((input) => {
      if (input.default !== undefined && values[input.name] === undefined) {
        defaults[input.name] = input.default;
      }
    });
    if (Object.keys(defaults).length > 0) {
      onChange({ ...values, ...defaults });
    }
    setErrors({});
    setTouched({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  // Split inputs into basic and advanced
  const { basicInputs, advancedInputs } = useMemo(() => {
    if (!schema) return { basicInputs: [], advancedInputs: [] };
    const basic = [];
    const advanced = [];
    schema.inputs.forEach((input) => {
      if (input.advanced) {
        advanced.push(input);
      } else {
        basic.push(input);
      }
    });
    return { basicInputs: basic, advancedInputs: advanced };
  }, [schema]);

  const validateAll = useCallback(() => {
    if (!schema) return {};
    const newErrors = {};
    schema.inputs.forEach((field) => {
      const err = validateField(field, values[field.name]);
      if (err) newErrors[field.name] = err;
    });
    return newErrors;
  }, [schema, values]);

  if (!schema) return null;

  const handleChange = (name, value) => {
    onChange({ ...values, [name]: value });
    // Validate on change if already touched
    if (touched[name]) {
      const field = schema.inputs.find((f) => f.name === name);
      if (field) {
        const err = validateField(field, value);
        setErrors((prev) => {
          const next = { ...prev };
          if (err) next[name] = err;
          else delete next[name];
          return next;
        });
      }
    }
  };

  const handleBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const field = schema.inputs.find((f) => f.name === name);
    if (field) {
      const err = validateField(field, values[field.name]);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next[name] = err;
        else delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (action) => {
    // Mark all fields as touched
    const allTouched = {};
    schema.inputs.forEach((f) => (allTouched[f.name] = true));
    setTouched(allTouched);

    const validationErrors = validateAll();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // If errors are in advanced fields, expand them
      const hasAdvancedError = Object.keys(validationErrors).some((name) =>
        advancedInputs.some((f) => f.name === name)
      );
      if (hasAdvancedError) setShowAdvanced(true);
      return;
    }

    onSubmit({ inputs: values, region, env, action });
  };

  const renderInput = (field) => {
    const value = values[field.name] !== undefined ? values[field.name] : "";
    const hasError = touched[field.name] && errors[field.name];
    const inputStyle = hasError
      ? { ...styles.input, borderColor: theme.colors.danger }
      : styles.input;

    // AWS resource lookup dropdown
    if (field.aws_resource) {
      return (
        <AwsResourceSelect
          resourceType={field.aws_resource}
          region={region}
          multi={field.multi}
          value={value}
          onChange={(val) => handleChange(field.name, val)}
          placeholder={field.placeholder}
        />
      );
    }

    switch (field.type) {
      case "string":
        return (
          <input
            style={inputStyle}
            value={value}
            placeholder={field.placeholder || ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
          />
        );

      case "number":
        return (
          <input
            style={inputStyle}
            type="number"
            value={value}
            placeholder={field.placeholder || ""}
            onChange={(e) =>
              handleChange(field.name, parseFloat(e.target.value) || 0)
            }
            onBlur={() => handleBlur(field.name)}
          />
        );

      case "boolean":
        return (
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(field.name, e.target.checked)}
              style={styles.checkbox}
            />
            <span style={styles.toggleLabel}>
              {value ? "Enabled" : "Disabled"}
            </span>
          </label>
        );

      case "select":
        return (
          <select
            style={inputStyle}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
          >
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "multiline":
        return (
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: theme.fonts.mono, fontSize: 12 }}
            value={value}
            placeholder={field.placeholder || ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
          />
        );

      case "hcl":
        return (
          <div style={styles.hclContainer}>
            <textarea
              style={styles.hclInput}
              value={value}
              placeholder={field.placeholder || "# Enter HCL configuration..."}
              onChange={(e) => handleChange(field.name, e.target.value)}
              onBlur={() => handleBlur(field.name)}
              rows={field.rows || 10}
              spellCheck={false}
            />
            <span style={styles.hclHint}>Raw HCL — will be inserted directly into main.tf</span>
          </div>
        );

      case "list":
        return (
          <div style={styles.hclContainer}>
            <textarea
              style={{ ...styles.hclInput, minHeight: 60 }}
              value={value}
              placeholder={field.placeholder || "One item per line..."}
              onChange={(e) => handleChange(field.name, e.target.value)}
              onBlur={() => handleBlur(field.name)}
              rows={field.rows || 4}
              spellCheck={false}
            />
            <span style={styles.hclHint}>One item per line — will be formatted as a list</span>
          </div>
        );

      case "sg_rules":
        return (
          <SecurityGroupRules
            value={Array.isArray(value) ? value : []}
            onChange={(rules) => handleChange(field.name, rules)}
            label={field.label}
          />
        );

      case "nodegroups":
        return (
          <NodeGroupEditor
            value={Array.isArray(value) ? value : []}
            onChange={(groups) => handleChange(field.name, groups)}
          />
        );

      default:
        return (
          <input
            style={inputStyle}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
          />
        );
    }
  };

  const renderField = (field) => (
    <div key={field.name} style={styles.field}>
      <label style={styles.label}>
        {field.label}
        {field.required && <span style={styles.required}>*</span>}
      </label>
      {field.description && (
        <span style={styles.description}>{field.description}</span>
      )}
      {renderInput(field)}
      {touched[field.name] && errors[field.name] && (
        <span style={styles.errorText}>{errors[field.name]}</span>
      )}
    </div>
  );

  const errorCount = Object.keys(errors).length;

  return (
    <div style={styles.form}>
      {/* Basic inputs */}
      {basicInputs.map(renderField)}

      {/* Common inputs */}
      {schema.common_inputs?.region && (
        <div style={styles.field}>
          <label style={styles.label}>AWS Region</label>
          <select
            style={styles.input}
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              if (onRegionChange) onRegionChange(e.target.value);
            }}
          >
            <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
            <option value="us-east-1">us-east-1 (N. Virginia)</option>
            <option value="us-east-2">us-east-2 (Ohio)</option>
            <option value="us-west-1">us-west-1 (N. California)</option>
            <option value="us-west-2">us-west-2 (Oregon)</option>
            <option value="eu-west-1">eu-west-1 (Ireland)</option>
            <option value="eu-west-2">eu-west-2 (London)</option>
            <option value="eu-north-1">eu-north-1 (Stockholm)</option>
            <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
            <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
          </select>
        </div>
      )}

      {schema.common_inputs?.environment && (
        <div style={styles.field}>
          <label style={styles.label}>Environment</label>
          <select
            style={styles.input}
            value={env}
            onChange={(e) => {
              setEnv(e.target.value);
              if (onEnvChange) onEnvChange(e.target.value);
            }}
          >
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
          </select>
        </div>
      )}

      {/* Advanced toggle */}
      {advancedInputs.length > 0 && (
        <>
          <button
            style={styles.advancedToggle}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span style={styles.advancedIcon}>
              {showAdvanced ? "\u25B2" : "\u25BC"}
            </span>
            Advanced Settings
            <span style={styles.advancedCount}>
              {advancedInputs.length} more
            </span>
          </button>

          {showAdvanced && (
            <div style={styles.advancedSection}>
              {advancedInputs.map(renderField)}
            </div>
          )}
        </>
      )}

      {/* Validation summary */}
      {errorCount > 0 && Object.keys(touched).length > 0 && (
        <div style={styles.errorSummary}>
          {errorCount} validation {errorCount === 1 ? "error" : "errors"} - please fix before submitting
        </div>
      )}

      <div style={styles.actions}>
        {canDeploy ? (
          <>
            <button
              style={styles.planBtn}
              onClick={() => handleSubmit("plan")}
            >
              Run Plan
            </button>
            <button
              style={styles.applyBtn}
              onClick={() => handleSubmit("apply")}
            >
              Run Apply
            </button>
            <button
              style={styles.destroyBtn}
              onClick={() => handleSubmit("destroy")}
            >
              Destroy
            </button>
          </>
        ) : (
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            You do not have permission to execute infrastructure operations.
          </div>
        )}
      </div>
    </div>
  );
}

function getStyles(theme) {
  return {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.colors.text,
  },
  required: {
    color: theme.colors.danger,
    marginLeft: 4,
  },
  description: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  input: {
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: theme.colors.input,
    color: theme.colors.text,
    fontSize: 14,
    outline: "none",
    fontFamily: theme.fonts.body,
    transition: "border-color 0.2s",
  },
  errorText: {
    fontSize: 11,
    color: theme.colors.danger,
    fontWeight: 500,
  },
  errorSummary: {
    padding: "10px 14px",
    background: "rgba(239,68,68,0.1)",
    border: `1px solid rgba(239,68,68,0.3)`,
    borderRadius: theme.radius.sm,
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: 500,
  },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
  },
  checkbox: {
    width: 18,
    height: 18,
    accentColor: theme.colors.primary,
    cursor: "pointer",
  },
  toggleLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  advancedToggle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    background: "transparent",
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
    marginTop: 4,
  },
  advancedIcon: {
    fontSize: 10,
  },
  advancedCount: {
    marginLeft: "auto",
    fontSize: 11,
    padding: "2px 8px",
    background: "rgba(99,102,241,0.1)",
    color: theme.colors.primary,
    borderRadius: 10,
  },
  advancedSection: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 16,
    background: "rgba(99,102,241,0.03)",
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
  },
  actions: {
    display: "flex",
    gap: 12,
    marginTop: 12,
  },
  planBtn: {
    flex: 1,
    padding: "12px 20px",
    background: theme.colors.primary,
    color: "white",
    border: "none",
    borderRadius: theme.radius.sm,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  applyBtn: {
    flex: 1,
    padding: "12px 20px",
    background: "rgba(34,197,94,0.1)",
    color: "#22c55e",
    border: "1px solid #22c55e",
    borderRadius: theme.radius.sm,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  destroyBtn: {
    padding: "12px 16px",
    background: "rgba(239,68,68,0.1)",
    color: theme.colors.danger,
    border: `1px solid ${theme.colors.danger}`,
    borderRadius: theme.radius.sm,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  hclContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  hclInput: {
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.inputBorder}`,
    background: "#1a1a2e",
    color: "#e2e8f0",
    fontSize: 13,
    fontFamily: theme.fonts.mono,
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    minHeight: 120,
    tabSize: 2,
    whiteSpace: "pre",
    overflowWrap: "normal",
    overflowX: "auto",
  },
  hclHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
};
}

export default DynamicForm;
