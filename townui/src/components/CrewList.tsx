import { CrewInfo } from "../lib/tauri";

interface CrewListProps {
  crews: CrewInfo[];
  loading: boolean;
  onCreateClick: () => void;
  onDelete: (id: string) => void;
  onOpenExplorer: (path: string) => void;
}

export default function CrewList({ crews, loading, onCreateClick, onDelete, onOpenExplorer }: CrewListProps) {
  if (loading) {
    return <div className="text-town-text-muted text-sm py-4 text-center">Loading crews...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider">Crews</h3>
        <button
          onClick={onCreateClick}
          className="px-3 py-1 rounded text-xs bg-town-accent hover:bg-town-accent-hover text-white transition-colors"
        >
          + New Crew
        </button>
      </div>

      {crews.length === 0 ? (
        <p className="text-sm text-town-text-muted/70">No crews yet. Create one to start a worktree workspace.</p>
      ) : (
        <div className="space-y-2">
          {crews.map((crew) => (
            <div
              key={crew.id}
              className="bg-town-bg border border-town-border rounded-lg p-3"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{crew.name}</div>
                  <div className="text-xs text-town-accent font-mono mt-0.5">{crew.git_branch || crew.branch}</div>
                  <div className="text-xs text-town-text-muted mt-1 truncate font-mono">{crew.path}</div>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  {crew.changed_files > 0 && (
                    <span className="text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">
                      {crew.changed_files} changed
                    </span>
                  )}
                  {crew.changed_files === 0 && crew.git_status && (
                    <span className="text-xs bg-town-success/10 text-town-success px-1.5 py-0.5 rounded">
                      Clean
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onOpenExplorer(crew.path)}
                  className="text-xs px-2 py-1 rounded bg-town-border hover:bg-town-text-muted/20 transition-colors"
                  title="Open in Explorer"
                >
                  Open Folder
                </button>
                <button
                  onClick={() => {
                    const hasChanges = crew.changed_files > 0;
                    const msg = hasChanges
                      ? `Delete crew "${crew.name}"? WARNING: This crew has ${crew.changed_files} uncommitted change(s) that will be lost!`
                      : `Delete crew "${crew.name}"? This will remove the worktree.`;
                    if (confirm(msg)) {
                      onDelete(crew.id);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded bg-town-danger/10 text-town-danger hover:bg-town-danger/20 transition-colors"
                >
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
