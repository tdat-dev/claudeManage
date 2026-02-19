import { useState, useEffect } from "react";
import { RunInfo, LogEntry, listRuns, getRunLogs } from "../lib/tauri";
import LogViewer from "./LogViewer";

interface RunHistoryProps {
  rigId: string | null;
}

export default function RunHistory({ rigId }: RunHistoryProps) {
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<RunInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!rigId) {
      setRuns([]);
      return;
    }
    setLoading(true);
    listRuns(rigId)
      .then((data) => {
        setRuns(data.sort((a, b) => b.started_at.localeCompare(a.started_at)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rigId]);

  useEffect(() => {
    if (selectedRun) {
      getRunLogs(selectedRun.id)
        .then(setLogs)
        .catch(() => setLogs([]));
    } else {
      setLogs([]);
    }
  }, [selectedRun]);

  if (!rigId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-town-surface flex items-center justify-center mx-auto mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-town-text-faint"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-sm text-town-text-muted">
            Select a rig to view run history
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
          <span className="text-sm text-town-text-muted">Loading runs...</span>
        </div>
      </div>
    );
  }

  const statusConfig: Record<
    string,
    { color: string; bg: string; dot: string }
  > = {
    running: {
      color: "text-town-accent",
      bg: "bg-town-accent/8 border-town-accent/15",
      dot: "bg-town-accent animate-pulse-slow",
    },
    completed: {
      color: "text-town-success",
      bg: "bg-town-success-soft border-town-success/15",
      dot: "bg-town-success",
    },
    failed: {
      color: "text-town-danger",
      bg: "bg-town-danger-soft border-town-danger/15",
      dot: "bg-town-danger",
    },
    cancelled: {
      color: "text-town-text-muted",
      bg: "bg-town-text-muted/8 border-town-text-muted/15",
      dot: "bg-town-text-muted/50",
    },
  };

  return (
    <div className="p-8 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-accent flex items-center justify-center shadow-glow-sm">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Run History</h1>
          <p className="text-sm text-town-text-muted mt-0.5">
            {runs.length} run{runs.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {selectedRun ? (
        <div className="animate-slide-up">
          <button
            onClick={() => setSelectedRun(null)}
            className="btn-ghost !px-0 !py-1 mb-4 inline-flex items-center gap-1.5 text-town-accent hover:text-town-accent-hover"
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to runs
          </button>

          <div className="glass-card p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Run Details</h2>
              {statusConfig[selectedRun.status] && (
                <span
                  className={`badge border ${statusConfig[selectedRun.status].bg}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${statusConfig[selectedRun.status].dot}`}
                  />
                  <span className={statusConfig[selectedRun.status].color}>
                    {selectedRun.status}
                  </span>
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-town-bg/50 rounded-lg p-3.5">
                <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1">
                  Agent
                </div>
                <div className="text-sm font-semibold">
                  {selectedRun.agent_type}
                </div>
              </div>
              <div className="bg-town-bg/50 rounded-lg p-3.5">
                <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1">
                  Template
                </div>
                <div className="text-sm font-semibold">
                  {selectedRun.template_name}
                </div>
              </div>
              <div className="bg-town-bg/50 rounded-lg p-3.5">
                <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1">
                  Started
                </div>
                <div className="text-sm">
                  {new Date(selectedRun.started_at).toLocaleString()}
                </div>
              </div>
              {selectedRun.finished_at && (
                <div className="bg-town-bg/50 rounded-lg p-3.5">
                  <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1">
                    Duration
                  </div>
                  <div className="text-sm">
                    {Math.round(
                      (new Date(selectedRun.finished_at).getTime() -
                        new Date(selectedRun.started_at).getTime()) /
                        1000,
                    )}
                    s
                  </div>
                </div>
              )}
              {selectedRun.exit_code !== null && (
                <div className="bg-town-bg/50 rounded-lg p-3.5">
                  <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1">
                    Exit Code
                  </div>
                  <div
                    className={`text-sm font-mono font-bold ${selectedRun.exit_code === 0 ? "text-town-success" : "text-town-danger"}`}
                  >
                    {selectedRun.exit_code}
                  </div>
                </div>
              )}
              {selectedRun.diff_stats && (
                <div className="bg-town-bg/50 rounded-lg p-3.5">
                  <div className="text-[11px] text-town-text-faint font-medium uppercase tracking-wider mb-1">
                    Git Diff
                  </div>
                  <div className="text-sm font-mono">
                    {selectedRun.diff_stats}
                  </div>
                </div>
              )}
            </div>

            {/* Rendered prompt */}
            <div className="mt-4">
              <h3 className="section-title mb-2">Rendered Prompt</h3>
              <pre className="bg-town-bg/80 border border-town-border/40 rounded-lg p-4 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto text-town-text-muted leading-relaxed">
                {selectedRun.rendered_prompt}
              </pre>
            </div>
          </div>

          <LogViewer
            logs={logs}
            title={`Run ${selectedRun.id.slice(0, 8)}...`}
          />
        </div>
      ) : (
        <>
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-town-surface flex items-center justify-center mb-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-town-text-faint"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className="text-sm text-town-text-muted">No runs yet</p>
              <p className="text-xs text-town-text-faint mt-1">
                Execute a task to see run history
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {runs.map((run) => {
                const sc = statusConfig[run.status] || statusConfig.cancelled;
                return (
                  <div
                    key={run.id}
                    onClick={() => setSelectedRun(run)}
                    className="glass-card p-4 cursor-pointer hover:border-town-border-light/60 hover:shadow-card-hover transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
                        <div>
                          <span className="text-sm font-semibold">
                            {run.agent_type}
                          </span>
                          <span className="text-xs text-town-text-faint ml-2 font-medium">
                            {run.template_name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge border ${sc.bg}`}>
                          <span className={sc.color}>{run.status}</span>
                        </span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-town-text-faint group-hover:text-town-text-muted transition-colors"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-xs text-town-text-faint mt-2 ml-[22px]">
                      {new Date(run.started_at).toLocaleString()}
                      {run.finished_at && (
                        <span className="ml-2 text-town-text-muted">
                          ·{" "}
                          {Math.round(
                            (new Date(run.finished_at).getTime() -
                              new Date(run.started_at).getTime()) /
                              1000,
                          )}
                          s
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
