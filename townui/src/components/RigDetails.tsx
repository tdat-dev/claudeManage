import { RigInfo } from "../lib/tauri";
import { shortenPathForCli } from "../lib/path";

interface RigDetailsProps {
  rig: RigInfo;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export default function RigDetails({ rig, onDelete, onRefresh }: RigDetailsProps) {
  const handleDelete = () => {
    if (confirm(`Delete rig "${rig.name}"? This only removes it from TownUI — your files are not affected.`)) {
      onDelete(rig.id);
    }
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
            onClick={onRefresh}
            className="px-3 py-1.5 rounded text-sm bg-town-border hover:bg-town-text-muted/20 transition-colors"
            title="Refresh git status"
          >
            Refresh
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded text-sm bg-town-danger/10 text-town-danger hover:bg-town-danger/20 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-town-surface border border-town-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider mb-3">Git Status</h3>

          {rig.is_git_repo ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-town-text-muted w-20">Branch</span>
                <span className="text-sm font-mono bg-town-bg px-2 py-0.5 rounded">
                  {rig.git_branch || "unknown"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-town-text-muted w-20">Status</span>
                <span
                  className={`text-sm font-mono px-2 py-0.5 rounded ${
                    rig.git_status === "Clean"
                      ? "bg-town-success/10 text-town-success"
                      : "bg-yellow-500/10 text-yellow-400"
                  }`}
                >
                  {rig.git_status || "unknown"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-town-danger">Not a git repository</p>
          )}
        </div>

        <div className="bg-town-surface border border-town-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider mb-3">Info</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-town-text-muted w-20">Created</span>
              <span className="text-sm">{new Date(rig.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-town-text-muted w-20">Opened</span>
              <span className="text-sm">{new Date(rig.last_opened).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
