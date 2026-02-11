import { useState, useEffect } from "react";
import { TaskItem, CrewInfo, TemplateInfo, listTemplates, listCrews } from "../lib/tauri";

interface TaskExecuteDialogProps {
  task: TaskItem;
  crews?: CrewInfo[];
  onExecute: (taskId: string, crewId: string, agentType: string, templateName: string) => Promise<void>;
  onClose: () => void;
}

export default function TaskExecuteDialog({ task, crews: propCrews, onExecute, onClose }: TaskExecuteDialogProps) {
  const [crews, setCrews] = useState<CrewInfo[]>(propCrews ?? []);
  const [crewId, setCrewId] = useState(crews[0]?.id || "");
  const [agentType, setAgentType] = useState("claude");
  const [templateName, setTemplateName] = useState("implement_feature");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {});
    // Always fetch fresh crews for this task's rig
    listCrews(task.rig_id).then((data) => {
      setCrews(data);
      if (data.length > 0 && !crewId) {
        setCrewId(data[0].id);
      }
    }).catch(() => {});
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-town-surface border border-town-border rounded-lg p-6 w-[480px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">Execute Task</h2>
        <p className="text-sm text-town-text-muted mb-4">"{task.title}"</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-town-text-muted mb-1">Crew (Worktree)</label>
            {crews.length === 0 ? (
              <p className="text-sm text-town-danger">No crews available. Create a crew first.</p>
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
            <label className="block text-sm text-town-text-muted mb-1">Agent Type</label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="w-full bg-town-bg border border-town-border rounded px-3 py-2 text-sm focus:outline-none focus:border-town-accent"
            >
              <option value="claude">Claude Code</option>
              <option value="custom">Custom Command</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-town-text-muted mb-1">Prompt Template</label>
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
