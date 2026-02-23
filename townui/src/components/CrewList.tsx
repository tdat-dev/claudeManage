import { CrewInfo } from "../lib/tauri";
import { t } from "../lib/i18n";

interface CrewListProps {
  crews: CrewInfo[];
  loading: boolean;
  onCreateClick: () => void;
  onDelete: (id: string) => void;
  onOpenExplorer: (path: string) => void;
}

export default function CrewList({
  crews,
  loading,
  onCreateClick,
  onDelete,
  onOpenExplorer,
}: CrewListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-town-accent"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v-2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <h3 className="section-title">{t("vi", "crews_title")}</h3>
          <span className="text-[10px] text-town-text-faint bg-town-bg/50 px-1.5 py-0.5 rounded-full">
            {crews.length}
          </span>
        </div>
        <button
          onClick={onCreateClick}
          className="btn-primary !py-1.5 !px-3 !text-xs"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="inline mr-1"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("vi", "new_crew")}
        </button>
      </div>

      {crews.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-town-text-muted mb-1">{t("vi", "no_crews_yet")}</p>
          <p className="text-xs text-town-text-faint">
            {t("vi", "create_worktree")}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {crews.map((crew) => (
            <div
              key={crew.id}
              className="bg-town-bg/60 border border-town-border/40 rounded-xl p-4 hover:border-town-border-light/50 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">
                      {crew.name}
                    </span>
                    {crew.changed_files > 0 ? (
                      <span className="badge bg-town-warning-soft text-town-warning">
                        <span className="w-1.5 h-1.5 rounded-full bg-town-warning" />
                        {crew.changed_files} {t("vi", "changed")}
                      </span>
                    ) : crew.git_status ? (
                      <span className="badge bg-town-success-soft text-town-success">
                        <span className="w-1.5 h-1.5 rounded-full bg-town-success" />
                        {t("vi", "clean")}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-town-accent shrink-0"
                    >
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 01-9 9" />
                    </svg>
                    <span className="text-xs text-town-accent font-mono font-medium">
                      {crew.git_branch || crew.branch}
                    </span>
                  </div>
                  <div className="text-[11px] text-town-text-faint mt-1.5 truncate font-mono">
                    {crew.path}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-town-border/20">
                <button
                  onClick={() => onOpenExplorer(crew.path)}
                  className="btn-secondary !py-1.5 !px-2.5 !text-xs flex items-center gap-1.5"
                  title="Open in Explorer"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                  Open
                </button>
                <button
                  onClick={() => {
                    const hasChanges = crew.changed_files > 0;
                    const msg = hasChanges
                      ? `${t("vi", "delete_crew_confirm")} "${crew.name}"? ${t("vi", "delete_crew_warn")}`
                      : `${t("vi", "delete_crew_confirm")} "${crew.name}"? ${t("vi", "delete_crew_simple")}`;
                    if (confirm(msg)) {
                      onDelete(crew.id);
                    }
                  }}
                  className="btn-danger !py-1.5 !px-2.5 !text-xs flex items-center gap-1.5"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
