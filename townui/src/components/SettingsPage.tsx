import { useState, useEffect } from "react";
import {
  AppSettings,
  getSeedInfo,
  seedWorkflowTemplates,
  SeedInfo,
  listTemplates,
  TemplateInfo,
} from "../lib/tauri";
import { t } from "../lib/i18n";
import { shortenPathForCli } from "../lib/path";

interface SettingsPageProps {
  settings: AppSettings | null;
  loading: boolean;
  saving: boolean;
  onSave: (settings: AppSettings) => Promise<void>;
  onValidatePath: (path: string) => Promise<string>;
}

export default function SettingsPage({
  settings,
  loading,
  saving,
  onSave,
  onValidatePath,
}: SettingsPageProps) {
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seedInfo, setSeedInfo] = useState<SeedInfo | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string[] | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [editingCliKey, setEditingCliKey] = useState<string | null>(null);

  useEffect(() => {
    getSeedInfo()
      .then(setSeedInfo)
      .catch(() => {});
    listTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  const current = draft || settings;
  const language = (current?.language ?? "en") as "en" | "vi";

  if (loading || !current) {
    return (
      <div className="flex items-center justify-center h-full gap-3 animate-fade-in">
        <div className="w-5 h-5 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
        <span className="text-sm text-town-text-muted">
          Loading settings...
        </span>
      </div>
    );
  }

  const updateCliPath = (key: string, value: string) => {
    setDraft({
      ...current,
      cli_paths: { ...current.cli_paths, [key]: value },
    });
  };

  const updateEnvVar = (key: string, value: string) => {
    setDraft({
      ...current,
      env_vars: { ...current.env_vars, [key]: value },
    });
  };

  const removeEnvVar = (key: string) => {
    const newVars = { ...current.env_vars };
    delete newVars[key];
    setDraft({ ...current, env_vars: newVars });
  };

  const addEnvVar = () => {
    setDraft({
      ...current,
      env_vars: { ...current.env_vars, NEW_VAR: "" },
    });
  };

  const handleSave = async () => {
    if (!current) return;
    setError(null);
    try {
      await onSave(current);
      setDraft(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleValidate = async (path: string) => {
    try {
      const result = await onValidatePath(path);
      setValidationResult(result);
    } catch (e) {
      setValidationResult(`Error: ${e}`);
    }
  };

  const isDirty = draft !== null;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-town-border/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-town-accent/20 to-town-secondary/20 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-town-accent"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Settings</h1>
            <p className="text-xs text-town-text-faint">
              Configure CLI paths, environment, and defaults
            </p>
          </div>
        </div>

        {/* Save indicator / button */}
        {isDirty && (
          <div className="flex items-center gap-3 animate-fade-in">
            <span className="flex items-center gap-1.5 text-xs text-town-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-town-warning animate-pulse" />
              Unsaved changes
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl space-y-6">
          {/* CLI Paths */}
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-town-accent/10 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-town-accent"
                >
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </div>
              <h3 className="section-title !mb-0">CLI Paths</h3>
            </div>

            <div className="space-y-3">
              {Object.entries(current.cli_paths).map(([key, value]) => (
                <div key={key} className="group flex items-center gap-3">
                  <label className="text-sm font-medium text-town-text-muted w-28 shrink-0 capitalize">
                    {key}
                  </label>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={
                        editingCliKey === key
                          ? value
                          : shortenPathForCli(value, 56)
                      }
                      onChange={(e) => updateCliPath(key, e.target.value)}
                      onFocus={() => setEditingCliKey(key)}
                      onBlur={() =>
                        setEditingCliKey((prev) => (prev === key ? null : prev))
                      }
                      title={value}
                      className="input-base font-mono text-xs pr-20"
                    />
                    <button
                      onClick={() => handleValidate(value)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] font-medium bg-town-surface-hover text-town-text-muted hover:text-town-accent hover:bg-town-accent/10 transition-all duration-200"
                    >
                      Validate
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {validationResult && (
              <div
                className={`mt-3 text-xs font-mono rounded-lg px-3 py-2.5 border animate-fade-in ${
                  validationResult.startsWith("Error")
                    ? "bg-town-danger/5 border-town-danger/20 text-town-danger"
                    : "bg-town-success/5 border-town-success/20 text-town-success"
                }`}
              >
                <div className="flex items-start gap-2">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mt-0.5 shrink-0"
                  >
                    {validationResult.startsWith("Error") ? (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </>
                    ) : (
                      <>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </>
                    )}
                  </svg>
                  {validationResult}
                </div>
              </div>
            )}
          </section>

          {/* Environment Variables */}
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-town-success/10 flex items-center justify-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-town-success"
                  >
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <h3 className="section-title !mb-0">Environment Variables</h3>
              </div>
              <button
                onClick={addEnvVar}
                className="btn-ghost text-xs flex items-center gap-1.5"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Variable
              </button>
            </div>

            <div className="space-y-2">
              {Object.entries(current.env_vars).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-town-text-faint gap-2">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  <p className="text-xs">No environment variables configured</p>
                </div>
              ) : (
                <>
                  {/* Header row */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-town-text-faint w-36">
                      Key
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-town-text-faint flex-1">
                      Value
                    </span>
                    <span className="w-8" />
                  </div>
                  {Object.entries(current.env_vars).map(([key, value]) => (
                    <div key={key} className="group flex items-center gap-2">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          const newVars = { ...current.env_vars };
                          delete newVars[key];
                          newVars[e.target.value] = value;
                          setDraft({ ...current, env_vars: newVars });
                        }}
                        className="w-36 input-base font-mono text-xs"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateEnvVar(key, e.target.value)}
                        className="flex-1 input-base font-mono text-xs"
                        placeholder="value"
                      />
                      <button
                        onClick={() => removeEnvVar(key)}
                        className="p-1.5 rounded-md text-town-text-faint hover:text-town-danger hover:bg-town-danger/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                        title="Remove variable"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* Default CLI */}
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-town-warning/10 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-town-warning"
                >
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </div>
              <h3 className="section-title !mb-0">Default CLI</h3>
            </div>

            <select
              value={current.default_cli || "claude"}
              onChange={(e) =>
                setDraft({ ...current, default_cli: e.target.value })
              }
              className="select-base"
            >
              {Object.keys(current.cli_paths).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <p className="text-xs text-town-text-faint">
              CLI mặc định cho Execute Task, Spawn Worker và fallback khi hệ
              thống không có agent cụ thể.
            </p>
          </section>

          {/* Default Template */}
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-town-secondary/10 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-town-secondary"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="section-title !mb-0">Default Template</h3>
            </div>

            <select
              value={current.default_template}
              onChange={(e) =>
                setDraft({ ...current, default_template: e.target.value })
              }
              className="select-base"
            >
              {templates.length > 0 ? (
                templates.map((tpl) => (
                  <option key={tpl.name} value={tpl.name}>
                    {tpl.name
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                    {tpl.is_builtin ? "" : " (custom)"}
                  </option>
                ))
              ) : (
                <>
                  <option value="implement_feature">Implement Feature</option>
                  <option value="fix_bug">Fix Bug</option>
                  <option value="write_tests">Write Tests</option>
                  <option value="refactor">Refactor</option>
                </>
              )}
            </select>
            <p className="text-xs text-town-text-faint">
              Template used when creating new tasks without specifying one
            </p>
          </section>

          {/* Prompt Template Catalog */}
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-town-accent/10 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-town-accent"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <div>
                <h3 className="section-title !mb-0">Prompt Template Catalog</h3>
                <p className="text-[10px] text-town-text-faint mt-0.5">
                  {templates.length} templates available — bigtech-grade prompts
                  for AI agents
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
              {templates.map((tpl) => (
                <div
                  key={tpl.name}
                  className="group flex items-start gap-3 p-3 rounded-lg bg-town-surface-hover/40 hover:bg-town-surface-hover/80 transition-all duration-200"
                >
                  <div className="shrink-0 mt-0.5">
                    {tpl.is_builtin ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-town-accent/10 text-town-accent">
                        Built-in
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-town-warning/10 text-town-warning">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-town-text">
                      {tpl.name
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </div>
                    <div className="text-xs text-town-text-muted mt-0.5 line-clamp-1">
                      {tpl.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Seed Data — Bigtech Presets */}
          <section className="glass-card p-5 space-y-4 border border-town-accent/20">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-town-accent/20 to-town-success/20 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-town-accent"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h3 className="section-title !mb-0">Bigtech Preset Data</h3>
                <p className="text-[10px] text-town-text-faint mt-0.5">
                  Load production-ready workflow templates used at FAANG
                  companies
                </p>
              </div>
            </div>

            {seedInfo && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-md bg-town-accent/10 flex items-center justify-center text-town-accent font-bold text-xs">
                      {seedInfo.workflow_template_count}
                    </span>
                    <span className="text-town-text-muted">
                      Workflow Templates
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-md bg-town-secondary/10 flex items-center justify-center text-town-secondary font-bold text-xs">
                      {seedInfo.prompt_template_count}
                    </span>
                    <span className="text-town-text-muted">
                      Prompt Templates
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {seedInfo.workflow_template_names.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-1.5 text-xs text-town-text-muted"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="text-town-success shrink-0"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {name}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={async () => {
                      setSeeding(true);
                      setSeedResult(null);
                      try {
                        const added = await seedWorkflowTemplates();
                        setSeedResult(added);
                        // Refresh seed info
                        getSeedInfo()
                          .then(setSeedInfo)
                          .catch(() => {});
                      } catch (e) {
                        setError(String(e));
                      } finally {
                        setSeeding(false);
                      }
                    }}
                    disabled={seeding}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    {seeding ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                    )}
                    {seeding ? "Loading..." : "Load Bigtech Presets"}
                  </button>
                  <p className="text-[10px] text-town-text-faint">
                    Idempotent — won't duplicate existing templates
                  </p>
                </div>

                {seedResult && (
                  <div className="animate-fade-in rounded-lg px-3 py-2.5 border text-xs bg-town-success/5 border-town-success/20 text-town-success">
                    {seedResult.length === 0 ? (
                      <span>All bigtech templates already loaded ✓</span>
                    ) : (
                      <span>
                        Added {seedResult.length} workflow templates:{" "}
                        {seedResult.join(", ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Language */}
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-town-accent/10 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-town-accent"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3 className="section-title !mb-0">{t(language, "language")}</h3>
            </div>

            <select
              value={current.language || "en"}
              onChange={(e) =>
                setDraft({
                  ...current,
                  language: e.target.value as AppSettings["language"],
                })
              }
              className="select-base"
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
            <p className="text-xs text-town-text-faint">
              {t(language, "language_help")}
            </p>
          </section>

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 bg-town-danger/5 border border-town-danger/20 text-sm text-town-danger animate-fade-in">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mt-0.5 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Bottom save bar (for scrolled-down state) */}
          {isDirty && (
            <div className="flex justify-end pt-2 pb-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
