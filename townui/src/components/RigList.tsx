import { RigInfo } from "../lib/tauri";

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
          rigs.map((rig) => {
            const isSelected = selectedId === rig.id;
            return (
              <button
                key={rig.id}
                onClick={() => onSelect(rig.id)}
                className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-200 group ${
                  isSelected
                    ? "bg-town-accent/10 border border-town-accent/20 shadow-glow-sm"
                    : "hover:bg-town-surface-hover border border-transparent"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? "bg-town-accent/15 text-town-accent"
                        : "bg-town-surface text-town-text-muted group-hover:text-town-text"
                    }`}
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
                      <circle cx="12" cy="12" r="4" />
                      <line x1="1.05" y1="12" x2="7" y2="12" />
                      <line x1="17.01" y1="12" x2="22.96" y2="12" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-semibold text-[13px] truncate transition-colors ${
                        isSelected
                          ? "text-town-text"
                          : "text-town-text/90 group-hover:text-town-text"
                      }`}
                    >
                      {rig.name}
                    </div>
                    <div className="text-[11px] text-town-text-faint truncate mt-0.5 font-mono">
                      {rig.path}
                    </div>
                    {rig.git_branch && (
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
                        <span className="text-[11px] text-town-accent font-medium truncate">
                          {rig.git_branch}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
