import { useState, useEffect } from "react";
import { WorkerInfo, CrewInfo, LogEntry } from "../lib/tauri";
import { listen } from "@tauri-apps/api/event";
import LogViewer from "./LogViewer";
import { useSettings } from "../hooks/useSettings";
import { t } from "../lib/i18n";

interface WorkerPanelProps {
  workers: WorkerInfo[];
  crews: CrewInfo[];
  loading: boolean;
  onSpawn: (
    crewId: string,
    agentType: string,
    initialPrompt: string,
  ) => Promise<void>;
  onStop: (id: string) => void;
  onGetLogs: (id: string) => Promise<LogEntry[]>;
}

export default function WorkerPanel({
  workers,
  crews,
  loading,
  onSpawn,
  onStop,
  onGetLogs,
}: WorkerPanelProps) {
  const { settings } = useSettings();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showSpawn, setShowSpawn] = useState(false);
  const [crewId, setCrewId] = useState(crews[0]?.id || "");
  const [agentType, setAgentType] = useState("claude");
  const [prompt, setPrompt] = useState("");
  const [spawning, setSpawning] = useState(false);

  // Listen for live log events
  useEffect(() => {
    const unlisten = listen<[string, LogEntry]>("worker-log", (event) => {
      const [workerId, entry] = event.payload;
      if (workerId === selectedWorkerId) {
        setLogs((prev) => [...prev, entry]);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [selectedWorkerId]);

  // Load logs when selecting a worker
  useEffect(() => {
    if (selectedWorkerId) {
      onGetLogs(selectedWorkerId).then(setLogs);
    } else {
      setLogs([]);
    }
  }, [selectedWorkerId, onGetLogs]);

  useEffect(() => {
    if (settings?.default_cli) {
      setAgentType(settings.default_cli);
    }
  }, [settings?.default_cli]);

  const handleSpawn = async () => {
    if (!crewId) return;
    setSpawning(true);
    try {
      await onSpawn(crewId, agentType, prompt);
      setShowSpawn(false);
      setPrompt("");
    } catch {
    } finally {
      setSpawning(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-town-text-muted">{t("vi", "loading_workers")}</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("vi", "nav_workers")}</h1>
        <button
          onClick={() => setShowSpawn(!showSpawn)}
          className="px-4 py-2 bg-town-accent hover:bg-town-accent-hover rounded text-sm font-medium transition-colors"
        >
          + {t("vi", "spawn_new_worker")}
        </button>
      </div>

      {/* Spawn form */}
      {showSpawn && (
        <div className="bg-town-surface border border-town-border rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">{t("vi", "spawn_new_worker")}</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-town-text-muted mb-1">
                  {t("vi", "nav_crews")}
                </label>
                <select
                  value={crewId}
                  onChange={(e) => setCrewId(e.target.value)}
                  className="w-full bg-town-bg border border-town-border rounded px-3 py-1.5 text-sm"
                >
                  {crews.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-town-text-muted mb-1">
                  {t("vi", "agent")}
                </label>
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value)}
                  className="w-full bg-town-bg border border-town-border rounded px-3 py-1.5 text-sm"
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
              <label className="block text-xs text-town-text-muted mb-1">
                {t("vi", "initial_prompt")}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm resize-none"
                placeholder={t("vi", "what_agent_do")}
              />
            </div>
            <button
              onClick={handleSpawn}
              disabled={!crewId || crews.length === 0 || spawning}
              className="px-4 py-2 bg-town-success hover:bg-town-success/80 disabled:opacity-50 rounded text-sm font-medium transition-colors"
            >
              {spawning ? t("vi", "spawning") : t("vi", "spawn")}
            </button>
          </div>
        </div>
      )}

      {/* Worker list */}
      <div className="grid grid-cols-1 gap-2 mb-4">
        {workers.length === 0 ? (
          <p className="text-sm text-town-text-muted py-4 text-center">
            {t("vi", "no_workers_running")}
          </p>
        ) : (
          workers.map((w) => (
            <div
              key={w.id}
              onClick={() =>
                setSelectedWorkerId(w.id === selectedWorkerId ? null : w.id)
              }
              className={`bg-town-surface border rounded-lg p-3 cursor-pointer transition-colors ${w.id === selectedWorkerId
                  ? "border-town-accent"
                  : "border-town-border hover:border-town-text-muted/30"
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{w.agent_type}</span>
                  <span className="text-xs text-town-text-muted ml-2">
                    PID: {w.pid || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${w.status === "running"
                        ? "bg-town-success/10 text-town-success"
                        : w.status === "failed"
                          ? "bg-town-danger/10 text-town-danger"
                          : "bg-town-text-muted/10 text-town-text-muted"
                      }`}
                  >
                    {w.status}
                  </span>
                  {w.status === "running" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStop(w.id);
                      }}
                      className="text-xs px-2 py-1 rounded bg-town-danger/10 text-town-danger hover:bg-town-danger/20"
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-town-text-muted mt-1">
                {t("vi", "started_label")}: {new Date(w.started_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Log viewer */}
      {selectedWorkerId && (
        <div className="mt-4">
          <LogViewer
            logs={logs}
            title={`Worker ${selectedWorkerId.slice(0, 8)}...`}
          />
        </div>
      )}
    </div>
  );
}
