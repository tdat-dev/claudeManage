import { useState } from "react";
import { AppSettings } from "../lib/tauri";

interface SettingsPageProps {
  settings: AppSettings | null;
  loading: boolean;
  saving: boolean;
  onSave: (settings: AppSettings) => Promise<void>;
  onValidatePath: (path: string) => Promise<string>;
}

export default function SettingsPage({ settings, loading, saving, onSave, onValidatePath }: SettingsPageProps) {
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = draft || settings;

  if (loading || !current) {
    return <div className="p-6 text-town-text-muted">Loading settings...</div>;
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

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* CLI Paths */}
        <div className="bg-town-surface border border-town-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider mb-3">
            CLI Paths
          </h3>
          <div className="space-y-3">
            {Object.entries(current.cli_paths).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-sm w-24 shrink-0">{key}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateCliPath(key, e.target.value)}
                  className="flex-1 bg-town-bg border border-town-border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-town-accent"
                />
                <button
                  onClick={() => handleValidate(value)}
                  className="text-xs px-2 py-1.5 rounded bg-town-border hover:bg-town-text-muted/20 transition-colors shrink-0"
                >
                  Validate
                </button>
              </div>
            ))}
          </div>
          {validationResult && (
            <div className="mt-2 text-xs font-mono bg-town-bg border border-town-border rounded px-3 py-2">
              {validationResult}
            </div>
          )}
        </div>

        {/* Environment Variables */}
        <div className="bg-town-surface border border-town-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider">
              Environment Variables
            </h3>
            <button
              onClick={addEnvVar}
              className="text-xs px-2 py-1 rounded bg-town-accent/10 text-town-accent hover:bg-town-accent/20 transition-colors"
            >
              + Add
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(current.env_vars).length === 0 ? (
              <p className="text-sm text-town-text-muted/70">No environment variables configured.</p>
            ) : (
              Object.entries(current.env_vars).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const newVars = { ...current.env_vars };
                      delete newVars[key];
                      newVars[e.target.value] = value;
                      setDraft({ ...current, env_vars: newVars });
                    }}
                    className="w-36 bg-town-bg border border-town-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-town-accent"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateEnvVar(key, e.target.value)}
                    className="flex-1 bg-town-bg border border-town-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-town-accent"
                    placeholder="value"
                  />
                  <button
                    onClick={() => removeEnvVar(key)}
                    className="text-xs px-2 py-1.5 rounded bg-town-danger/10 text-town-danger hover:bg-town-danger/20 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Default Template */}
        <div className="bg-town-surface border border-town-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider mb-3">
            Default Template
          </h3>
          <select
            value={current.default_template}
            onChange={(e) => setDraft({ ...current, default_template: e.target.value })}
            className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
          >
            <option value="implement_feature">Implement Feature</option>
            <option value="fix_bug">Fix Bug</option>
            <option value="write_tests">Write Tests</option>
            <option value="refactor">Refactor</option>
          </select>
        </div>

        {error && (
          <div className="bg-town-danger/10 border border-town-danger/30 rounded px-3 py-2 text-sm text-town-danger">
            {error}
          </div>
        )}

        {/* Save button */}
        {draft && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-town-accent hover:bg-town-accent-hover disabled:opacity-50 rounded text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
