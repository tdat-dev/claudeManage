import { useEffect, useState } from "react";
import { useHealth } from "../hooks/useHealth";
import FailureCenter from "./FailureCenter";
import {
  DoctorReport,
  RolesStatus,
  WitnessReport,
  deaconPatrol,
  getRolesStatus,
  mayorPlanObjective,
  setRolesStatus,
  townDoctor,
  townDown,
  townFix,
  townInstall,
  townShutdown,
  townStatus,
  townUp,
  witnessReport,
} from "../lib/tauri";

interface HealthDashboardProps {
  rigId: string;
}

function MetricCard({
  label,
  value,
  color = "text-town-text",
  icon,
}: {
  label: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      {icon && (
        <div className="w-9 h-9 rounded-lg bg-town-surface flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-[10px] text-town-text-muted uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function HealthDashboard({ rigId }: HealthDashboardProps) {
  const { metrics, loading, escalate, refresh } = useHealth(rigId || null);
  const [escalating, setEscalating] = useState(false);
  const [threshold, setThreshold] = useState(30);
  const [town, setTown] = useState<Awaited<ReturnType<typeof townStatus>> | null>(null);
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [roles, setRoles] = useState<RolesStatus | null>(null);
  const [witness, setWitness] = useState<WitnessReport | null>(null);
  const [fixSummary, setFixSummary] = useState<string | null>(null);
  const [installSummary, setInstallSummary] = useState<string | null>(null);
  const [mayorObjective, setMayorObjective] = useState("");
  const [opsBusy, setOpsBusy] = useState(false);

  const refreshOps = async () => {
    try {
      const [status, roleState] = await Promise.all([
        townStatus(),
        getRolesStatus(),
      ]);
      setTown(status);
      setRoles(roleState);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshOps();
  }, [rigId]);

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
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-town-accent/20 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-green-400"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight">Health Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await refresh();
              await refreshOps();
            }}
            className="btn-base !py-1.5 !px-3 !text-xs"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
        {loading && !metrics && (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
          </div>
        )}

        {metrics && (
          <>
            {/* Task Metrics */}
            <div>
              <h2 className="text-sm font-semibold mb-3 text-town-text-muted uppercase tracking-wider">
                Task Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <MetricCard
                  label="Total"
                  value={metrics.total_tasks}
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-town-text-muted"
                    >
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                  }
                />
                <MetricCard
                  label="Todo"
                  value={metrics.todo}
                  color="text-town-text-muted"
                />
                <MetricCard
                  label="In Progress"
                  value={metrics.in_progress}
                  color="text-town-accent"
                />
                <MetricCard
                  label="Blocked"
                  value={metrics.blocked}
                  color="text-town-danger"
                />
                <MetricCard
                  label="Escalated"
                  value={metrics.escalated}
                  color="text-town-warning"
                />
                <MetricCard
                  label="Done"
                  value={metrics.done}
                  color="text-town-success"
                />
                <MetricCard
                  label="Cancelled"
                  value={metrics.cancelled}
                  color="text-town-text-faint"
                />
              </div>
            </div>

            {/* Worker & Hook Metrics */}
            <div>
              <h2 className="text-sm font-semibold mb-3 text-town-text-muted uppercase tracking-wider">
                Workers & Hooks
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <MetricCard
                  label="Workers Running"
                  value={metrics.workers_running}
                  color="text-town-success"
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-town-success"
                    >
                      <rect x="2" y="3" width="20" height="18" rx="3" />
                      <path d="M7 9l3 3-3 3" />
                    </svg>
                  }
                />
                <MetricCard
                  label="Workers Failed"
                  value={metrics.workers_failed}
                  color="text-town-danger"
                />
                <MetricCard
                  label="Workers Total"
                  value={metrics.workers_total}
                />
                <MetricCard
                  label="Hooks Idle"
                  value={metrics.hooks_idle}
                  color="text-town-text-muted"
                />
                <MetricCard
                  label="Hooks Assigned"
                  value={metrics.hooks_assigned}
                  color="text-town-accent"
                />
                <MetricCard
                  label="Handoffs Pending"
                  value={metrics.handoffs_pending}
                  color="text-town-warning"
                />
              </div>
            </div>

            {/* Stuck Tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider">
                  Stuck Tasks
                  {metrics.stuck_tasks.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-town-danger/20 text-town-danger text-[10px] font-bold">
                      {metrics.stuck_tasks.length}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-town-text-faint">
                    Threshold (min):
                  </label>
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="input-base !w-16 !text-xs !py-1"
                    min={1}
                  />
                  <button
                    onClick={async () => {
                      setEscalating(true);
                      try {
                        const result = await escalate(threshold);
                        if (result.length > 0) {
                          alert(`Escalated ${result.length} stuck task(s)`);
                        } else {
                          alert("No stuck tasks to escalate");
                        }
                      } finally {
                        setEscalating(false);
                      }
                    }}
                    disabled={escalating}
                    className="btn-base !py-1 !px-3 !text-xs text-town-warning"
                  >
                    {escalating ? "Escalating..." : "⚡ Auto-Escalate"}
                  </button>
                </div>
              </div>

              {metrics.stuck_tasks.length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <span className="text-2xl">✅</span>
                  <p className="text-sm text-town-text-muted mt-2">
                    All clear — no stuck tasks detected
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {metrics.stuck_tasks.map((st) => (
                    <div
                      key={st.task_id}
                      className="glass-card p-3 flex items-center justify-between border-l-2 border-town-danger"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold truncate">
                          {st.title}
                        </h4>
                        <p className="text-[10px] text-town-text-faint font-mono">
                          ID: {st.task_id.slice(0, 8)}...
                          {st.assigned_worker_id && (
                            <>
                              {" "}
                              · Worker: {st.assigned_worker_id.slice(0, 8)}...
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-town-danger">
                          {st.minutes_stuck}m stuck
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Operations (Gas Town style) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider">
                  Operations
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setOpsBusy(true);
                      try {
                        const report = await townInstall();
                        setInstallSummary(
                          `${report.workflow_templates_existing} workflows, ${report.prompt_templates_builtin} prompts`,
                        );
                      } finally {
                        setOpsBusy(false);
                      }
                    }}
                    disabled={opsBusy}
                    className="btn-base !py-1 !px-3 !text-xs"
                  >
                    Install
                  </button>
                  <button
                    onClick={async () => {
                      setOpsBusy(true);
                      try {
                        await townUp(30, true);
                        await refreshOps();
                      } finally {
                        setOpsBusy(false);
                      }
                    }}
                    disabled={opsBusy}
                    className="btn-base !py-1 !px-3 !text-xs"
                  >
                    Town Up
                  </button>
                  <button
                    onClick={async () => {
                      setOpsBusy(true);
                      try {
                        await townDown();
                        await refreshOps();
                      } finally {
                        setOpsBusy(false);
                      }
                    }}
                    disabled={opsBusy}
                    className="btn-base !py-1 !px-3 !text-xs"
                  >
                    Town Down
                  </button>
                  <button
                    onClick={async () => {
                      setOpsBusy(true);
                      try {
                        await townShutdown();
                        await refreshOps();
                      } finally {
                        setOpsBusy(false);
                      }
                    }}
                    disabled={opsBusy}
                    className="btn-base !py-1 !px-3 !text-xs"
                  >
                    Shutdown
                  </button>
                  <button
                    onClick={async () => {
                      setOpsBusy(true);
                      try {
                        const report = await townDoctor(rigId);
                        setDoctor(report);
                        setFixSummary(null);
                      } finally {
                        setOpsBusy(false);
                      }
                    }}
                    disabled={opsBusy}
                    className="btn-base !py-1 !px-3 !text-xs"
                  >
                    Doctor
                  </button>
                  <button
                    onClick={async () => {
                      setOpsBusy(true);
                      try {
                        const result = await townFix(rigId, 7);
                        setFixSummary(
                          `changed=${result.reconciled_items_changed}, removed workers=${result.compact_removed_workers}, runs=${result.compact_removed_runs}, crews=${result.compact_removed_crews}`,
                        );
                        await refreshOps();
                      } finally {
                        setOpsBusy(false);
                      }
                    }}
                    disabled={opsBusy}
                    className="btn-base !py-1 !px-3 !text-xs"
                  >
                    Fix
                  </button>
                  <button
                    onClick={async () => {
                      setOpsBusy(true);
                      try {
                        const patrol = await deaconPatrol(rigId, threshold);
                        setFixSummary(
                          `deacon changed=${patrol.reconciled_items_changed}, escalated=${patrol.escalated_tasks}`,
                        );
                        await refresh();
                        await refreshOps();
                      } finally {
                        setOpsBusy(false);
                      }
                    }}
                    disabled={opsBusy}
                    className="btn-base !py-1 !px-3 !text-xs"
                  >
                    Deacon Patrol
                  </button>
                  <button
                    onClick={async () => {
                      setOpsBusy(true);
                      try {
                        const rep = await witnessReport(rigId);
                        setWitness(rep);
                      } finally {
                        setOpsBusy(false);
                      }
                    }}
                    disabled={opsBusy}
                    className="btn-base !py-1 !px-3 !text-xs"
                  >
                    Witness
                  </button>
                </div>
              </div>

              <div className="glass-card p-3 text-xs space-y-2">
                <div className="flex flex-wrap gap-4">
                  <span>
                    Supervisor:{" "}
                    <strong className={town?.supervisor_running ? "text-town-success" : "text-town-text-faint"}>
                      {town?.supervisor_running ? "running" : "stopped"}
                    </strong>
                  </span>
                  <span>
                    AI Inbox:{" "}
                    <strong className={town?.ai_inbox_running ? "text-town-success" : "text-town-text-faint"}>
                      {town?.ai_inbox_running ? "running" : "stopped"}
                    </strong>
                  </span>
                  <span>
                    Hooks Open: <strong>{town?.hooks_open ?? 0}</strong>
                  </span>
                  <span>
                    Workers Failed: <strong>{town?.workers_failed ?? 0}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={roles?.mayor_enabled ?? false}
                      onChange={async (e) => {
                        const next = await setRolesStatus(
                          e.target.checked,
                          roles?.deacon_enabled,
                          roles?.witness_enabled,
                        );
                        setRoles(next);
                        await refreshOps();
                      }}
                    />
                    Mayor
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={roles?.deacon_enabled ?? false}
                      onChange={async (e) => {
                        const next = await setRolesStatus(
                          roles?.mayor_enabled,
                          e.target.checked,
                          roles?.witness_enabled,
                        );
                        setRoles(next);
                        await refreshOps();
                      }}
                    />
                    Deacon
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={roles?.witness_enabled ?? false}
                      onChange={async (e) => {
                        const next = await setRolesStatus(
                          roles?.mayor_enabled,
                          roles?.deacon_enabled,
                          e.target.checked,
                        );
                        setRoles(next);
                        await refreshOps();
                      }}
                    />
                    Witness
                  </label>
                </div>

                <div className="pt-2 border-t border-town-border/20">
                  <div className="text-[11px] font-semibold mb-1">Mayor quick plan</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mayorObjective}
                      onChange={(e) => setMayorObjective(e.target.value)}
                      className="input-base !text-xs !py-1 flex-1"
                      placeholder="Objective: e.g. stabilize auth flow and release"
                    />
                    <button
                      onClick={async () => {
                        if (!mayorObjective.trim()) return;
                        setOpsBusy(true);
                        try {
                          const plan = await mayorPlanObjective(
                            rigId,
                            mayorObjective.trim(),
                            undefined,
                            true,
                            "high",
                            ["mayor", "auto-plan"],
                          );
                          setFixSummary(
                            `mayor created ${plan.created_task_ids.length} task(s), convoy=${plan.convoy_id ?? "none"}`,
                          );
                          setMayorObjective("");
                          await refresh();
                        } finally {
                          setOpsBusy(false);
                        }
                      }}
                      disabled={opsBusy}
                      className="btn-base !py-1 !px-3 !text-xs"
                    >
                      Plan
                    </button>
                  </div>
                </div>

                {doctor && (
                  <div className="pt-2 border-t border-town-border/20">
                    <div className="text-[11px] font-semibold mb-1">
                      Doctor: {doctor.healthy ? "Healthy" : `${doctor.issues.length} issue(s)`}
                    </div>
                    {doctor.issues.length === 0 ? (
                      <div className="text-town-success text-[11px]">No issues found.</div>
                    ) : (
                      <div className="space-y-1">
                        {doctor.issues.map((issue) => (
                          <div key={`${issue.code}-${issue.message}`} className="text-[11px]">
                            <span className="font-mono text-town-warning">{issue.code}</span>:{" "}
                            {issue.message}{" "}
                            <span className="text-town-text-faint">({issue.hint})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {fixSummary && (
                  <div className="pt-2 border-t border-town-border/20 text-[11px] text-town-success">
                    Fix result: {fixSummary}
                  </div>
                )}
                {installSummary && (
                  <div className="pt-2 border-t border-town-border/20 text-[11px] text-town-success">
                    Install result: {installSummary}
                  </div>
                )}
                {witness && (
                  <div className="pt-2 border-t border-town-border/20">
                    <div className="text-[11px] font-semibold mb-1">
                      Witness: {witness.alerts.length} alert(s)
                    </div>
                    {witness.alerts.length === 0 ? (
                      <div className="text-[11px] text-town-success">No alerts.</div>
                    ) : (
                      <div className="space-y-1">
                        {witness.alerts.map((a) => (
                          <div key={`${a.code}-${a.message}`} className="text-[11px]">
                            <span className="font-mono text-town-warning">{a.code}</span>: {a.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <FailureCenter rigId={rigId} />
          </>
        )}
      </div>
    </div>
  );
}
