import { useState } from "react";
import { TaskItem, TaskPriority, TaskStatus, TaskUpdate } from "../lib/tauri";
import { AppLanguage, t } from "../lib/i18n";

interface TaskBoardProps {
  language: AppLanguage;
  tasks: TaskItem[];
  loading: boolean;
  onCreateClick: () => void;
  onEdit: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onExecute: (task: TaskItem) => void;
  onSling?: (taskId: string) => Promise<void>;
}

const priorityConfig: Record<TaskPriority, { color: string; icon: string }> = {
  low: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: "↓" },
  medium: {
    color: "bg-town-warning-soft text-town-warning border-town-warning/20",
    icon: "→",
  },
  high: {
    color: "bg-orange-500/12 text-orange-400 border-orange-500/20",
    icon: "↑",
  },
  critical: {
    color: "bg-town-danger-soft text-town-danger border-town-danger/20",
    icon: "‼",
  },
};

const statusConfig: Record<
  TaskStatus,
  { color: string; bg: string; label: string }
> = {
  todo: {
    color: "text-town-text-muted",
    bg: "bg-town-text-muted/8 border-town-text-muted/15",
    label: "To Do",
  },
  in_progress: {
    color: "text-town-accent",
    bg: "bg-town-accent/8 border-town-accent/15",
    label: "In Progress",
  },
  blocked: {
    color: "text-orange-400",
    bg: "bg-orange-500/8 border-orange-500/15",
    label: "Blocked",
  },
  deferred: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/8 border-yellow-500/15",
    label: "Deferred",
  },
  escalated: {
    color: "text-rose-400",
    bg: "bg-rose-500/8 border-rose-500/15",
    label: "Escalated",
  },
  done: {
    color: "text-town-success",
    bg: "bg-town-success-soft border-town-success/15",
    label: "Done",
  },
  cancelled: {
    color: "text-town-danger",
    bg: "bg-town-danger-soft border-town-danger/15",
    label: "Cancelled",
  },
};

export default function TaskBoard({
  language,
  tasks,
  loading,
  onCreateClick,
  onEdit,
  onDelete,
  onExecute,
  onSling,
}: TaskBoardProps) {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">(
    "all",
  );

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
          <span className="text-sm text-town-text-muted">Loading tasks...</span>
        </div>
      </div>
    );
  }

  const counts = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="p-8 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
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
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Task Board</h1>
            <p className="text-sm text-town-text-muted mt-0.5">
              {counts.total} task{counts.total !== 1 ? "s" : ""} ·{" "}
              {counts.in_progress} active
            </p>
          </div>
        </div>
        <button
          onClick={onCreateClick}
          className="btn-primary inline-flex items-center gap-2"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Task
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-town-text-muted/8 flex items-center justify-center">
            <span className="text-lg font-bold text-town-text-muted">
              {counts.todo}
            </span>
          </div>
          <span className="text-xs font-medium text-town-text-muted">
            To Do
          </span>
        </div>
        <div className="glass-card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-town-accent/10 flex items-center justify-center">
            <span className="text-lg font-bold text-town-accent">
              {counts.in_progress}
            </span>
          </div>
          <span className="text-xs font-medium text-town-accent">
            In Progress
          </span>
        </div>
        <div className="glass-card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <span className="text-lg font-bold text-orange-400">
              {counts.blocked}
            </span>
          </div>
          <span className="text-xs font-medium text-orange-400">Blocked</span>
        </div>
        <div className="glass-card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-town-success-soft flex items-center justify-center">
            <span className="text-lg font-bold text-town-success">
              {counts.done}
            </span>
          </div>
          <span className="text-xs font-medium text-town-success">Done</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as TaskStatus | "all")
          }
          className="select-base !w-auto"
        >
          <option value="all">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="deferred">Deferred</option>
          <option value="escalated">Escalated</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) =>
            setFilterPriority(e.target.value as TaskPriority | "all")
          }
          className="select-base !w-auto"
        >
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
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
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <p className="text-sm text-town-text-muted">No tasks found</p>
          <p className="text-xs text-town-text-faint mt-1">
            Create a task to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onExecute={onExecute}
              onSling={onSling}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onExecute,
  onSling,
  language,
}: {
  task: TaskItem;
  onEdit: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onExecute: (task: TaskItem) => void;
  onSling?: (taskId: string) => Promise<void>;
  language: AppLanguage;
}) {
  const nextStatus = (): TaskStatus | null => {
    switch (task.status) {
      case "todo":
        return "in_progress";
      case "in_progress":
        return "done";
      case "blocked":
        return "in_progress";
      case "deferred":
        return "todo";
      case "escalated":
        return "in_progress";
      default:
        return null;
    }
  };

  const next = nextStatus();
  const pConfig = priorityConfig[task.priority];
  const sConfig = statusConfig[task.status];

  return (
    <div className="glass-card p-4 hover:border-town-border-light/60 hover:shadow-card-hover transition-all duration-200 animate-slide-up group">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`badge border ${pConfig.color}`}>
              {pConfig.icon} {task.priority}
            </span>
            <span className={`badge border ${sConfig.bg}`}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${sConfig.color} ${task.status === "in_progress" ? "animate-pulse-slow bg-current" : "bg-current"}`}
              />
              <span className={sConfig.color}>{sConfig.label}</span>
            </span>
          </div>
          <h3 className="font-semibold text-sm leading-snug">{task.title}</h3>
          {task.description && (
            <p className="text-xs text-town-text-muted mt-1.5 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
          {task.blocked_reason && task.status === "blocked" && (
            <p className="text-xs text-orange-400 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              {task.blocked_reason}
            </p>
          )}
          {task.acceptance_criteria && (
            <p className="text-xs text-town-text-faint mt-1 italic">
              ✓ {task.acceptance_criteria}
            </p>
          )}
          {task.dependencies.length > 0 && (
            <p className="text-xs text-town-text-faint mt-1">
              ⛓ {task.dependencies.length} dependenc
              {task.dependencies.length === 1 ? "y" : "ies"}
            </p>
          )}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] bg-town-bg/80 border border-town-border/40 px-2 py-0.5 rounded-md text-town-text-muted font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3.5 pt-3 border-t border-town-border/20">
        {next && (
          <button
            onClick={() => onEdit(task.id, { status: next })}
            className="btn-primary !py-1.5 !px-3 !text-xs"
          >
            {next === "in_progress" ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="inline mr-1"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {task.status === "blocked" || task.status === "escalated"
                  ? "Resume"
                  : "Start"}
              </>
            ) : next === "todo" ? (
              "Undefer"
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="inline mr-1"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Complete
              </>
            )}
          </button>
        )}
        {task.status === "in_progress" && (
          <>
            <button
              onClick={() => {
                const reason = prompt("Blocked reason:");
                if (reason)
                  onEdit(task.id, {
                    status: "blocked",
                    blocked_reason: reason,
                  });
              }}
              className="btn-base !py-1.5 !px-3 !text-xs !text-orange-400 !border-orange-500/30 hover:!bg-orange-500/10"
            >
              Block
            </button>
            <button
              onClick={() => onEdit(task.id, { status: "escalated" })}
              className="btn-base !py-1.5 !px-3 !text-xs !text-rose-400 !border-rose-500/30 hover:!bg-rose-500/10"
            >
              Escalate
            </button>
            <button
              onClick={() => onEdit(task.id, { status: "deferred" })}
              className="btn-base !py-1.5 !px-3 !text-xs !text-yellow-400 !border-yellow-500/30 hover:!bg-yellow-500/10"
            >
              Defer
            </button>
          </>
        )}
        <button
          onClick={() => onExecute(task)}
          className="btn-success !py-1.5 !px-3 !text-xs inline-flex items-center gap-1"
        >
          <svg
            width="12"
            height="12"
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
        </button>
        {onSling && (
          <button
            onClick={() => onSling(task.id)}
            className="btn-base !py-1.5 !px-3 !text-xs !text-town-accent !border-town-accent/30 hover:!bg-town-accent/10"
          >
            {t(language, "sling")}
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(`Delete task "${task.title}"?`)) onDelete(task.id);
          }}
          className="btn-danger !py-1.5 !px-3 !text-xs inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}
