import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { shortenPathForCli } from "../lib/path";

interface RigCreateDialogProps {
  onCreated: (path: string) => Promise<void>;
  onClose: () => void;
}

export default function RigCreateDialog({ onCreated, onClose }: RigCreateDialogProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = async () => {
    const path = await open({ directory: true, multiple: false, title: "Select a git repository folder" });
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-town-surface border border-town-border rounded-lg p-6 w-[480px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Add Rig</h2>
        <p className="text-town-text-muted text-sm mb-4">Select a folder containing a git repository to add as a rig.</p>

        <div className="flex gap-2 mb-4">
          <div
            className="flex-1 bg-town-bg border border-town-border rounded px-3 py-2 text-sm truncate"
            title={selectedPath || undefined}
          >
            {selectedPath ? shortenPathForCli(selectedPath, 56) : "No folder selected"}
          </div>
          <button
            onClick={handleBrowse}
            className="px-4 py-2 bg-town-border hover:bg-town-text-muted/20 rounded text-sm transition-colors"
          >
            Browse
          </button>
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
            disabled={!selectedPath || creating}
            className="px-4 py-2 bg-town-accent hover:bg-town-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            {creating ? "Adding..." : "Add Rig"}
          </button>
        </div>
      </div>
    </div>
  );
}
