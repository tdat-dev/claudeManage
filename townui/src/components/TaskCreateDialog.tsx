import { useState } from "react";
import { TaskPriority } from "../lib/tauri";

interface TaskCreateDialogProps {
  onCreated: (
    title: string,
    description: string,
    tags: string[],
    priority: TaskPriority,
    acceptanceCriteria?: string,
  ) => Promise<void>;
  onClose: () => void;
}

export default function TaskCreateDialog({
  onCreated,
  onClose,
}: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
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
      await onCreated(
        title.trim(),
        description.trim(),
        tags,
        priority,
        acceptanceCriteria.trim() || undefined,
      );
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
        className="dialog-content w-[520px]"
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
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">New Task</h2>
              <p className="text-xs text-town-text-muted">
                Define work for your AI agents
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-town-text-muted mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add user authentication"
              className="input-base"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-town-text-muted mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task in detail..."
              rows={4}
              className="input-base resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-town-text-muted mb-1.5">
              Acceptance Criteria
              <span className="text-town-text-faint ml-1">(optional)</span>
            </label>
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder="What defines this task as done?"
              rows={2}
              className="input-base resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-town-text-muted mb-1.5">
                Tags
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="backend, auth, urgent"
                className="input-base"
              />
              <p className="text-[11px] text-town-text-faint mt-1">
                Comma separated
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-town-text-muted mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="select-base"
              >
                <option value="low">↓ Low</option>
                <option value="medium">→ Medium</option>
                <option value="high">↑ High</option>
                <option value="critical">‼ Critical</option>
              </select>
            </div>
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
            disabled={!title.trim() || creating}
            className="btn-primary"
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Task"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
