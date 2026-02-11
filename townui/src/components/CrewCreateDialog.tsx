import { useState } from "react";

interface CrewCreateDialogProps {
  branches: string[];
  onCreated: (name: string, baseBranch: string) => Promise<void>;
  onClose: () => void;
}

export default function CrewCreateDialog({ branches, onCreated, onClose }: CrewCreateDialogProps) {
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-town-surface border border-town-border rounded-lg p-6 w-[420px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Crew</h2>
        <p className="text-town-text-muted text-sm mb-4">
          Create a new git worktree workspace for this rig.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-town-text-muted mb-1">Crew Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. feature-auth"
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-town-text-muted mb-1">Base Branch</label>
            <select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
            >
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-town-danger/10 border border-town-danger/30 rounded px-3 py-2 mb-4 text-sm text-town-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-town-text-muted hover:text-town-text transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-4 py-2 bg-town-accent hover:bg-town-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            {creating ? "Creating..." : "Create Crew"}
          </button>
        </div>
      </div>
    </div>
  );
}
