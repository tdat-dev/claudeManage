import { useState } from "react";
import { TaskPriority } from "../lib/tauri";

interface TaskCreateDialogProps {
  onCreated: (title: string, description: string, tags: string[], priority: TaskPriority) => Promise<void>;
  onClose: () => void;
}

export default function TaskCreateDialog({ onCreated, onClose }: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await onCreated(title.trim(), description.trim(), tags, priority);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-town-surface border border-town-border rounded-lg p-6 w-[500px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">New Task</h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-town-text-muted mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add user authentication"
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-town-text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task in detail..."
              rows={4}
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-town-text-muted mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. backend, auth, urgent"
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-town-text-muted mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-town-danger/10 border border-town-danger/30 rounded px-3 py-2 mb-4 text-sm text-town-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-town-text-muted hover:text-town-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || creating}
            className="px-4 py-2 bg-town-accent hover:bg-town-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            {creating ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
