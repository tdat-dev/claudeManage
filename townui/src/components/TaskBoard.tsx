import { useState } from "react";
import { TaskItem, TaskPriority, TaskStatus, TaskUpdate } from "../lib/tauri";

interface TaskBoardProps {
  tasks: TaskItem[];
  loading: boolean;
  onCreateClick: () => void;
  onEdit: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onExecute: (task: TaskItem) => void;
}

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-blue-500/10 text-blue-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  high: "bg-orange-500/10 text-orange-400",
  critical: "bg-red-500/10 text-red-400",
};

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-town-text-muted/10 text-town-text-muted",
  in_progress: "bg-town-accent/10 text-town-accent",
  done: "bg-town-success/10 text-town-success",
  cancelled: "bg-town-danger/10 text-town-danger",
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

export default function TaskBoard({ tasks, loading, onCreateClick, onEdit, onDelete, onExecute }: TaskBoardProps) {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">("all");

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  if (loading) {
    return <div className="p-6 text-town-text-muted">Loading tasks...</div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Task Board</h1>
        <button
          onClick={onCreateClick}
          className="px-4 py-2 bg-town-accent hover:bg-town-accent-hover rounded text-sm font-medium transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "all")}
          className="bg-town-surface border border-town-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-town-accent"
        >
          <option value="all">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | "all")}
          className="bg-town-surface border border-town-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-town-accent"
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
        <div className="text-center py-12 text-town-text-muted">
          <p className="text-sm">No tasks found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onExecute={onExecute}
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
}: {
  task: TaskItem;
  onEdit: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onExecute: (task: TaskItem) => void;
}) {
  const nextStatus = (): TaskStatus | null => {
    switch (task.status) {
      case "todo": return "in_progress";
      case "in_progress": return "done";
      default: return null;
    }
  };

  const next = nextStatus();

  return (
    <div className="bg-town-surface border border-town-border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[task.status]}`}>
              {statusLabels[task.status]}
            </span>
          </div>
          <h3 className="font-medium text-sm">{task.title}</h3>
          {task.description && (
            <p className="text-xs text-town-text-muted mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.tags.length > 0 && (
            <div className="flex gap-1 mt-2">
              {task.tags.map((tag) => (
                <span key={tag} className="text-xs bg-town-bg px-1.5 py-0.5 rounded text-town-text-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {next && (
          <button
            onClick={() => onEdit(task.id, { status: next })}
            className="text-xs px-2 py-1 rounded bg-town-accent/10 text-town-accent hover:bg-town-accent/20 transition-colors"
          >
            {next === "in_progress" ? "Start" : "Complete"}
          </button>
        )}
        <button
          onClick={() => onExecute(task)}
          className="text-xs px-2 py-1 rounded bg-town-success/10 text-town-success hover:bg-town-success/20 transition-colors"
        >
          Execute
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete task "${task.title}"?`)) onDelete(task.id);
          }}
          className="text-xs px-2 py-1 rounded bg-town-danger/10 text-town-danger hover:bg-town-danger/20 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
