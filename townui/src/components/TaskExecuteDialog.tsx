import { useState, useEffect } from "react";
import {
  TaskItem,
  CrewInfo,
  TemplateInfo,
  listTemplates,
  listCrews,
  getSettings,
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
    getSettings()
      .then((s) => {
        if (s.default_cli) {
          setAgentType(s.default_cli);
        }
      })
      .catch(() => {});

    listTemplates()
      .then(setTemplates)
      .catch(() => {});
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
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content w-[520px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-town-success/15 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-town-success"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">Execute Task</h2>
              <p className="text-xs text-town-text-muted truncate max-w-[350px]">
                "{task.title}"
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-town-text-muted mb-1.5">
              Crew (Worktree)
            </label>
            {crews.length === 0 ? (
              <div className="flex items-center gap-2.5 p-3 bg-town-danger-soft border border-town-danger/20 rounded-lg">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-town-danger shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-sm text-town-danger">
                  No crews available. Create a crew first.
                </span>
              </div>
            ) : (
              <select
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                className="select-base"
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
            <label className="block text-sm font-medium text-town-text-muted mb-1.5">
              Agent Type
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
          <div>
            <label className="block text-sm font-medium text-town-text-muted mb-1.5">
              Prompt Template
            </label>
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="select-base"
            >
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.description} {t.is_builtin ? "" : "(custom)"}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-town-danger-soft border border-town-danger/20 rounded-lg animate-slide-up">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-town-danger shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-sm text-town-danger">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-4 mt-2 border-t border-town-border/30 bg-town-bg/30">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={!crewId || crews.length === 0 || executing}
            className="btn-primary !bg-town-success hover:!bg-town-success/80 inline-flex items-center gap-2"
          >
            {executing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
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
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Execute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
