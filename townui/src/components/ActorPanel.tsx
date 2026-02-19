import { useEffect, useState } from "react";
import { ActorInfo } from "../lib/tauri";
import { useSettings } from "../hooks/useSettings";

interface ActorPanelProps {
  actors: ActorInfo[];
  loading: boolean;
  onAdd: (name: string, role: string, agentType: string) => Promise<void>;
  onDelete: (actorId: string) => Promise<void>;
}

// Preset roles for quick creation
const ACTOR_PRESETS = [
  {
    name: "Mayor",
    role: "coordinator",
    agentType: "claude",
    icon: "👑",
    desc: "Central orchestrator — creates plans, dispatches work",
  },
  {
    name: "Architect",
    role: "architect",
    agentType: "claude",
    icon: "🏗️",
    desc: "System design, API contracts, tech decisions",
  },
  {
    name: "Frontend Dev",
    role: "frontend",
    agentType: "claude",
    icon: "🎨",
    desc: "UI components, styling, client logic",
  },
  {
    name: "Backend Dev",
    role: "backend",
    agentType: "claude",
    icon: "⚙️",
    desc: "APIs, services, database, business logic",
  },
  {
    name: "QA Tester",
    role: "qa",
    agentType: "claude",
    icon: "🧪",
    desc: "Write & run tests, find bugs, verify",
  },
  {
    name: "DevOps",
    role: "devops",
    agentType: "claude",
    icon: "🚀",
    desc: "CI/CD, deployment, infrastructure",
  },
  {
    name: "Security",
    role: "security",
    agentType: "claude",
    icon: "🛡️",
    desc: "Security review, vulnerability scanning",
  },
  {
    name: "Reviewer",
    role: "reviewer",
    agentType: "claude",
    icon: "🔍",
    desc: "Code review, PR feedback, standards",
  },
  {
    name: "Docs Writer",
    role: "docs",
    agentType: "claude",
    icon: "📚",
    desc: "Documentation, guides, changelogs",
  },
  {
    name: "Hotfix",
    role: "hotfix",
    agentType: "claude",
    icon: "🔥",
    desc: "Emergency fixes, quick patches",
  },
];

const AGENT_TYPES = [
  "claude",
  "codex",
  "aider",
  "cursor",
  "cline",
  "roo-code",
  "gemini-cli",
  "amp",
  "codename-goose",
  "opencode",
  "copilot",
  "github-copilot-chat",
  "windsurf",
  "zed",
  "kilo-code",
];

export default function ActorPanel({
  actors,
  loading,
  onAdd,
  onDelete,
}: ActorPanelProps) {
  const { settings } = useSettings();
  const defaultCli = settings?.default_cli || "claude";
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  const [creating, setCreating] = useState(false);

  // Custom form
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [agentType, setAgentType] = useState(defaultCli);

  useEffect(() => {
    if (settings?.default_cli) {
      setAgentType(settings.default_cli);
    }
  }, [settings?.default_cli]);

  // Track which presets are already created
  const existingRoles = new Set(actors.map((a) => a.role));

  const createFromPreset = async (preset: (typeof ACTOR_PRESETS)[0]) => {
    setCreating(true);
    try {
      await onAdd(preset.name, preset.role, defaultCli || preset.agentType);
    } finally {
      setCreating(false);
    }
  };

  const createCustom = async () => {
    if (!name.trim() || !role.trim()) return;
    setCreating(true);
    try {
      await onAdd(name.trim(), role.trim(), agentType);
      setName("");
      setRole("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow-sm">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Actors</h1>
            <p className="text-xs text-town-text-muted mt-0.5">
              {actors.length} actor{actors.length !== 1 ? "s" : ""} · Named AI
              agents & team members
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 min-h-0">
        {/* Actor creation section */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => setTab("presets")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === "presets"
                  ? "bg-town-accent/15 text-town-accent border border-town-accent/30"
                  : "text-town-text-faint hover:text-town-text-muted border border-transparent"
              }`}
            >
              Quick Presets
            </button>
            <button
              onClick={() => setTab("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === "custom"
                  ? "bg-town-accent/15 text-town-accent border border-town-accent/30"
                  : "text-town-text-faint hover:text-town-text-muted border border-transparent"
              }`}
            >
              Custom Actor
            </button>
          </div>

          {tab === "presets" ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-2">
              {ACTOR_PRESETS.map((preset) => {
                const exists = existingRoles.has(preset.role);
                return (
                  <button
                    key={preset.role}
                    disabled={exists || creating}
                    onClick={() => createFromPreset(preset)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      exists
                        ? "opacity-40 cursor-not-allowed border-town-border/20 bg-town-bg/30"
                        : "border-town-border/30 bg-town-bg/40 hover:border-town-accent/40 hover:bg-town-accent/5 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{preset.icon}</span>
                      <span className="text-xs font-semibold">
                        {preset.name}
                      </span>
                      {exists && (
                        <span className="text-[9px] text-town-text-faint ml-auto">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-town-text-faint line-clamp-2 leading-relaxed">
                      {preset.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] font-semibold text-town-text-faint uppercase tracking-wider mb-1 block">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-base !py-2 !text-xs"
                  placeholder="e.g. Backend Expert"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-semibold text-town-text-faint uppercase tracking-wider mb-1 block">
                  Role
                </label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="input-base !py-2 !text-xs"
                  placeholder="e.g. backend"
                />
              </div>
              <div className="min-w-[140px]">
                <label className="text-[10px] font-semibold text-town-text-faint uppercase tracking-wider mb-1 block">
                  Agent Type
                </label>
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value)}
                  className="select-base !py-2 !text-xs"
                >
                  {AGENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={createCustom}
                disabled={creating || !name.trim() || !role.trim()}
                className="btn-primary !py-2 !px-4 !text-xs"
              >
                {creating ? "..." : "Create"}
              </button>
            </div>
          )}
        </div>

        {/* Actor list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
          </div>
        ) : actors.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-town-surface flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">👤</span>
            </div>
            <p className="text-sm text-town-text-muted mb-1">No actors yet</p>
            <p className="text-xs text-town-text-faint">
              Create actors to assign hooks, handoffs, and tasks
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-town-text-faint">
              Active Actors ({actors.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {actors.map((actor) => (
                <ActorCard
                  key={actor.actor_id}
                  actor={actor}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )}

        {/* Help section */}
        <div className="glass-card p-3 mt-4">
          <details className="group">
            <summary className="text-xs font-semibold cursor-pointer list-none flex items-center gap-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-town-text-faint group-open:rotate-90 transition-transform"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              How Actors work in Gas Town
            </summary>
            <div className="text-xs text-town-text-muted space-y-2 mt-2 ml-5 leading-relaxed">
              <p>
                <strong>Actors</strong> are named identities for AI agents or
                people. They persist across sessions.
              </p>
              <p>
                <strong>Hooks</strong> connect an actor to a task. When you
                "sling" a task, the actor's hook receives it and auto-starts
                work.
              </p>
              <p>
                <strong>Handoffs</strong> transfer work between actors with
                context (blockers, next steps) — no info lost.
              </p>
              <p>
                <strong>Convoys</strong> group multiple tasks into a goal. Track
                progress across actors.
              </p>
              <p className="text-town-text-faint italic">
                Workflow: Create actors → Create hooks → Assign/sling tasks →
                Actors execute → Done/Handoff → Convoy complete
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function ActorCard({
  actor,
  onDelete,
}: {
  actor: ActorInfo;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const presetIcon =
    ACTOR_PRESETS.find((p) => p.role === actor.role)?.icon ?? "👤";

  return (
    <div className="group border border-town-border/30 rounded-lg p-3 bg-town-surface/50 hover:border-town-border/50 transition-all">
      <div className="flex items-start gap-2.5">
        <span className="text-lg mt-0.5">{presetIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold truncate">{actor.name}</h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-town-accent/10 text-town-accent border border-town-accent/20 font-medium shrink-0">
              {actor.agent_type}
            </span>
          </div>
          <p className="text-[11px] text-town-text-muted mt-0.5">
            Role: {actor.role}
          </p>
          <p className="text-[10px] text-town-text-faint font-mono mt-1">
            ID: {actor.actor_id.slice(0, 12)}...
          </p>
        </div>
        <button
          onClick={async () => {
            if (!confirm(`Delete actor "${actor.name}"?`)) return;
            setDeleting(true);
            try {
              await onDelete(actor.actor_id);
            } finally {
              setDeleting(false);
            }
          }}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 text-town-text-faint hover:text-red-400 transition-all"
        >
          <svg
            width="14"
            height="14"
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
  );
}
