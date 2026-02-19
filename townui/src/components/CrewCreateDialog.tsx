import { useState, useEffect } from "react";
import { CrewPreset, getCrewPresets } from "../lib/tauri";

interface CrewCreateDialogProps {
  branches: string[];
  existingCrewNames: string[];
  onCreated: (name: string, baseBranch: string) => Promise<void>;
  onClose: () => void;
}

export default function CrewCreateDialog({
  branches,
  existingCrewNames,
  onCreated,
  onClose,
}: CrewCreateDialogProps) {
  const [mode, setMode] = useState<"presets" | "custom">("presets");
  const [presets, setPresets] = useState<CrewPreset[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(
    new Set(),
  );
  const [name, setName] = useState("");
  const [baseBranch, setBaseBranch] = useState(branches[0] || "main");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    getCrewPresets().then(setPresets).catch(console.error);
  }, []);

  const existingNamesLower = existingCrewNames.map((n) => n.toLowerCase());

  const togglePreset = (key: string) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreatePresets = async () => {
    if (selectedPresets.size === 0) return;
    setCreating(true);
    setError(null);
    const selected = presets.filter((p) => selectedPresets.has(p.key));
    let completed = 0;
    try {
      for (const preset of selected) {
        setProgress(
          `Creating ${preset.name}... (${completed + 1}/${selected.length})`,
        );
        await onCreated(preset.name, baseBranch);
        completed++;
      }
      onClose();
    } catch (e) {
      setError(String(e));
      if (completed > 0) {
        setProgress(`${completed}/${selected.length} created before error`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCustom = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await onCreated(name.trim(), baseBranch);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content w-[600px] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow-sm">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 01-9 9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">New Crew</h2>
              <p className="text-xs text-town-text-muted">
                Choose from presets or create a custom crew
              </p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-1 bg-town-bg/60 rounded-lg p-1 border border-town-border/30">
            <button
              onClick={() => setMode("presets")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                mode === "presets"
                  ? "bg-town-accent text-white shadow-sm"
                  : "text-town-text-muted hover:text-town-text"
              }`}
            >
              <span className="mr-1.5">🏢</span> Company Presets
            </button>
            <button
              onClick={() => setMode("custom")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                mode === "custom"
                  ? "bg-town-accent text-white shadow-sm"
                  : "text-town-text-muted hover:text-town-text"
              }`}
            >
              <span className="mr-1.5">✏️</span> Custom Crew
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2 overflow-y-auto flex-1 min-h-0">
          {mode === "presets" ? (
            <div className="space-y-4">
              {/* Base Branch */}
              <div>
                <label className="block text-sm font-medium text-town-text-muted mb-1.5">
                  Base Branch
                </label>
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="select-base"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preset Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-town-text-muted">
                    Select Crews to Create
                  </label>
                  {selectedPresets.size > 0 && (
                    <span className="text-xs bg-town-accent/20 text-town-accent px-2 py-0.5 rounded-full font-medium">
                      {selectedPresets.size} selected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => {
                    const alreadyExists = existingNamesLower.includes(
                      preset.name.toLowerCase(),
                    );
                    const isSelected = selectedPresets.has(preset.key);
                    return (
                      <button
                        key={preset.key}
                        disabled={alreadyExists || creating}
                        onClick={() => togglePreset(preset.key)}
                        className={`relative text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                          alreadyExists
                            ? "opacity-40 cursor-not-allowed border-town-border/20 bg-town-bg/30"
                            : isSelected
                              ? "border-town-accent bg-town-accent/10 shadow-glow-sm"
                              : "border-town-border/30 bg-town-bg/40 hover:border-town-border-light/50 hover:bg-town-bg/60"
                        }`}
                      >
                        {alreadyExists && (
                          <span className="absolute top-2 right-2 text-[10px] bg-town-text-faint/20 text-town-text-faint px-1.5 py-0.5 rounded-full">
                            exists
                          </span>
                        )}
                        {isSelected && !alreadyExists && (
                          <span className="absolute top-2 right-2">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              className="text-town-accent"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{preset.icon}</span>
                          <span className="font-semibold text-sm">
                            {preset.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-town-text-faint leading-snug line-clamp-2">
                          {preset.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span className="text-[10px] text-town-text-faint font-mono">
                            crew/{preset.key}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-town-text-muted mb-1.5">
                  Crew Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. feature-auth, mobile-app, data-pipeline"
                  className="input-base"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-town-text-muted mb-1.5">
                  Base Branch
                </label>
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="select-base"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3 mt-3 bg-town-danger-soft border border-town-danger/20 rounded-lg animate-slide-up">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-town-danger shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-sm text-town-danger">{error}</span>
            </div>
          )}

          {progress && creating && (
            <div className="flex items-center gap-2 p-3 mt-3 bg-town-accent/10 border border-town-accent/20 rounded-lg">
              <div className="w-3.5 h-3.5 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
              <span className="text-sm text-town-accent">{progress}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-4 mt-2 border-t border-town-border/30 bg-town-bg/30 shrink-0">
          <button onClick={onClose} className="btn-ghost" disabled={creating}>
            Cancel
          </button>
          {mode === "presets" ? (
            <button
              onClick={handleCreatePresets}
              disabled={selectedPresets.size === 0 || creating}
              className="btn-primary"
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                `Create ${selectedPresets.size || ""} Crew${selectedPresets.size !== 1 ? "s" : ""}`
              )}
            </button>
          ) : (
            <button
              onClick={handleCreateCustom}
              disabled={!name.trim() || creating}
              className="btn-primary"
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create Crew"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
