import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useWorkers } from "../hooks/useWorkers";
import { useCrews } from "../hooks/useCrews";
import { LogEntry } from "../lib/tauri";
import LogViewer from "./LogViewer";

interface TerminalTabsProps {
  rigId: string;
}

export default function TerminalTabs({ rigId }: TerminalTabsProps) {
  const { workers, loading, spawn, stop, getLogs } = useWorkers(rigId || null);
  const { crews } = useCrews(rigId || null);

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [workerLogs, setWorkerLogs] = useState<Map<string, LogEntry[]>>(new Map());
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map());

  // Spawn form state
  const [showSpawn, setShowSpawn] = useState(false);
  const [crewId, setCrewId] = useState("");
  const [agentType, setAgentType] = useState("claude");
  const [prompt, setPrompt] = useState("");
  const [spawning, setSpawning] = useState(false);

  // Auto-select first worker tab if none selected
  useEffect(() => {
    if (!activeTab && workers.length > 0) {
      setActiveTab(workers[0].id);
    }
  }, [activeTab, workers]);

  // Load existing logs for all workers on mount / when workers change
  useEffect(() => {
    workers.forEach((w) => {
      if (!workerLogs.has(w.id)) {
        getLogs(w.id).then((logs) => {
          setWorkerLogs((prev) => {
            const next = new Map(prev);
            next.set(w.id, logs);
            return next;
          });
        });
      }
    });
  }, [workers, getLogs, workerLogs]);

  // Listen for live log events — append to correct worker's log buffer
  useEffect(() => {
    const unlisten = listen<[string, LogEntry]>("worker-log", (event) => {
      const [workerId, entry] = event.payload;
      setWorkerLogs((prev) => {
        const next = new Map(prev);
        const existing = next.get(workerId) ?? [];
        next.set(workerId, [...existing, entry]);
        return next;
      });
      // Increment unread count if this tab is not active
      setActiveTab((current) => {
        if (current !== workerId) {
          setUnreadMap((prev) => {
            const next = new Map(prev);
            next.set(workerId, (prev.get(workerId) ?? 0) + 1);
            return next;
          });
        }
        return current;
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Clear unread when switching tabs
  const selectTab = useCallback((id: string) => {
    setActiveTab(id);
    setUnreadMap((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Set default crewId when crews load
  useEffect(() => {
    if (crews.length > 0 && !crewId) {
      setCrewId(crews[0].id);
    }
  }, [crews, crewId]);

  const handleSpawn = async () => {
    if (!crewId) return;
    setSpawning(true);
    try {
      const worker = await spawn(crewId, agentType, prompt);
      if (worker) {
        setActiveTab(worker.id);
      }
      setShowSpawn(false);
      setPrompt("");
    } catch {
    } finally {
      setSpawning(false);
    }
  };

  const activeWorker = workers.find((w) => w.id === activeTab);
  const activeLogs = activeTab ? workerLogs.get(activeTab) ?? [] : [];

  if (!rigId) {
    return (
      <div className="flex items-center justify-center h-full text-town-text-muted">
        <p className="text-sm">Select a rig first to manage workers.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-town-text-muted">Loading workers...</div>;
  }

  const statusDot = (status: string) => {
    switch (status) {
      case "running":
        return <span className="inline-block w-2 h-2 rounded-full bg-town-success" />;
      case "failed":
        return <span className="inline-block w-2 h-2 rounded-full bg-town-danger" />;
      default:
        return <span className="inline-block w-2 h-2 rounded-full bg-town-text-muted/40" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-town-border shrink-0">
        <h1 className="text-lg font-bold">Workers</h1>
        <button
          onClick={() => setShowSpawn(!showSpawn)}
          className="px-3 py-1.5 bg-town-accent hover:bg-town-accent-hover rounded text-sm font-medium transition-colors"
        >
          + Spawn
        </button>
      </div>

      {/* Spawn form */}
      {showSpawn && (
        <div className="px-6 py-3 border-b border-town-border bg-town-surface/50 shrink-0">
          <div className="space-y-3 max-w-2xl">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-town-text-muted mb-1">Crew</label>
                <select
                  value={crewId}
                  onChange={(e) => setCrewId(e.target.value)}
                  className="w-full bg-town-bg border border-town-border rounded px-3 py-1.5 text-sm"
                >
                  {crews.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-town-text-muted mb-1">Agent</label>
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value)}
                  className="w-full bg-town-bg border border-town-border rounded px-3 py-1.5 text-sm"
                >
                  <option value="claude">Claude Code</option>
                  <option value="custom">Custom Command</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-town-text-muted mb-1">Initial Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm resize-none"
                placeholder="What should the agent do?"
              />
            </div>
            <button
              onClick={handleSpawn}
              disabled={!crewId || crews.length === 0 || spawning}
              className="px-4 py-1.5 bg-town-success hover:bg-town-success/80 disabled:opacity-50 rounded text-sm font-medium transition-colors"
            >
              {spawning ? "Spawning..." : "Spawn"}
            </button>
          </div>
        </div>
      )}

      {/* Tab bar */}
      {workers.length > 0 && (
        <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-town-border bg-town-surface/30 overflow-x-auto shrink-0">
          {workers.map((w) => {
            const unread = unreadMap.get(w.id) ?? 0;
            const isActive = w.id === activeTab;
            return (
              <button
                key={w.id}
                onClick={() => selectTab(w.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-town-accent/15 text-town-accent"
                    : "text-town-text-muted hover:text-town-text hover:bg-town-surface"
                }`}
              >
                {statusDot(w.status)}
                <span>{w.agent_type}</span>
                {w.pid && <span className="text-town-text-muted/60">PID {w.pid}</span>}
                {unread > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-town-accent/20 text-town-accent text-[10px] leading-none">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {workers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-town-text-muted">
            <p className="text-sm">No workers. Click "+ Spawn" to start one.</p>
          </div>
        ) : !activeWorker ? (
          <div className="flex items-center justify-center h-full text-town-text-muted">
            <p className="text-sm">Select a worker tab above.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
              <LogViewer
                logs={activeLogs}
                title={`${activeWorker.agent_type} — ${activeWorker.status}`}
                className="h-full"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-town-border bg-town-surface/30 shrink-0">
              <span className="text-xs text-town-text-muted mr-auto">
                {activeLogs.length} line{activeLogs.length !== 1 ? "s" : ""}
              </span>
              {activeWorker.status === "running" && (
                <button
                  onClick={() => stop(activeWorker.id)}
                  className="px-3 py-1 rounded text-xs font-medium bg-town-danger/10 text-town-danger hover:bg-town-danger/20 transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
