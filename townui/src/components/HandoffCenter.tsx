import { useMemo, useState, useRef } from "react";
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
  onReject: (handoffId: string, reason?: string) => Promise<void>;
  onExport: (handoffId: string) => Promise<string | undefined>;
  onImport: (jsonData: string) => Promise<void>;
}

export default function HandoffCenter({
  language,
  handoffs,
  tasks,
  actors,
  loading,
  onCreate,
  onAccept,
  onReject,
  onExport,
  onImport,
}: HandoffCenterProps) {
  const [showForm, setShowForm] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const actorName = (actorId: string) => {
    const actor = actors.find((a) => a.actor_id === actorId);
    return actor ? actor.name : actorId.slice(0, 12) + "…";
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await onImport(text);
    } catch {
      /* error handled by hook */
    }
    // reset so same file can be re-imported
    if (importRef.current) importRef.current.value = "";
  };

  const handleExport = async (handoffId: string) => {
    const json = await onExport(handoffId);
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `handoff-${handoffId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {t(language, "handoff_center")}
        </h3>
        <div className="flex items-center gap-2">
          <span className="badge">{handoffs.length}</span>
          {/* Hidden file input for import */}
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => importRef.current?.click()}
            className="btn-ghost !py-1.5 !px-2.5 !text-xs"
            title={t(language, "import_handoff")}
          >
            ↓ {t(language, "import_handoff")}
          </button>
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
          language={language}
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
        <div className="text-xs text-town-text-muted">{t(language, "handoff_loading")}</div>
      ) : handoffs.length === 0 ? (
        <div className="text-xs text-town-text-muted">{t(language, "handoff_no_handoffs")}</div>
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
                  className={`text-[11px] px-1.5 py-0.5 rounded border ${h.status === "accepted"
                    ? "text-town-success bg-town-success-soft border-town-success/20"
                    : h.status === "rejected"
                      ? "text-town-danger bg-town-danger-soft border-town-danger/20"
                      : "text-town-warning bg-town-warning-soft border-town-warning/20"
                    }`}
                >
                  {h.status === "accepted" ? t(language, "handoff_accepted") : h.status === "rejected" ? t(language, "handoff_rejected") : t(language, "handoff_pending")}
                </span>
              </div>
              <div className="text-[11px] text-town-text-faint mt-1 line-clamp-2">
                {h.context_summary}
              </div>
              {h.status === "rejected" && h.rejected_reason && (
                <div className="text-[11px] text-town-danger mt-1 italic">
                  {t(language, "handoff_reason")}: {h.rejected_reason}
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-town-text-faint">
                  {t(language, "handoff_task")}: {h.work_item_id.slice(0, 8)}…
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExport(h.handoff_id)}
                    className="btn-ghost !py-1 !px-2 !text-[11px]"
                    title={t(language, "export_handoff")}
                  >
                    ↑ JSON
                  </button>
                  {h.status === "pending" && (
                    <>
                      <RejectButton
                        language={language}
                        handoffId={h.handoff_id}
                        onReject={onReject}
                      />
                      <AcceptButton
                        language={language}
                        handoffId={h.handoff_id}
                        actors={actors}
                        onAccept={onAccept}
                      />
                    </>
                  )}
                </div>
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
  language,
  actors,
  tasks,
  onCreate,
  onCancel,
}: {
  language: AppLanguage;
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
      <div className="text-xs font-semibold text-town-accent">{t(language, "new_handoff")}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-town-text-faint block mb-0.5">
            {t(language, "handoff_from")}
          </label>
          <select
            value={fromActorId}
            onChange={(e) => setFromActorId(e.target.value)}
            className="select-base !text-xs !py-1.5"
          >
            <option value="">{t(language, "handoff_select_actor")}</option>
            {actors.map((a) => (
              <option key={a.actor_id} value={a.actor_id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-town-text-faint block mb-0.5">
            {t(language, "handoff_to")}
          </label>
          <select
            value={toActorId}
            onChange={(e) => setToActorId(e.target.value)}
            className="select-base !text-xs !py-1.5"
          >
            <option value="">{t(language, "handoff_select_actor")}</option>
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
          {t(language, "handoff_task")}
        </label>
        <select
          value={workItemId}
          onChange={(e) => setWorkItemId(e.target.value)}
          className="select-base !text-xs !py-1.5"
        >
          <option value="">{t(language, "handoff_select_task")}</option>
          {openTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-town-text-faint block mb-0.5">
          {t(language, "handoff_context")}
        </label>
        <textarea
          value={contextSummary}
          onChange={(e) => setContextSummary(e.target.value)}
          className="input-base !text-xs !py-1.5 resize-none"
          rows={2}
          placeholder={t(language, "handoff_context_placeholder")}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-town-text-faint block mb-0.5">
            {t(language, "handoff_blockers")}
          </label>
          <input
            value={blockersText}
            onChange={(e) => setBlockersText(e.target.value)}
            className="input-base !text-xs !py-1.5"
            placeholder={t(language, "handoff_blockers_placeholder")}
          />
        </div>
        <div>
          <label className="text-[10px] text-town-text-faint block mb-0.5">
            {t(language, "handoff_next_steps")}
          </label>
          <input
            value={nextStepsText}
            onChange={(e) => setNextStepsText(e.target.value)}
            className="input-base !text-xs !py-1.5"
            placeholder={t(language, "handoff_next_steps_placeholder")}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="btn-ghost !py-1.5 !px-3 !text-xs">
          {t(language, "cancel")}
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="btn-primary !py-1.5 !px-3 !text-xs"
        >
          {submitting ? t(language, "handoff_creating") : t(language, "handoff_create_btn")}
        </button>
      </div>
    </div>
  );
}

/* ── Reject button with reason input ── */

function RejectButton({
  language,
  handoffId,
  onReject,
}: {
  language: AppLanguage;
  handoffId: string;
  onReject: (handoffId: string, reason?: string) => Promise<void>;
}) {
  const [showInput, setShowInput] = useState(false);
  const [reason, setReason] = useState("");

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="btn-danger !py-1 !px-2 !text-[11px]"
      >
        {t(language, "reject_handoff")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="input-base !text-[11px] !py-1 max-w-[140px]"
        placeholder={t(language, "reject_reason")}
        autoFocus
      />
      <button
        onClick={() => {
          onReject(handoffId, reason || undefined);
          setShowInput(false);
        }}
        className="btn-danger !py-1 !px-2 !text-[11px]"
      >
        ✓
      </button>
      <button
        onClick={() => setShowInput(false)}
        className="btn-ghost !py-1 !px-1.5 !text-[11px]"
      >
        ✕
      </button>
    </div>
  );
}

/* ── Accept button with actor dropdown ── */

function AcceptButton({
  language,
  handoffId,
  actors,
  onAccept,
}: {
  language: AppLanguage;
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
        {t(language, "handoff_accept")}
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
        <option value="">{t(language, "handoff_any_actor")}</option>
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
