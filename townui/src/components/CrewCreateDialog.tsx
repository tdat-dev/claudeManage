import { useState } from "react";

interface CrewCreateDialogProps {
  branches: string[];
  onCreated: (name: string, baseBranch: string) => Promise<void>;
  onClose: () => void;
}

export default function CrewCreateDialog({
  branches,
  onCreated,
  onClose,
}: CrewCreateDialogProps) {
  const [name, setName] = useState("");
  const [baseBranch, setBaseBranch] = useState(branches[0] || "main");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
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
        className="dialog-content w-[460px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
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
                Create a git worktree workspace
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-town-text-muted mb-1.5">
              Crew Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. feature-auth"
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

          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-town-danger-soft border border-town-danger/20 rounded-lg animate-slide-up">
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-4 mt-2 border-t border-town-border/30 bg-town-bg/30">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleCreate}
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
        </div>
      </div>
    </div>
  );
}
