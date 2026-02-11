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
      getRunLogs(selectedRun.id).then(setLogs).catch(() => setLogs([]));
    } else {
      setLogs([]);
    }
  }, [selectedRun]);

  if (!rigId) {
    return (
      <div className="p-6 text-town-text-muted text-center">
        Select a rig to view run history.
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-town-text-muted">Loading runs...</div>;
  }

  const statusColors: Record<string, string> = {
    running: "bg-town-accent/10 text-town-accent",
    completed: "bg-town-success/10 text-town-success",
    failed: "bg-town-danger/10 text-town-danger",
    cancelled: "bg-town-text-muted/10 text-town-text-muted",
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Run History</h1>

      {selectedRun ? (
        <div>
          <button
            onClick={() => setSelectedRun(null)}
            className="text-sm text-town-accent hover:text-town-accent-hover mb-4 transition-colors"
          >
            &larr; Back to runs
          </button>

          <div className="bg-town-surface border border-town-border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Run Details</h2>
              <span className={`text-xs px-2 py-0.5 rounded ${statusColors[selectedRun.status] || ""}`}>
                {selectedRun.status}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="text-town-text-muted w-28">Agent</span>
                <span>{selectedRun.agent_type}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-town-text-muted w-28">Template</span>
                <span>{selectedRun.template_name}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-town-text-muted w-28">Started</span>
                <span>{new Date(selectedRun.started_at).toLocaleString()}</span>
              </div>
              {selectedRun.finished_at && (
                <div className="flex gap-3">
                  <span className="text-town-text-muted w-28">Finished</span>
                  <span>{new Date(selectedRun.finished_at).toLocaleString()}</span>
                </div>
              )}
              {selectedRun.exit_code !== null && (
                <div className="flex gap-3">
                  <span className="text-town-text-muted w-28">Exit Code</span>
                  <span className={selectedRun.exit_code === 0 ? "text-town-success" : "text-town-danger"}>
                    {selectedRun.exit_code}
                  </span>
                </div>
              )}
              {selectedRun.diff_stats && (
                <div className="flex gap-3">
                  <span className="text-town-text-muted w-28">Git Diff</span>
                  <span className="font-mono text-xs">{selectedRun.diff_stats}</span>
                </div>
              )}
            </div>

            {/* Rendered prompt */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-town-text-muted uppercase tracking-wider mb-2">
                Rendered Prompt
              </h3>
              <pre className="bg-town-bg border border-town-border rounded p-3 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                {selectedRun.rendered_prompt}
              </pre>
            </div>
          </div>

          <LogViewer logs={logs} title={`Run ${selectedRun.id.slice(0, 8)}...`} />
        </div>
      ) : (
        <>
          {runs.length === 0 ? (
            <div className="text-center py-12 text-town-text-muted">
              <p className="text-sm">No runs yet. Execute a task to see run history.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className="bg-town-surface border border-town-border rounded-lg p-3 cursor-pointer hover:border-town-text-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{run.agent_type}</span>
                      <span className="text-xs text-town-text-muted ml-2">{run.template_name}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[run.status] || ""}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-town-text-muted mt-1">
                    {new Date(run.started_at).toLocaleString()}
                    {run.finished_at && (
                      <span className="ml-2">
                        ({Math.round(
                          (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000
                        )}s)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
