import { useMemo, useState } from "react";
import { ActorInfo, HookInfo, TaskItem } from "../lib/tauri";
import { AppLanguage, t } from "../lib/i18n";

interface HookInboxProps {
  language: AppLanguage;
  hooks: HookInfo[];
  tasks: TaskItem[];
  actors: ActorInfo[];
  loading: boolean;
  onCreateHook: (actorId: string) => Promise<void>;
  onAssign: (hookId: string, taskId: string) => Promise<void>;
  onSling: (hookId: string, taskId: string) => Promise<void>;
  onDone: (hookId: string, outcome?: string) => Promise<void>;
  onResume: (hookId: string) => Promise<void>;
}

const statusStyle: Record<string, string> = {
  idle: "text-town-text-muted bg-town-surface/70 border-town-border/40",
  assigned: "text-town-warning bg-town-warning-soft border-town-warning/20",
  running: "text-town-accent bg-town-accent/10 border-town-accent/25",
  done: "text-town-success bg-town-success-soft border-town-success/20",
};

export default function HookInbox({
  language,
  hooks,
  tasks,
  actors,
  loading,
  onCreateHook,
  onAssign,
  onSling,
  onDone,
  onResume,
}: HookInboxProps) {
  const [selectedActorId, setSelectedActorId] = useState("");
  const [creating, setCreating] = useState(false);

  const todoTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled"),
    [tasks],
  );

  // Actors that don't already have a hook
  const availableActors = useMemo(() => {
    const hookedActorIds = new Set(hooks.map((h) => h.attached_actor_id));
    return actors.filter((a) => !hookedActorIds.has(a.actor_id));
  }, [actors, hooks]);

  const create = async () => {
    const actorId = selectedActorId.trim();
    if (!actorId) return;
    setCreating(true);
    try {
      await onCreateHook(actorId);
      setSelectedActorId("");
    } finally {
      setCreating(false);
    }
  };

  // Resolve actor name from id
  const actorName = (actorId: string) => {
    const actor = actors.find((a) => a.actor_id === actorId);
    return actor ? `${actor.name} (${actor.role})` : actorId.slice(0, 12) + "…";
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t(language, "hook_inbox")}</h3>
        <span className="badge">{hooks.length}</span>
      </div>

      {/* Create hook — actor dropdown */}
      <div className="flex gap-2">
        {availableActors.length > 0 ? (
          <select
            value={selectedActorId}
            onChange={(e) => setSelectedActorId(e.target.value)}
            className="select-base !py-2 !text-xs flex-1"
          >
            <option value="">Select an actor…</option>
            {availableActors.map((actor) => (
              <option key={actor.actor_id} value={actor.actor_id}>
                {actor.name} ({actor.role}) — {actor.agent_type}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex-1 text-[11px] text-town-text-faint flex items-center px-2">
            {actors.length === 0
              ? "Create actors first (Actors page)"
              : "All actors already have hooks"}
          </div>
        )}
        <button
          onClick={create}
          disabled={creating || !selectedActorId}
          className="btn-primary !py-2 !px-3 !text-xs"
        >
          {creating ? "…" : "Create Hook"}
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-town-text-muted">Loading hooks…</div>
      ) : hooks.length === 0 ? (
        <div className="text-xs text-town-text-muted">
          No hooks yet — create actors first, then add hooks
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {hooks.map((hook) => {
            const defaultTaskId =
              hook.current_work_id ?? todoTasks[0]?.id ?? "";
            return (
              <HookRow
                key={hook.hook_id}
                hook={hook}
                tasks={todoTasks}
                defaultTaskId={defaultTaskId}
                actorLabel={actorName(hook.attached_actor_id)}
                onAssign={onAssign}
                onSling={onSling}
                onDone={onDone}
                onResume={onResume}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function HookRow({
  hook,
  tasks,
  defaultTaskId,
  actorLabel,
  onAssign,
  onSling,
  onDone,
  onResume,
}: {
  hook: HookInfo;
  tasks: TaskItem[];
  defaultTaskId: string;
  actorLabel: string;
  onAssign: (hookId: string, taskId: string) => Promise<void>;
  onSling: (hookId: string, taskId: string) => Promise<void>;
  onDone: (hookId: string, outcome?: string) => Promise<void>;
  onResume: (hookId: string) => Promise<void>;
}) {
  const [taskId, setTaskId] = useState(defaultTaskId);

  const style = statusStyle[hook.status] || statusStyle.idle;

  return (
    <div className="border border-town-border/30 rounded-lg p-2.5 bg-town-bg/40">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs font-medium truncate"
          title={hook.attached_actor_id}
        >
          {actorLabel}
        </span>
        <span className={`text-[11px] px-1.5 py-0.5 rounded border ${style}`}>
          {hook.status}
        </span>
        {hook.current_work_id && (
          <span
            className="text-[10px] text-town-text-faint ml-auto"
            title={hook.current_work_id}
          >
            📌 task
          </span>
        )}
      </div>

      {hook.status !== "done" && (
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="select-base !text-xs !py-1.5"
        >
          <option value="">Select task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2">
        {(hook.status === "idle" || hook.status === "assigned") && (
          <>
            <button
              onClick={() => taskId && onAssign(hook.hook_id, taskId)}
              disabled={!taskId}
              className="btn-ghost !py-1 !px-2 !text-[11px]"
            >
              Assign
            </button>
            <button
              onClick={() => taskId && onSling(hook.hook_id, taskId)}
              disabled={!taskId}
              className="btn-primary !py-1 !px-2 !text-[11px]"
            >
              ⚡ Sling
            </button>
          </>
        )}
        {(hook.status === "running" || hook.status === "assigned") && (
          <button
            onClick={() => {
              const outcome = prompt("Outcome (optional):") || undefined;
              onDone(hook.hook_id, outcome);
            }}
            className="btn-success !py-1 !px-2 !text-[11px]"
          >
            ✓ Done
          </button>
        )}
        {hook.status === "done" && (
          <button
            onClick={() => onResume(hook.hook_id)}
            className="btn-ghost !py-1 !px-2 !text-[11px]"
          >
            ↻ Resume
          </button>
        )}
      </div>
    </div>
  );
}
