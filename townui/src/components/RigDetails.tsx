import { useState } from "react";
import { RigInfo } from "../lib/tauri";
import { shortenPathForCli } from "../lib/path";

interface RigDetailsProps {
  rig: RigInfo;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export default function RigDetails({
  rig,
  onDelete,
  onRefresh,
}: RigDetailsProps) {
  const {
    crews,
    branches,
    loading: crewsLoading,
    addCrew,
    removeCrew,
    refresh: refreshCrews,
  } = useCrews(rig.id);
  const [showCrewCreate, setShowCrewCreate] = useState(false);

  const handleDelete = () => {
    if (
      confirm(
        `Delete rig "${rig.name}"? This only removes it from TownUI — your files are not affected.`,
      )
    ) {
      onDelete(rig.id);
    }
  };

  const handleOpenExplorer = async (path: string) => {
    try {
      await invoke("open_in_explorer", { path });
    } catch {
      // Fallback: just ignore if command not available
    }
  };

  const handleRefresh = () => {
    onRefresh();
    refreshCrews();
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{rig.name}</h1>
          <p className="text-town-text-muted text-sm mt-1 font-mono" title={rig.path}>
            {shortenPathForCli(rig.path, 72)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="btn-secondary !py-2 !px-3"
            title="Refresh git status"
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
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
          <button onClick={handleDelete} className="btn-danger !py-2 !px-3">
            <svg
              width="16"
              height="16"
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
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Git Status Card */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-town-accent"
            >
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 01-9 9" />
            </svg>
            <h3 className="section-title">Git Status</h3>
          </div>

          {rig.is_git_repo ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-town-bg/50 rounded-lg p-3.5">
                <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1.5">
                  Branch
                </div>
                <div className="text-sm font-mono font-semibold text-town-accent">
                  {rig.git_branch || "unknown"}
                </div>
              </div>
              <div className="bg-town-bg/50 rounded-lg p-3.5">
                <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1.5">
                  Status
                </div>
                <div
                  className={`text-sm font-semibold flex items-center gap-2 ${
                    rig.git_status === "Clean"
                      ? "text-town-success"
                      : "text-town-warning"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      rig.git_status === "Clean"
                        ? "bg-town-success"
                        : "bg-town-warning animate-pulse-slow"
                    }`}
                  />
                  {rig.git_status || "unknown"}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-town-danger-soft rounded-lg">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-town-danger shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="text-sm text-town-danger">
                Not a git repository
              </span>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-town-accent"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <h3 className="section-title">Info</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-town-bg/50 rounded-lg p-3.5">
              <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1.5">
                Created
              </div>
              <div className="text-sm font-medium">
                {new Date(rig.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="bg-town-bg/50 rounded-lg p-3.5">
              <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1.5">
                Last Opened
              </div>
              <div className="text-sm font-medium">
                {new Date(rig.last_opened).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Crews Section */}
        {rig.is_git_repo && (
          <div className="glass-card p-5">
            <CrewList
              crews={crews}
              loading={crewsLoading}
              onCreateClick={() => setShowCrewCreate(true)}
              onDelete={removeCrew}
              onOpenExplorer={handleOpenExplorer}
            />
          </div>
        )}
      </div>

      {showCrewCreate && (
        <CrewCreateDialog
          branches={branches}
          existingCrewNames={crews.map((c) => c.name)}
          onCreated={async (name, baseBranch) => {
            await addCrew(name, baseBranch);
          }}
          onClose={() => setShowCrewCreate(false)}
        />
      )}
    </div>
  );
}
