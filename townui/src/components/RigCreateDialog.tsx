import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { shortenPathForCli } from "../lib/path";
import { t } from "../lib/i18n";

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-town-surface border border-town-border rounded-lg p-6 w-[480px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t("vi", "add_rig")}</h2>
        <p className="text-town-text-muted text-sm mb-4">{t("vi", "select_git_folder")}</p>

        <div className="flex gap-2 mb-4">
          <div
            className="flex-1 bg-town-bg border border-town-border rounded px-3 py-2 text-sm truncate"
            title={selectedPath || undefined}
          >
            {selectedPath ? shortenPathForCli(selectedPath, 56) : t("vi", "no_folder_selected")}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2">
          <div className="flex gap-2.5 mb-4">
            <div className="flex-1 bg-town-bg/80 border border-town-border rounded-lg px-3.5 py-2.5 text-sm truncate font-mono text-town-text-muted">
              {selectedPath || t("vi", "no_folder_selected")}
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
              {t("vi", "browse")}
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
            {t("vi", "cancel")}
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedPath || creating}
            className="btn-primary"
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("vi", "adding")}
              </span>
            ) : (
              t("vi", "add_rig")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
