import { useMemo, useState } from "react";
import { ActorInfo, HandoffInfo, TaskItem } from "../lib/tauri";
import { AppLanguage, t } from "../lib/i18n";

interface HandoffCenterProps {
  language: AppLanguage;
  handoffs: HandoffInfo[];
  tasks: TaskItem[];
  actors: ActorInfo[];
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
  actors,
  loading,
  onCreate,
  onAccept,
}: HandoffCenterProps) {
  const [showForm, setShowForm] = useState(false);

  const actorName = (actorId: string) => {
    const actor = actors.find((a) => a.actor_id === actorId);
    return actor ? actor.name : actorId.slice(0, 12) + "…";
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
            onClick={() => setShowForm(true)}
            className="btn-primary !py-1.5 !px-2.5 !text-xs"
          >
            {t(language, "new_handoff")}
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <HandoffCreateForm
          actors={actors}
          tasks={tasks}
          onCreate={async (...args) => {
            await onCreate(...args);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-xs text-town-text-muted">Loading handoffs…</div>
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
                  <span className="text-town-text">
                    {actorName(h.from_actor_id)}
                  </span>{" "}
                  →{" "}
                  <span className="text-town-text">
                    {actorName(h.to_actor_id)}
                  </span>
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
                  Task: {h.work_item_id.slice(0, 8)}…
                </span>
                {h.status === "pending" && (
                  <AcceptButton
                    handoffId={h.handoff_id}
                    actors={actors}
                    onAccept={onAccept}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Inline handoff creation form ── */

function HandoffCreateForm({
  actors,
  tasks,
  onCreate,
  onCancel,
}: {
  actors: ActorInfo[];
  tasks: TaskItem[];
  onCreate: (
    fromActorId: string,
    toActorId: string,
    workItemId: string,
    contextSummary: string,
    blockers: string[],
    nextSteps: string[],
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled"),
    [tasks],
  );

  const [fromActorId, setFromActorId] = useState("");
  const [toActorId, setToActorId] = useState("");
  const [workItemId, setWorkItemId] = useState(openTasks[0]?.id ?? "");
  const [contextSummary, setContextSummary] = useState("");
  const [blockersText, setBlockersText] = useState("");
  const [nextStepsText, setNextStepsText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    fromActorId && toActorId && workItemId && contextSummary.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate(
        fromActorId,
        toActorId,
        workItemId,
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-town-accent/30 rounded-lg p-3 bg-town-surface/50 space-y-2">
      <div className="text-xs font-semibold text-town-accent">New Handoff</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-town-text-faint block mb-0.5">
            From
          </label>
          <select
            value={fromActorId}
            onChange={(e) => setFromActorId(e.target.value)}
            className="select-base !text-xs !py-1.5"
          >
            <option value="">Select actor…</option>
            {actors.map((a) => (
              <option key={a.actor_id} value={a.actor_id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-town-text-faint block mb-0.5">
            To
          </label>
          <select
            value={toActorId}
            onChange={(e) => setToActorId(e.target.value)}
            className="select-base !text-xs !py-1.5"
          >
            <option value="">Select actor…</option>
            {actors
              .filter((a) => a.actor_id !== fromActorId)
              .map((a) => (
                <option key={a.actor_id} value={a.actor_id}>
                  {a.name} ({a.role})
                </option>
              ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-town-text-faint block mb-0.5">
          Task
        </label>
        <select
          value={workItemId}
          onChange={(e) => setWorkItemId(e.target.value)}
          className="select-base !text-xs !py-1.5"
        >
          <option value="">Select task…</option>
          {openTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-town-text-faint block mb-0.5">
          Context summary
        </label>
        <textarea
          value={contextSummary}
          onChange={(e) => setContextSummary(e.target.value)}
          className="input-base !text-xs !py-1.5 resize-none"
          rows={2}
          placeholder="Describe what was done and what needs to continue…"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-town-text-faint block mb-0.5">
            Blockers (comma-separated)
          </label>
          <input
            value={blockersText}
            onChange={(e) => setBlockersText(e.target.value)}
            className="input-base !text-xs !py-1.5"
            placeholder="e.g. API not ready, missing schema"
          />
        </div>
        <div>
          <label className="text-[10px] text-town-text-faint block mb-0.5">
            Next steps (comma-separated)
          </label>
          <input
            value={nextStepsText}
            onChange={(e) => setNextStepsText(e.target.value)}
            className="input-base !text-xs !py-1.5"
            placeholder="e.g. write tests, deploy"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="btn-ghost !py-1.5 !px-3 !text-xs">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="btn-primary !py-1.5 !px-3 !text-xs"
        >
          {submitting ? "Creating…" : "Create Handoff"}
        </button>
      </div>
    </div>
  );
}

/* ── Accept button with actor dropdown ── */

function AcceptButton({
  handoffId,
  actors,
  onAccept,
}: {
  handoffId: string;
  actors: ActorInfo[];
  onAccept: (handoffId: string, acceptedByActorId?: string) => Promise<void>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [actorId, setActorId] = useState("");

  if (!showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="btn-success !py-1 !px-2 !text-[11px]"
      >
        Accept
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={actorId}
        onChange={(e) => setActorId(e.target.value)}
        className="select-base !text-[11px] !py-1 max-w-[120px]"
      >
        <option value="">Any actor</option>
        {actors.map((a) => (
          <option key={a.actor_id} value={a.actor_id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          onAccept(handoffId, actorId || undefined);
          setShowPicker(false);
        }}
        className="btn-success !py-1 !px-2 !text-[11px]"
      >
        ✓
      </button>
      <button
        onClick={() => setShowPicker(false)}
        className="btn-ghost !py-1 !px-1.5 !text-[11px]"
      >
        ✕
      </button>
    </div>
  );
}
