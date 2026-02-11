import { useState, useEffect } from "react";
import {
  TaskItem,
  CrewInfo,
  TemplateInfo,
  listTemplates,
  listCrews,
} from "../lib/tauri";

interface TaskExecuteDialogProps {
  task: TaskItem;
  crews?: CrewInfo[];
  onExecute: (
    taskId: string,
    crewId: string,
    agentType: string,
    templateName: string,
  ) => Promise<void>;
  onClose: () => void;
}

export default function TaskExecuteDialog({
  task,
  crews: propCrews,
  onExecute,
  onClose,
}: TaskExecuteDialogProps) {
  const [crews, setCrews] = useState<CrewInfo[]>(propCrews ?? []);
  const [crewId, setCrewId] = useState(crews[0]?.id || "");
  const [agentType, setAgentType] = useState("claude");
  const [templateName, setTemplateName] = useState("implement_feature");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch(() => {});
    // Always fetch fresh crews for this task's rig
    listCrews(task.rig_id)
      .then((data) => {
        setCrews(data);
        if (data.length > 0 && !crewId) {
          setCrewId(data[0].id);
        }
      })
      .catch(() => {});
  }, [task.rig_id]);

  const handleExecute = async () => {
    if (!crewId) return;
    setExecuting(true);
    setError(null);
    try {
      await onExecute(task.id, crewId, agentType, templateName);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-town-surface border border-town-border rounded-lg p-6 w-[480px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">Execute Task</h2>
        <p className="text-sm text-town-text-muted mb-4">"{task.title}"</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-town-text-muted mb-1">
              Crew (Worktree)
            </label>
            {crews.length === 0 ? (
              <p className="text-sm text-town-danger">
                No crews available. Create a crew first.
              </p>
            ) : (
              <select
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
              >
                {crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.branch})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm text-town-text-muted mb-1">
              Agent Type
            </label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
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
          <div>
            <label className="block text-sm text-town-text-muted mb-1">
              Prompt Template
            </label>
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
            >
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.description} {t.is_builtin ? "" : "(custom)"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-town-danger/10 border border-town-danger/30 rounded px-3 py-2 mb-4 text-sm text-town-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-town-text-muted hover:text-town-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={!crewId || crews.length === 0 || executing}
            className="px-4 py-2 bg-town-success hover:bg-town-success/80 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            {executing ? "Starting..." : "Execute"}
          </button>
        </div>
      </div>
    </div>
  );
}
