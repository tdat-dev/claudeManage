import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface RigCreateDialogProps {
  onCreated: (path: string) => Promise<void>;
  onClose: () => void;
}

export default function RigCreateDialog({
  onCreated,
  onClose,
}: RigCreateDialogProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = async () => {
    const path = await open({
      directory: true,
      multiple: false,
      title: "Select a git repository folder",
    });
    if (path) {
      setSelectedPath(path as string);
      setError(null);
    }
  };

  const handleCreate = async () => {
    if (!selectedPath) return;
    setCreating(true);
    setError(null);
    try {
      await onCreated(selectedPath);
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
        className="dialog-content w-[500px]"
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
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">Add Rig</h2>
              <p className="text-xs text-town-text-muted">
                Select a git repository folder
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2">
          <div className="flex gap-2.5 mb-4">
            <div className="flex-1 bg-town-bg/80 border border-town-border rounded-lg px-3.5 py-2.5 text-sm truncate font-mono text-town-text-muted">
              {selectedPath || "No folder selected"}
            </div>
            <button
              onClick={handleBrowse}
              className="btn-secondary !py-2.5 shrink-0"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="inline mr-1.5"
              >
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              Browse
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-town-danger-soft border border-town-danger/20 rounded-lg mb-4 animate-slide-up">
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
        <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-town-border/30 bg-town-bg/30">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedPath || creating}
            className="btn-primary"
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Adding...
              </span>
            ) : (
              "Add Rig"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
