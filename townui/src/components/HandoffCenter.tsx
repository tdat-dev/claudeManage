import { useMemo } from "react";
import { HandoffInfo, TaskItem } from "../lib/tauri";
import { AppLanguage, t } from "../lib/i18n";

interface HandoffCenterProps {
  language: AppLanguage;
  handoffs: HandoffInfo[];
  tasks: TaskItem[];
  loading: boolean;
  onCreate: (
    fromActorId: string,
    toActorId: string,
    workItemId: string,
    contextSummary: string,
    blockers: string[],
    nextSteps: string[],
  ) => Promise<void>;
  onAccept: (handoffId: string, acceptedByActorId?: string) => Promise<void>;
}

export default function HandoffCenter({
  language,
  handoffs,
  tasks,
  loading,
  onCreate,
  onAccept,
}: HandoffCenterProps) {
  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled"),
    [tasks],
  );

  const createHandoff = async () => {
    if (openTasks.length === 0) {
      alert("No open task to handoff");
      return;
    }

    const fromActorId = prompt("From actor_id:");
    if (!fromActorId) return;
    const toActorId = prompt("To actor_id:");
    if (!toActorId) return;

    const suggested = openTasks[0].id;
    const workItemId = prompt(
      `Task ID (default ${suggested.slice(0, 8)}...):`,
      suggested,
    );
    if (!workItemId) return;

    const contextSummary =
      prompt("Context summary:", "handoff requested") || "handoff requested";
    const blockersText =
      prompt("Blockers (comma separated, optional):", "") || "";
    const nextStepsText =
      prompt("Next steps (comma separated, optional):", "") || "";

    await onCreate(
      fromActorId.trim(),
      toActorId.trim(),
      workItemId.trim(),
      contextSummary.trim(),
      blockersText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      nextStepsText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    );
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {t(language, "handoff_center")}
        </h3>
        <div className="flex items-center gap-2">
          <span className="badge">{handoffs.length}</span>
          <button
            onClick={createHandoff}
            className="btn-primary !py-1.5 !px-2.5 !text-xs"
          >
            {t(language, "new_handoff")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-town-text-muted">Loading handoffs...</div>
      ) : handoffs.length === 0 ? (
        <div className="text-xs text-town-text-muted">No handoffs yet</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {handoffs.map((h) => (
            <div
              key={h.handoff_id}
              className="border border-town-border/30 rounded-lg p-2.5 bg-town-bg/40"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-town-text-muted truncate">
                  <span className="text-town-text">{h.from_actor_id}</span> →{" "}
                  <span className="text-town-text">{h.to_actor_id}</span>
                </div>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded border ${
                    h.status === "accepted"
                      ? "text-town-success bg-town-success-soft border-town-success/20"
                      : "text-town-warning bg-town-warning-soft border-town-warning/20"
                  }`}
                >
                  {h.status}
                </span>
              </div>
              <div className="text-[11px] text-town-text-faint mt-1 line-clamp-2">
                {h.context_summary}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-town-text-faint">
                  Task: {h.work_item_id.slice(0, 8)}...
                </span>
                {h.status === "pending" && (
                  <button
                    onClick={() => {
                      const actor =
                        prompt("Accepted by actor_id (optional):") || undefined;
                      onAccept(h.handoff_id, actor);
                    }}
                    className="btn-success !py-1 !px-2 !text-[11px]"
                  >
                    Accept
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
