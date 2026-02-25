import { useState } from "react";
import {
  WorkflowTemplate,
  WorkflowInstance,
  WorkflowStep,
  StepStatus,
  CrewInfo,
  LogEntry,
  spawnWorker,
  listWorkers,
  getWorkerLogs,
  writeLineToWorker,
} from "../lib/tauri";
import { useWorkflows } from "../hooks/useWorkflows";
import { useCrews } from "../hooks/useCrews";

interface WorkflowRunnerProps {
  rigId: string;
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> =
  {
    created: {
      bg: "bg-town-text-muted/10",
      text: "text-town-text-muted",
      dot: "bg-town-text-muted",
    },
    running: {
      bg: "bg-town-accent/10",
      text: "text-town-accent",
      dot: "bg-town-accent",
    },
    completed: {
      bg: "bg-town-success/10",
      text: "text-town-success",
      dot: "bg-town-success",
    },
    failed: {
      bg: "bg-town-danger/10",
      text: "text-town-danger",
      dot: "bg-town-danger",
    },
    cancelled: {
      bg: "bg-town-warning/10",
      text: "text-town-warning",
      dot: "bg-town-warning",
    },
  };

const stepColors: Record<StepStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-town-text-muted/10", text: "text-town-text-muted" },
  running: { bg: "bg-town-accent/10", text: "text-town-accent" },
  done: { bg: "bg-town-success/10", text: "text-town-success" },
  failed: { bg: "bg-town-danger/10", text: "text-town-danger" },
  skipped: { bg: "bg-town-warning/10", text: "text-town-warning" },
};

function StepStatusBadge({ status }: { status: StepStatus }) {
  const c = stepColors[status] ?? stepColors.pending;
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.bg} ${c.text}`}
    >
      {status}
    </span>
  );
}

function resolveStepCommand(
  commandTemplate: string,
  variables: Record<string, string>,
): string {
  return commandTemplate.replace(/\{\{(.*?)\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    const value = variables[key];
    // Keep unknown/empty placeholders visible instead of silently blanking them.
    if (typeof value !== "string" || value.trim().length === 0) {
      return `{{${key}}}`;
    }
    return value;
  });
}

function getFirstRunnableStep(
  instance: WorkflowInstance,
  template: WorkflowTemplate | null,
): WorkflowStep | null {
  if (!template) return null;

  for (const step of template.steps) {
    const stepState = instance.steps_status[step.step_id];
    if (
      !stepState ||
      (stepState.status !== "pending" && stepState.status !== "failed")
    ) {
      continue;
    }

    const depsReady = step.dependencies.every((dep) => {
      const depStatus = instance.steps_status[dep]?.status;
      return depStatus === "done" || depStatus === "skipped";
    });
    if (depsReady) return step;
  }

  return null;
}

function selectCrewForStep(
  step: WorkflowStep,
  crews: CrewInfo[],
): CrewInfo | null {
  if (crews.length === 0) return null;
  const byName = (token: string) =>
    crews.find((c) => c.name.toLowerCase().includes(token));
  const sid = step.step_id.toLowerCase();

  if (sid.includes("plan") || sid.includes("design")) {
    return byName("architect") ?? crews[0];
  }
  if (sid.includes("implement")) {
    return byName("backend") ?? byName("frontend") ?? crews[0];
  }
  if (sid.includes("test")) {
    return byName("qa") ?? crews[0];
  }
  if (sid.includes("review")) {
    return byName("review") ?? byName("architect") ?? crews[0];
  }
  if (sid.includes("deploy")) {
    return byName("devops") ?? byName("release") ?? crews[0];
  }
  return crews[0];
}

const WORKER_READY_TIMEOUT_MS = 8000;
const WORKER_READY_POLL_MS = 300;

function hasWorkerReadySignal(logs: LogEntry[]): boolean {
  if (logs.length === 0) return false;
  if (logs.some((l) => l.stream === "stdout" || l.stream === "stderr")) {
    return true;
  }
  return logs.some((l) => {
    const line = l.line.toLowerCase();
    return (
      line.includes("openai codex") ||
      line.includes("session id") ||
      line.includes("codex")
    );
  });
}

// ── Template Creator ──
function TemplateCreateForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (
    name: string,
    description: string,
    steps: WorkflowStep[],
    variables: string[],
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [variables, setVariables] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([
    {
      step_id: "step_1",
      title: "",
      description: "",
      command_template: "",
      agent_type: "codex",
      dependencies: [],
      acceptance_criteria: null,
    },
  ]);
  const [saving, setSaving] = useState(false);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        step_id: `step_${prev.length + 1}`,
        title: "",
        description: "",
        command_template: "",
        agent_type: "codex",
        dependencies: [],
        acceptance_criteria: null,
      },
    ]);
  };

  const updateStep = (
    index: number,
    field: keyof WorkflowStep,
    value: string,
  ) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (field === "dependencies") {
          return {
            ...s,
            dependencies: value
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          };
        }
        return { ...s, [field]: value };
      }),
    );
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(
        name.trim(),
        description.trim(),
        steps,
        variables
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-4 animate-slide-up">
      <h3 className="text-sm font-bold">New Workflow Template (Formula)</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-town-text-muted mb-1">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-base"
            placeholder="e.g. Feature Pipeline"
          />
        </div>
        <div>
          <label className="block text-xs text-town-text-muted mb-1">
            Variables (comma-sep)
          </label>
          <input
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            className="input-base"
            placeholder="e.g. feature_name, branch"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-town-text-muted mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-base resize-none"
          rows={2}
          placeholder="What does this workflow do?"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold">Steps</h4>
          <button
            onClick={addStep}
            className="btn-base !py-0.5 !px-2 !text-[11px]"
          >
            + Add Step
          </button>
        </div>
        {steps.map((step, i) => (
          <div
            key={i}
            className="border border-town-border/50 rounded-lg p-3 space-y-2 bg-town-surface/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-town-text-muted">
                {step.step_id}
              </span>
              {steps.length > 1 && (
                <button
                  onClick={() => removeStep(i)}
                  className="text-[10px] text-town-danger hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={step.title}
                onChange={(e) => updateStep(i, "title", e.target.value)}
                className="input-base !text-xs"
                placeholder="Step title"
              />
              <input
                value={step.agent_type}
                onChange={(e) => updateStep(i, "agent_type", e.target.value)}
                className="input-base !text-xs"
                placeholder="Agent type"
              />
              <input
                value={step.dependencies.join(", ")}
                onChange={(e) => updateStep(i, "dependencies", e.target.value)}
                className="input-base !text-xs"
                placeholder="Dependencies (step_ids)"
              />
            </div>
            <textarea
              value={step.command_template}
              onChange={(e) =>
                updateStep(i, "command_template", e.target.value)
              }
              className="input-base !text-xs resize-none"
              rows={2}
              placeholder="Command template (use {{variable}} for substitution)"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="btn-primary"
        >
          {saving ? "Creating..." : "Create Template"}
        </button>
        <button onClick={onCancel} className="btn-base">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Instance Creator ──
function InstantiateForm({
  template,
  onSubmit,
  onCancel,
}: {
  template: WorkflowTemplate;
  onSubmit: (variables: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [vars, setVars] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    template.variables.forEach((v) => (init[v] = ""));
    return init;
  });
  const [saving, setSaving] = useState(false);
  const missingVars = template.variables.filter(
    (v) => !((vars[v] ?? "").trim().length > 0),
  );
  const canCreate = missingVars.length === 0 && !saving;

  const handleSubmit = async () => {
    if (!canCreate) return;
    setSaving(true);
    try {
      await onSubmit(vars);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-3 animate-slide-up">
      <h3 className="text-sm font-bold">
        Instantiate: <span className="text-town-accent">{template.name}</span>
      </h3>
      {template.variables.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {template.variables.map((v) => (
            <div key={v}>
              <label className="block text-xs text-town-text-muted mb-1">
                {v}
              </label>
              <input
                value={vars[v] ?? ""}
                onChange={(e) =>
                  setVars((prev) => ({ ...prev, [v]: e.target.value }))
                }
                className="input-base !text-xs"
                placeholder={`Value for ${v}`}
              />
            </div>
          ))}
        </div>
      )}
      {template.variables.length === 0 && (
        <p className="text-xs text-town-text-muted">No variables to fill in.</p>
      )}
      {missingVars.length > 0 && (
        <div className="rounded-lg border border-town-warning/25 bg-town-warning/10 px-3 py-2 text-xs text-town-warning">
          Missing required variables: {missingVars.join(", ")}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={!canCreate}
          className="btn-success"
        >
          {saving ? "Creating..." : "Create Instance"}
        </button>
        <button onClick={onCancel} className="btn-base">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Instance DAG View ──
function InstanceView({
  instance,
  template,
  launchingRunKey,
  onAdvance,
  onRunStep,
  onStart,
  onCancel,
  onDelete,
  isDeleting,
  isConfirmingDelete,
  onAskDelete,
  onCancelDelete,
}: {
  instance: WorkflowInstance;
  template: WorkflowTemplate | null;
  launchingRunKey: string | null;
  onAdvance: (stepId: string, status: StepStatus) => Promise<void>;
  onRunStep: (step: WorkflowStep) => Promise<void>;
  onStart: () => Promise<void>;
  onCancel: () => Promise<void>;
  onDelete: () => Promise<void>;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
}) {
  const steps = template?.steps ?? [];
  const sc = statusColors[instance.status] ?? statusColors.created;

  // Compute progress
  const total = Object.keys(instance.steps_status).length;
  const doneCount = Object.values(instance.steps_status).filter(
    (s) => s.status === "done" || s.status === "skipped",
  ).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
          <h4 className="text-sm font-bold">{instance.template_name}</h4>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.bg} ${sc.text}`}
          >
            {instance.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-town-text-faint font-mono">
            {pct}% ({doneCount}/{total})
          </span>
          {(instance.status === "created" || instance.status === "failed") && (
            <button
              onClick={onStart}
              className="btn-success !py-0.5 !px-2 !text-[11px]"
            >
              {instance.status === "failed" ? "↻ Resume" : "▶ Start"}
            </button>
          )}
          {(instance.status === "created" || instance.status === "running") && (
            <button
              onClick={onCancel}
              className="btn-base !py-0.5 !px-2 !text-[11px] text-town-danger"
            >
              Cancel
            </button>
          )}
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1 animate-fade-in">
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-town-danger/15 text-town-danger disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Confirm"}
              </button>
              <button
                onClick={onCancelDelete}
                className="px-1.5 py-0.5 text-[10px] text-town-text-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onAskDelete}
              className="btn-base !py-0.5 !px-2 !text-[11px] text-town-danger"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-town-surface rounded-full h-1.5">
        <div
          className="bg-town-success rounded-full h-1.5 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps DAG */}
      <div className="space-y-1.5">
        {steps.map((step) => {
          const state = instance.steps_status[step.step_id];
          if (!state) return null;
          const depsReady = step.dependencies.every(
            (d) =>
              instance.steps_status[d]?.status === "done" ||
              instance.steps_status[d]?.status === "skipped",
          );
          const canRun =
            (instance.status === "running" || instance.status === "failed") &&
            (state.status === "pending" || state.status === "failed") &&
            depsReady;
          const stepRunKey = `${instance.instance_id}:${step.step_id}`;
          const launchingThisStep = launchingRunKey === stepRunKey;
          const canDone = state.status === "running";

          return (
            <div
              key={step.step_id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-town-surface/40 border border-town-border/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <StepStatusBadge status={state.status} />
                <span className="text-xs font-medium truncate">
                  {step.title}
                </span>
                {step.dependencies.length > 0 && (
                  <span className="text-[9px] text-town-text-faint">
                    ← {step.dependencies.join(", ")}
                  </span>
                )}
                <span className="text-[9px] text-town-text-faint font-mono">
                  [{step.agent_type}]
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canRun && (
                  <button
                    onClick={() => onRunStep(step)}
                    disabled={launchingThisStep}
                    className="btn-primary !py-0.5 !px-2 !text-[10px]"
                  >
                    {launchingThisStep
                      ? "Starting..."
                      : state.status === "failed"
                        ? "↻ Retry"
                        : "▶ Run"}
                  </button>
                )}
                {canDone && (
                  <>
                    <button
                      onClick={() => onAdvance(step.step_id, "done")}
                      className="btn-success !py-0.5 !px-2 !text-[10px]"
                    >
                      ✓ Done
                    </button>
                    <button
                      onClick={() => onAdvance(step.step_id, "failed")}
                      className="btn-base !py-0.5 !px-2 !text-[10px] text-town-danger"
                    >
                      ✗ Fail
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-town-text-faint">
        Created: {new Date(instance.created_at).toLocaleString()}
        {instance.completed_at && (
          <> · Completed: {new Date(instance.completed_at).toLocaleString()}</>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──
export default function WorkflowRunner({ rigId }: WorkflowRunnerProps) {
  const {
    templates,
    instances,
    loading,
    addTemplate,
    removeTemplate,
    removeInstance,
    instantiate,
    start,
    advance,
    cancel,
  } = useWorkflows(rigId || null);
  const { crews } = useCrews(rigId || null);

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [instantiateTarget, setInstantiateTarget] =
    useState<WorkflowTemplate | null>(null);
  const [tab, setTab] = useState<"instances" | "templates">("instances");
  const [runError, setRunError] = useState<string | null>(null);
  const [launchingRunKey, setLaunchingRunKey] = useState<string | null>(null);

  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<
    string | null
  >(null);
  const [confirmDeleteInstanceId, setConfirmDeleteInstanceId] = useState<
    string | null
  >(null);
  const [deletingInstanceId, setDeletingInstanceId] = useState<string | null>(
    null,
  );

  const waitForWorkerReady = async (workerId: string): Promise<boolean> => {
    const deadline = Date.now() + WORKER_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const logs = await getWorkerLogs(workerId);
        if (hasWorkerReadySignal(logs)) {
          return true;
        }
      } catch {
        // Ignore transient log-read errors while worker boots.
      }
      await new Promise((resolve) => setTimeout(resolve, WORKER_READY_POLL_MS));
    }
    return false;
  };

  if (!rigId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-town-text-muted">Select a rig first</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-town-border/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-town-accent/20 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-400"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight">Workflows</h1>
          <span className="badge">{instances.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-town-surface/60 border border-town-border rounded-lg p-0.5">
            <button
              onClick={() => setTab("instances")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                tab === "instances"
                  ? "bg-town-accent/15 text-town-accent"
                  : "text-town-text-muted hover:text-town-text"
              }`}
            >
              Instances ({instances.length})
            </button>
            <button
              onClick={() => setTab("templates")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                tab === "templates"
                  ? "bg-town-accent/15 text-town-accent"
                  : "text-town-text-muted hover:text-town-text"
              }`}
            >
              Templates ({templates.length})
            </button>
          </div>
          <button
            onClick={() => setShowCreateTemplate(true)}
            className="btn-primary"
          >
            + New Template
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
        {runError && (
          <div className="rounded-xl border border-town-danger/25 bg-town-danger/10 px-4 py-2.5 text-xs text-town-danger">
            {runError}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
          </div>
        )}

        {/* Template create form */}
        {showCreateTemplate && (
          <TemplateCreateForm
            onSubmit={async (name, desc, steps, vars) => {
              await addTemplate(name, desc, steps, vars);
              setShowCreateTemplate(false);
            }}
            onCancel={() => setShowCreateTemplate(false)}
          />
        )}

        {/* Instantiate form */}
        {instantiateTarget && (
          <InstantiateForm
            template={instantiateTarget}
            onSubmit={async (vars) => {
              await instantiate(instantiateTarget.template_id, null, vars);
              setInstantiateTarget(null);
            }}
            onCancel={() => setInstantiateTarget(null)}
          />
        )}

        {tab === "templates" && (
          <div className="space-y-3">
            {templates.length === 0 && !showCreateTemplate && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-town-surface/50 border border-town-border/50 flex items-center justify-center mx-auto mb-4">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    className="text-town-text-faint"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4M12 19v4" />
                  </svg>
                </div>
                <p className="text-sm text-town-text-muted">
                  No workflow templates yet
                </p>
                <p className="text-xs text-town-text-faint mt-1">
                  Create a template (Formula) to define reusable step sequences
                </p>
              </div>
            )}
            {templates.map((t) => (
              <div
                key={t.template_id}
                className="glass-card p-4 flex items-center justify-between group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold">{t.name}</h3>
                    <span className="badge">{t.steps.length} steps</span>
                    {t.variables.length > 0 && (
                      <span className="text-[10px] text-town-text-faint">
                        vars: {t.variables.join(", ")}
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-xs text-town-text-muted mt-1 truncate">
                      {t.description}
                    </p>
                  )}
                  <div className="flex gap-1.5 mt-1.5">
                    {t.steps.map((s) => (
                      <span
                        key={s.step_id}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-town-surface border border-town-border/30 text-town-text-muted"
                      >
                        {s.title || s.step_id}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => setInstantiateTarget(t)}
                    className="btn-success !py-1 !px-3 !text-xs"
                  >
                    Instantiate
                  </button>
                  {confirmDeleteTemplateId === t.template_id ? (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <button
                        onClick={async () => {
                          await removeTemplate(t.template_id);
                          setConfirmDeleteTemplateId(null);
                        }}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-town-danger/15 text-town-danger"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteTemplateId(null)}
                        className="px-1.5 py-0.5 text-[10px] text-town-text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteTemplateId(t.template_id)}
                      className="btn-base !py-1 !px-2 !text-[10px] text-town-danger"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "instances" && (
          <div className="space-y-4">
            {instances.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-town-surface/50 border border-town-border/50 flex items-center justify-center mx-auto mb-4">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    className="text-town-text-faint"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p className="text-sm text-town-text-muted">
                  No workflow instances
                </p>
                <p className="text-xs text-town-text-faint mt-1">
                  Instantiate a template to create a workflow (Molecule)
                </p>
              </div>
            )}
            {instances.map((inst) => {
              const tpl =
                templates.find((t) => t.template_id === inst.template_id) ??
                null;

              const runStepWithWorker = async (
                instanceSnapshot: WorkflowInstance,
                step: WorkflowStep,
              ) => {
                setRunError(null);
                const runKey = `${instanceSnapshot.instance_id}:${step.step_id}`;
                setLaunchingRunKey(runKey);
                const targetCrew = selectCrewForStep(step, crews);
                if (!targetCrew) {
                  setLaunchingRunKey(null);
                  throw new Error(
                    "No active crew available. Create a crew before starting workflow steps.",
                  );
                }

                const command = resolveStepCommand(
                  step.command_template,
                  instanceSnapshot.variables_resolved ?? {},
                );
                const prompt = command.trim() || step.title || step.step_id;
                const agentType =
                  (step.agent_type || "codex").trim() || "codex";
                const runPromptOnSpawn =
                  agentType.toLowerCase() === "codex";
                let phase: "spawn" | "ready" | "send" | "advance" = "spawn";

                try {
                  // Reuse an existing running worker on the same crew+agent when possible
                  // to avoid spawning duplicate terminals for each workflow step.
                  const workers = await listWorkers(rigId);
                  const existing = runPromptOnSpawn
                    ? undefined
                    : workers.find(
                        (w) =>
                          w.status === "running" &&
                          w.crew_id === targetCrew.id &&
                          w.agent_type === agentType,
                      );

                  let workerId: string;
                  if (existing) {
                    workerId = existing.id;
                  } else {
                    const worker = await spawnWorker(
                      targetCrew.id,
                      agentType,
                      runPromptOnSpawn ? prompt : "",
                      { skipPriming: true },
                    );
                    workerId = worker.id;

                    if (!runPromptOnSpawn) {
                      phase = "ready";
                      const ready = await waitForWorkerReady(workerId);
                      if (!ready) {
                        setRunError(
                          "Worker startup check timed out. Sending prompt anyway.",
                        );
                      }
                    }
                  }

                  if (!runPromptOnSpawn) {
                    phase = "send";
                    await writeLineToWorker(workerId, prompt);
                  }

                  phase = "advance";
                  await advance(
                    instanceSnapshot.instance_id,
                    step.step_id,
                    "running",
                    workerId,
                  );
                } catch (err) {
                  const message = String(err);
                  if (phase === "spawn") {
                    setRunError(`Spawn failed: ${message}`);
                  } else if (phase === "ready") {
                    setRunError(`Worker readiness check failed: ${message}`);
                  } else if (phase === "send") {
                    setRunError(`Failed to send prompt: ${message}`);
                  } else {
                    setRunError(`Failed to mark step running: ${message}`);
                  }
                } finally {
                  setLaunchingRunKey((current) =>
                    current === runKey ? null : current,
                  );
                }
              };

              return (
                <InstanceView
                  key={inst.instance_id}
                  instance={inst}
                  template={tpl}
                  launchingRunKey={launchingRunKey}
                  onAdvance={async (stepId, status) => {
                    await advance(inst.instance_id, stepId, status);
                  }}
                  onRunStep={async (step) => {
                    try {
                      await runStepWithWorker(inst, step);
                    } catch (e) {
                      setRunError(String(e));
                    }
                  }}
                  onStart={async () => {
                    try {
                      const started = await start(inst.instance_id);
                      const firstReady = getFirstRunnableStep(started, tpl);
                      if (firstReady) {
                        await runStepWithWorker(started, firstReady);
                      }
                    } catch (e) {
                      setRunError(String(e));
                    }
                  }}
                  onCancel={async () => {
                    await cancel(inst.instance_id);
                  }}
                  onDelete={async () => {
                    try {
                      setDeletingInstanceId(inst.instance_id);
                      await removeInstance(inst.instance_id);
                      setConfirmDeleteInstanceId((current) =>
                        current === inst.instance_id ? null : current,
                      );
                    } catch (e) {
                      setRunError(String(e));
                    } finally {
                      setDeletingInstanceId((current) =>
                        current === inst.instance_id ? null : current,
                      );
                    }
                  }}
                  isDeleting={deletingInstanceId === inst.instance_id}
                  isConfirmingDelete={
                    confirmDeleteInstanceId === inst.instance_id
                  }
                  onAskDelete={() => setConfirmDeleteInstanceId(inst.instance_id)}
                  onCancelDelete={() => setConfirmDeleteInstanceId(null)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
