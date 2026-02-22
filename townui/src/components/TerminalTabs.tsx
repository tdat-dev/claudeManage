import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useWorkers } from "../hooks/useWorkers";
import { useCrews } from "../hooks/useCrews";
import { LogEntry } from "../lib/tauri";
import { useHooks } from "../hooks/useHooks";
import { useHandoffs } from "../hooks/useHandoffs";
import { useTasks } from "../hooks/useTasks";
import { useSettings } from "../hooks/useSettings";
import { useActors } from "../hooks/useActors";
import { AppLanguage, t } from "../lib/i18n";
import XtermTerminal from "./XtermTerminal";
import { SkeletonGroup, BlockSkeleton } from "./Skeleton";

interface TerminalTabsProps {
  rigId: string;
}

const statusConfig: Record<
  string,
  { dot: string; bg: string; text: string; label: string }
> = {
  running: {
    dot: "bg-town-success",
    bg: "bg-town-success/10",
    text: "text-town-success",
    label: "Running",
  },
  failed: {
    dot: "bg-town-danger",
    bg: "bg-town-danger/10",
    text: "text-town-danger",
    label: "Failed",
  },
  completed: {
    dot: "bg-town-accent",
    bg: "bg-town-accent/10",
    text: "text-town-accent",
    label: "Completed",
  },
  stopped: {
    dot: "bg-town-warning",
    bg: "bg-town-warning/10",
    text: "text-town-warning",
    label: "Stopped",
  },
};
const defaultStatus = {
  dot: "bg-town-text-muted/40",
  bg: "bg-town-text-muted/5",
  text: "text-town-text-muted",
  label: "Unknown",
};

export default function TerminalTabs({ rigId }: TerminalTabsProps) {
  const { workers, loading, spawn, stop, remove, getLogs } = useWorkers(
    rigId || null,
  );
  const { crews } = useCrews(rigId || null);
  const { hooks, done } = useHooks(rigId || null);
  const { addHandoff } = useHandoffs(rigId || null);
  const { tasks } = useTasks(rigId || null);
  const { settings } = useSettings();
  const { actors } = useActors(rigId || null);
  const language: AppLanguage = settings?.language ?? "en";

  // Helper: look up actor name by id
  const actorName = (actorId: string | null) => {
    if (!actorId) return null;
    return actors.find((a) => a.actor_id === actorId)?.name ?? null;
  };

  const [workerLogs, setWorkerLogs] = useState<Map<string, LogEntry[]>>(
    new Map(),
  );

  // Spawn form state
  const [showSpawn, setShowSpawn] = useState(false);
  const [crewId, setCrewId] = useState("");
  const [agentType, setAgentType] = useState("claude");
  const [prompt, setPrompt] = useState("");
  const [spawning, setSpawning] = useState(false);

  // Grid columns
  const [columns, setColumns] = useState(2);

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  // Listen for live log events (keep workerLogs state updated for footer line count)
  useEffect(() => {
    const unlisten = listen<[string, LogEntry]>("worker-log", (event) => {
      const [workerId, entry] = event.payload;
      setWorkerLogs((prev) => {
        const next = new Map(prev);
        const existing = next.get(workerId) ?? [];
        next.set(workerId, [...existing, entry]);
        return next;
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Set default crewId when crews load
  useEffect(() => {
    if (crews.length > 0 && !crewId) {
      setCrewId(crews[0].id);
    }
  }, [crews, crewId]);

  useEffect(() => {
    if (settings?.default_cli) {
      setAgentType(settings.default_cli);
    }
  }, [settings?.default_cli]);

  const handleSpawn = async () => {
    if (!crewId) return;
    setSpawning(true);
    try {
      await spawn(crewId, agentType, prompt);
      setShowSpawn(false);
      setPrompt("");
    } catch {
    } finally {
      setSpawning(false);
    }
  };

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id);
      setWorkerLogs((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setConfirmDeleteId(null);
    },
    [remove],
  );

  if (!rigId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-town-text-muted gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-town-surface border border-town-border flex items-center justify-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-town-text-faint"
          >
            <rect x="2" y="3" width="20" height="18" rx="3" />
            <path d="M7 9l3 3-3 3" />
            <path d="M13 15h4" />
          </svg>
        </div>
        <p className="text-sm">Select a rig to manage workers</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col p-6 animate-fade-in">
        <BlockSkeleton className="h-10 w-48 mb-6" />
        <div className="flex gap-4 h-full">
          <SkeletonGroup count={2}>
            <div className="flex-1 bg-town-surface/40 rounded-xl border border-town-border/50 p-4">
              <BlockSkeleton className="h-6 w-32 mb-4" />
              <BlockSkeleton className="h-4 w-full mb-2" />
              <BlockSkeleton className="h-4 w-5/6 mb-2" />
              <BlockSkeleton className="h-4 w-4/6" />
            </div>
          </SkeletonGroup>
        </div>
      </div>
    );
  }

  const runningCount = workers.filter((w) => w.status === "running").length;

  const gridCols =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  // Column layout icons
  const colIcons = [
    // 1 col
    <svg key={1} width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="12" height="12" rx="1.5" opacity="0.6" />
    </svg>,
    // 2 cols
    <svg key={2} width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="5" height="12" rx="1.5" opacity="0.6" />
      <rect x="8" y="1" width="5" height="12" rx="1.5" opacity="0.6" />
    </svg>,
    // 3 cols
    <svg key={3} width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0.5" y="1" width="3.5" height="12" rx="1" opacity="0.6" />
      <rect x="5.25" y="1" width="3.5" height="12" rx="1" opacity="0.6" />
      <rect x="10" y="1" width="3.5" height="12" rx="1" opacity="0.6" />
    </svg>,
  ];

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-town-border/60 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-town-accent/20 to-town-secondary/20 flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-town-accent"
              >
                <rect x="2" y="3" width="20" height="18" rx="3" />
                <path d="M7 9l3 3-3 3" />
                <path d="M13 15h4" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight">Workers</h1>
          </div>
          <div className="flex items-center gap-2">
            {runningCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-town-success bg-town-success/10 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-town-success animate-pulse" />
                {runningCount} running
              </span>
            )}
            <span className="badge">{workers.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 border border-town-border/40 rounded-lg px-2 py-1.5 bg-town-surface/50">
            <span className="text-[11px] text-town-text-faint">
              {t(language, "worker_quick_actions")}
            </span>
            <button
              onClick={async () => {
                if (hooks.length === 0) {
                  alert("No hooks available");
                  return;
                }
                const defaultHook = hooks[0].hook_id;
                const hookId = window.prompt(
                  `Hook ID (default ${defaultHook.slice(0, 8)}...)`,
                  defaultHook,
                );
                if (!hookId) return;
                const outcome =
                  window.prompt("Outcome (optional):") || undefined;
                await done(hookId, outcome);
              }}
              className="btn-success !py-1 !px-2 !text-[11px]"
            >
              {t(language, "worker_mark_done")}
            </button>
            <button
              onClick={async () => {
                if (tasks.length === 0) {
                  alert("No tasks available");
                  return;
                }
                const open =
                  tasks.find(
                    (x) => x.status !== "done" && x.status !== "cancelled",
                  ) ?? tasks[0];
                const fromActorId = window.prompt("From actor_id:");
                if (!fromActorId) return;
                const toActorId = window.prompt("To actor_id:");
                if (!toActorId) return;
                const workItemId = window.prompt(
                  `Task ID (default ${open.id.slice(0, 8)}...)`,
                  open.id,
                );
                if (!workItemId) return;
                const contextSummary =
                  window.prompt(
                    "Context summary:",
                    "handoff from worker terminal",
                  ) || "handoff from worker terminal";
                await addHandoff(
                  fromActorId,
                  toActorId,
                  workItemId,
                  contextSummary,
                  [],
                  [],
                );
              }}
              className="btn-base !py-1 !px-2 !text-[11px]"
            >
              {t(language, "worker_create_handoff")}
            </button>
          </div>

          {/* Grid column selector */}
          <div className="flex items-center gap-0.5 bg-town-surface/60 border border-town-border rounded-lg p-0.5">
            {[1, 2, 3].map((n, i) => (
              <button
                key={n}
                onClick={() => setColumns(n)}
                className={`p-1.5 rounded-md transition-all duration-200 ${columns === n
                  ? "bg-town-accent/15 text-town-accent shadow-sm"
                  : "text-town-text-muted hover:text-town-text hover:bg-town-surface-hover"
                  }`}
                title={`${n} column${n > 1 ? "s" : ""}`}
              >
                {colIcons[i]}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSpawn(!showSpawn)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${showSpawn
              ? "bg-town-surface border border-town-border text-town-text-muted"
              : "btn-primary"
              }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              {showSpawn ? (
                <>
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </>
              ) : (
                <>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </>
              )}
            </svg>
            {showSpawn ? "Cancel" : "Spawn Worker"}
          </button>
        </div>
      </div>

      {/* Spawn form */}
      {showSpawn && (
        <div className="px-6 py-4 border-b border-town-border/60 bg-gradient-to-r from-town-surface/80 to-transparent shrink-0 animate-slide-up">
          <div className="space-y-3 max-w-3xl">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-town-text-muted mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Crew
                  </span>
                </label>
                <select
                  value={crewId}
                  onChange={(e) => setCrewId(e.target.value)}
                  className="select-base"
                >
                  {crews.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-town-text-muted mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    Agent
                  </span>
                </label>
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value)}
                  className="select-base"
                >
                  <optgroup label="Major Providers">
                    <option value="claude">Claude Code (Anthropic)</option>
                    <option value="codex">Codex CLI (OpenAI)</option>
                    <option value="chatgpt">ChatGPT CLI (OpenAI)</option>
                    <option value="gemini">Gemini CLI (Google)</option>
                    <option value="copilot">GitHub Copilot CLI</option>
                    <option value="amazon-q">Amazon Q Developer</option>
                  </optgroup>
                  <optgroup label="Open-Source Agents">
                    <option value="aider">Aider</option>
                    <option value="goose">Goose (Block)</option>
                    <option value="openhands">OpenHands</option>
                    <option value="swe-agent">SWE-Agent</option>
                    <option value="mentat">Mentat</option>
                    <option value="gpt-engineer">GPT Engineer</option>
                    <option value="cline">Cline</option>
                    <option value="continue">Continue</option>
                    <option value="tabby">Tabby</option>
                    <option value="roo">Roo Code</option>
                    <option value="sweep">Sweep AI</option>
                    <option value="auto-coder">Auto-Coder</option>
                  </optgroup>
                  <optgroup label="IDE Agents (CLI mode)">
                    <option value="cursor">Cursor</option>
                    <option value="windsurf">Windsurf (Codeium)</option>
                    <option value="trae">Trae (ByteDance)</option>
                    <option value="augment">Augment Code</option>
                    <option value="pear">PearAI</option>
                    <option value="void">Void Editor</option>
                  </optgroup>
                  <optgroup label="Code Assistants">
                    <option value="cody">Cody (Sourcegraph)</option>
                    <option value="tabnine">Tabnine</option>
                    <option value="supermaven">Supermaven</option>
                    <option value="codestory">CodeStory / Aide</option>
                    <option value="double">Double</option>
                  </optgroup>
                  <optgroup label="Cloud Agents">
                    <option value="devin">Devin (Cognition)</option>
                    <option value="replit">Replit Agent</option>
                    <option value="bolt">Bolt.new</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="custom">Custom Command</option>
                  </optgroup>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-town-text-muted mb-1.5">
                <span className="flex items-center gap-1.5">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Initial Prompt
                </span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                className="input-base resize-none"
                placeholder="What should the agent work on?"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSpawn}
                disabled={!crewId || crews.length === 0 || spawning}
                className="btn-success flex items-center gap-2"
              >
                {spawning ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
                {spawning ? "Spawning..." : "Spawn Worker"}
              </button>
              {crews.length === 0 && (
                <span className="text-xs text-town-warning">
                  No crews available — create one first
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid of terminals */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-town-text-muted gap-4">
            <div className="w-20 h-20 rounded-2xl bg-town-surface/50 border border-town-border/50 flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                className="text-town-text-faint"
              >
                <rect x="2" y="3" width="20" height="18" rx="3" />
                <path d="M7 9l3 3-3 3" />
                <path d="M13 15h4" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-town-text-muted">
                No active workers
              </p>
              <p className="text-xs text-town-text-faint">
                Click "Spawn Worker" to start an agent
              </p>
            </div>
          </div>
        ) : (
          <div className={`grid ${gridCols} gap-4 auto-rows-[320px]`}>
            {workers.map((w) => {
              const logs = workerLogs.get(w.id) ?? [];
              const isConfirmingDelete = confirmDeleteId === w.id;
              const st = statusConfig[w.status] ?? defaultStatus;

              return (
                <div
                  key={w.id}
                  className={`group flex h-full min-h-0 flex-col rounded-xl overflow-hidden border transition-all duration-300 ${w.status === "running"
                    ? "border-town-success/25 shadow-[0_0_20px_-6px_rgba(16,185,129,0.15)]"
                    : w.status === "failed"
                      ? "border-town-danger/25"
                      : "border-town-border/60 hover:border-town-border"
                    } bg-town-bg`}
                >
                  {/* Terminal header — faux title bar */}
                  <div className="flex items-center justify-between px-3 py-2 bg-town-surface/80 border-b border-town-border/50 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Traffic-light dot */}
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot} ${w.status === "running" ? "animate-pulse" : ""}`}
                      />
                      {/* Agent name */}
                      <span className="text-xs font-bold uppercase tracking-widest truncate text-town-text">
                        {w.agent_type}
                      </span>
                      {/* Actor identity */}
                      {w.actor_id && actorName(w.actor_id) && (
                        <span
                          className="text-[10px] bg-town-accent/10 text-town-accent px-1.5 py-0.5 rounded-md font-medium truncate max-w-[100px]"
                          title={`Actor: ${actorName(w.actor_id)}`}
                        >
                          👤 {actorName(w.actor_id)}
                        </span>
                      )}
                      {/* PID */}
                      {w.pid && (
                        <span className="text-[10px] text-town-text-faint font-mono shrink-0">
                          #{w.pid}
                        </span>
                      )}
                      {/* Status badge */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st.bg} ${st.text}`}
                      >
                        {st.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {/* Stop button */}
                      {w.status === "running" && (
                        <button
                          onClick={() => stop(w.id)}
                          className="p-1.5 rounded-md text-town-warning hover:bg-town-warning/10 transition-all duration-200"
                          title="Stop worker"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <rect x="3" y="3" width="10" height="10" rx="2" />
                          </svg>
                        </button>
                      )}
                      {/* Delete button */}
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 animate-fade-in">
                          <button
                            onClick={() => handleDelete(w.id)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-town-danger/15 text-town-danger hover:bg-town-danger/25 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 rounded-md text-[10px] text-town-text-muted hover:text-town-text transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(w.id)}
                          className="p-1.5 rounded-md text-town-text-faint hover:text-town-danger hover:bg-town-danger/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                          title="Remove worker"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Terminal body — xterm.js */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <XtermTerminal
                      workerId={w.id}
                      isRunning={w.status === "running"}
                      initialLogs={logs}
                    />
                  </div>

                  {/* Terminal footer */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-t border-town-border/40 bg-town-surface/40 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-town-text-faint font-mono">
                        {logs.length} line{logs.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="text-[10px] text-town-text-faint font-mono">
                      {new Date(w.started_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
