import { RigInfo } from "../lib/tauri";
import { shortenPathForCli } from "../lib/path";

interface RigListProps {
  rigs: RigInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
}

export default function RigList({
  rigs,
  selectedId,
  onSelect,
  onAddClick,
}: RigListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-town-border/30">
        <div>
          <h2 className="text-sm font-bold text-town-text">Repositories</h2>
          <p className="text-[11px] text-town-text-faint mt-0.5">
            {rigs.length} rig{rigs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onAddClick}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-accent text-white shadow-glow-sm hover:shadow-glow-md active:scale-95 transition-all duration-200"
          title="Add Rig"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {rigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-town-surface flex items-center justify-center mb-3">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-town-text-faint"
              >
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm text-town-text-muted mb-1">No rigs yet</p>
            <p className="text-xs text-town-text-faint">
              Add a git repository to get started
            </p>
          </div>
        ) : (
          rigs.map((rig) => (
            <button
              key={rig.id}
              onClick={() => onSelect(rig.id)}
              className={`w-full text-left px-4 py-3 border-b border-town-border/50 transition-colors ${
                selectedId === rig.id
                  ? "bg-town-accent/10 border-l-2 border-l-town-accent"
                  : "hover:bg-town-surface/80 border-l-2 border-l-transparent"
              }`}
            >
              <div className="font-medium text-sm truncate">{rig.name}</div>
              <div className="text-xs text-town-text-muted truncate mt-0.5" title={rig.path}>
                {shortenPathForCli(rig.path)}
              </div>
              {rig.git_branch && (
                <div className="text-xs text-town-accent mt-1">{rig.git_branch}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
