import { useMemo, useState } from "react";
import { HookInfo, TaskItem } from "../lib/tauri";
import { AppLanguage, t } from "../lib/i18n";

interface HookInboxProps {
  language: AppLanguage;
  hooks: HookInfo[];
  tasks: TaskItem[];
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
  loading,
  onCreateHook,
  onAssign,
  onSling,
  onDone,
  onResume,
}: HookInboxProps) {
  const [newActorId, setNewActorId] = useState("");
  const [creating, setCreating] = useState(false);

  const todoTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled"),
    [tasks],
  );

  const create = async () => {
    const actorId = newActorId.trim();
    if (!actorId) return;
    setCreating(true);
    try {
      await onCreateHook(actorId);
      setNewActorId("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t(language, "hook_inbox")}</h3>
        <span className="badge">{hooks.length}</span>
      </div>

      <div className="flex gap-2">
        <input
          value={newActorId}
          onChange={(e) => setNewActorId(e.target.value)}
          className="input-base !py-2 !text-xs"
          placeholder="actor_id (e.g. backend-dev-1)"
        />
        <button
          onClick={create}
          disabled={creating || !newActorId.trim()}
          className="btn-primary !py-2 !px-3 !text-xs"
        >
          {creating ? "..." : "Create"}
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-town-text-muted">Loading hooks...</div>
      ) : hooks.length === 0 ? (
        <div className="text-xs text-town-text-muted">No hooks yet</div>
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
  onAssign,
  onSling,
  onDone,
  onResume,
}: {
  hook: HookInfo;
  tasks: TaskItem[];
  defaultTaskId: string;
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
        <span className="text-xs font-medium truncate">
          {hook.attached_actor_id}
        </span>
        <span className={`text-[11px] px-1.5 py-0.5 rounded border ${style}`}>
          {hook.status}
        </span>
      </div>

      <select
        value={taskId}
        onChange={(e) => setTaskId(e.target.value)}
        className="select-base !text-xs !py-1.5"
      >
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-1.5 mt-2">
        <button
          onClick={() => taskId && onAssign(hook.hook_id, taskId)}
          className="btn-base !py-1 !px-2 !text-[11px]"
        >
          Assign
        </button>
        <button
          onClick={() => taskId && onSling(hook.hook_id, taskId)}
          className="btn-primary !py-1 !px-2 !text-[11px]"
        >
          Sling
        </button>
        <button
          onClick={() => {
            const outcome = prompt("Outcome (optional):") || undefined;
            onDone(hook.hook_id, outcome);
          }}
          className="btn-success !py-1 !px-2 !text-[11px]"
        >
          Done
        </button>
        <button
          onClick={() => onResume(hook.hook_id)}
          className="btn-base !py-1 !px-2 !text-[11px]"
        >
          Resume
        </button>
      </div>
    </div>
  );
}
