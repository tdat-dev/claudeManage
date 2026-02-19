import { RigInfo } from "../lib/tauri";
import { shortenPathForCli } from "../lib/path";

interface RigListProps {
  rigs: RigInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
}

export default function RigList({ rigs, selectedId, onSelect, onAddClick }: RigListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-town-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-town-text-muted">Rigs</h2>
        <button
          onClick={onAddClick}
          className="w-7 h-7 flex items-center justify-center rounded bg-town-accent hover:bg-town-accent-hover text-white text-lg leading-none transition-colors"
          title="Add Rig"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rigs.length === 0 ? (
          <div className="px-4 py-8 text-center text-town-text-muted text-sm">
            No rigs yet. Click + to add a git repository.
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
