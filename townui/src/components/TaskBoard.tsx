import { useState, DragEvent } from "react";
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

// ── Column definitions ──

interface KanbanColumn {
  id: string;
  label: string;
  statuses: TaskStatus[];
  accentColor: string;
  dotColor: string;
  headerBg: string;
  dropTarget: TaskStatus; // status to set when dropped into this column
}

const COLUMNS: KanbanColumn[] = [
  {
    id: "todo",
    label: "To Do",
    statuses: ["todo", "deferred"],
    accentColor: "text-town-text-muted",
    dotColor: "bg-town-text-muted",
    headerBg: "bg-town-text-muted/8",
    dropTarget: "todo",
  },
  {
    id: "in_progress",
    label: "In Progress",
    statuses: ["in_progress", "escalated"],
    accentColor: "text-town-accent",
    dotColor: "bg-town-accent",
    headerBg: "bg-town-accent/8",
    dropTarget: "in_progress",
  },
  {
    id: "blocked",
    label: "Blocked",
    statuses: ["blocked"],
    accentColor: "text-orange-400",
    dotColor: "bg-orange-400",
    headerBg: "bg-orange-500/8",
    dropTarget: "blocked",
  },
  {
    id: "done",
    label: "Done",
    statuses: ["done", "cancelled"],
    accentColor: "text-town-success",
    dotColor: "bg-town-success",
    headerBg: "bg-town-success/8",
    dropTarget: "done",
  },
];

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

const subStatusLabel: Partial<
  Record<TaskStatus, { label: string; color: string }>
> = {
  deferred: {
    label: "Deferred",
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  },
  escalated: {
    label: "Escalated",
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-town-danger bg-town-danger-soft border-town-danger/20",
  },
};

// ── Priority sort order ──
const priorityOrder: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetCol, setDropTargetCol] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">(
    "all",
  );

  const filtered = tasks.filter((task) => {
    if (filterPriority !== "all" && task.priority !== filterPriority)
      return false;
    return true;
  });

  // Group tasks by column
  const columnTasks = (col: KanbanColumn) =>
    filtered
      .filter((task) => col.statuses.includes(task.status))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // ── Drag handlers ──
  const handleDragStart = (e: DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetCol(null);
  };

  const handleDragOver = (e: DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetCol(colId);
  };

  const handleDragLeave = (e: DragEvent, _colId: string) => {
    // Only clear if leaving the column entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setDropTargetCol(null);
    }
  };

  const handleDrop = (e: DragEvent, col: KanbanColumn) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Don't update if already in target status
    if (task.status === col.dropTarget) {
      setDraggingId(null);
      setDropTargetCol(null);
      return;
    }

    // If dropping to blocked, ask for reason
    if (col.dropTarget === "blocked") {
      const reason = prompt("Blocked reason:");
      if (reason) {
        onEdit(taskId, { status: "blocked", blocked_reason: reason });
      }
    } else {
      onEdit(taskId, { status: col.dropTarget });
    }

    setDraggingId(null);
    setDropTargetCol(null);
  };

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
    todo: tasks.filter((t) => t.status === "todo" || t.status === "deferred")
      .length,
    in_progress: tasks.filter(
      (t) => t.status === "in_progress" || t.status === "escalated",
    ).length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    done: tasks.filter((t) => t.status === "done" || t.status === "cancelled")
      .length,
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow-sm">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Kanban Board</h1>
            <p className="text-xs text-town-text-muted mt-0.5">
              {counts.total} task{counts.total !== 1 ? "s" : ""} · Drag cards to
              change status
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterPriority}
            onChange={(e) =>
              setFilterPriority(e.target.value as TaskPriority | "all")
            }
            className="select-base !w-auto !py-1.5 !text-xs"
          >
            <option value="all">All Priority</option>
            <option value="critical">‼ Critical</option>
            <option value="high">↑ High</option>
            <option value="medium">→ Medium</option>
            <option value="low">↓ Low</option>
          </select>
          <button
            onClick={onCreateClick}
            className="btn-primary !py-2 !px-3.5 !text-xs inline-flex items-center gap-1.5"
          >
            <svg
              width="14"
              height="14"
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
      </div>

      {/* Kanban columns */}
      <div className="flex-1 flex gap-3 px-4 pb-4 overflow-x-auto min-h-0">
        {COLUMNS.map((col) => {
          const colTasks = columnTasks(col);
          const isDropTarget = dropTargetCol === col.id;
          const count =
            col.id === "todo"
              ? counts.todo
              : col.id === "in_progress"
                ? counts.in_progress
                : col.id === "blocked"
                  ? counts.blocked
                  : counts.done;

          return (
            <div
              key={col.id}
              className={`flex flex-col flex-1 min-w-[220px] max-w-[340px] rounded-xl border transition-all duration-200 ${
                isDropTarget
                  ? "border-town-accent/50 bg-town-accent/5 shadow-[0_0_20px_rgba(124,92,252,0.1)]"
                  : "border-town-border/30 bg-town-bg/40"
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col)}
            >
              {/* Column header */}
              <div
                className={`flex items-center gap-2.5 px-3.5 py-3 rounded-t-xl ${col.headerBg}`}
              >
                <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${col.accentColor}`}
                >
                  {col.label}
                </span>
                <span
                  className={`ml-auto text-[11px] font-bold ${col.accentColor} opacity-60`}
                >
                  {count}
                </span>
              </div>

              {/* Cards container */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                {colTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[80px]">
                    <p className="text-[11px] text-town-text-faint italic">
                      {isDropTarget ? "Drop here" : "No tasks"}
                    </p>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      isDragging={draggingId === task.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onExecute={onExecute}
                      onSling={onSling}
                      language={language}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Kanban Card ──

function KanbanCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  onExecute,
  onSling,
  language,
}: {
  task: TaskItem;
  isDragging: boolean;
  onDragStart: (e: DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onEdit: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onExecute: (task: TaskItem) => void;
  onSling?: (taskId: string) => Promise<void>;
  language: AppLanguage;
}) {
  const [showActions, setShowActions] = useState(false);
  const pConfig = priorityConfig[task.priority];
  const sub = subStatusLabel[task.status];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => setShowActions(!showActions)}
      className={`group relative rounded-lg border p-3 cursor-grab active:cursor-grabbing select-none
        transition-all duration-150
        ${
          isDragging
            ? "opacity-40 scale-95 border-town-accent/40 bg-town-accent/5"
            : "bg-town-surface/60 border-town-border/40 hover:border-town-border-light/60 hover:bg-town-surface/90 hover:shadow-card-hover"
        }`}
    >
      {/* Priority & sub-status badges */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`badge border !text-[10px] !px-1.5 !py-0 ${pConfig.color}`}
        >
          {pConfig.icon}
        </span>
        {sub && (
          <span
            className={`badge border !text-[10px] !px-1.5 !py-0 ${sub.color}`}
          >
            {sub.label}
          </span>
        )}
        {task.dependencies.length > 0 && (
          <span
            className="text-[10px] text-town-text-faint"
            title={`${task.dependencies.length} dependencies`}
          >
            ⛓{task.dependencies.length}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-[13px] font-semibold leading-snug line-clamp-2">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-[11px] text-town-text-muted mt-1 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Blocked reason */}
      {task.blocked_reason && task.status === "blocked" && (
        <p className="text-[11px] text-orange-400 mt-1.5 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />
          <span className="line-clamp-1">{task.blocked_reason}</span>
        </p>
      )}

      {/* Acceptance criteria */}
      {task.acceptance_criteria && (
        <p className="text-[10px] text-town-text-faint mt-1 italic line-clamp-1">
          ✓ {task.acceptance_criteria}
        </p>
      )}

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] bg-town-bg/80 border border-town-border/30 px-1.5 py-px rounded text-town-text-muted"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-[10px] text-town-text-faint">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Expandable actions */}
      {showActions && (
        <div
          className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-town-border/20 animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onExecute(task)}
            className="btn-success !py-1 !px-2 !text-[11px] inline-flex items-center gap-1"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Execute
          </button>
          {onSling && (
            <button
              onClick={() => onSling(task.id)}
              className="btn-ghost !py-1 !px-2 !text-[11px] !text-town-accent"
            >
              {t(language, "sling")}
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
                className="btn-ghost !py-1 !px-2 !text-[11px] !text-orange-400"
              >
                Block
              </button>
              <button
                onClick={() => onEdit(task.id, { status: "escalated" })}
                className="btn-ghost !py-1 !px-2 !text-[11px] !text-rose-400"
              >
                Escalate
              </button>
              <button
                onClick={() => onEdit(task.id, { status: "deferred" })}
                className="btn-ghost !py-1 !px-2 !text-[11px] !text-yellow-400"
              >
                Defer
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (confirm(`Delete "${task.title}"?`)) onDelete(task.id);
            }}
            className="btn-ghost !py-1 !px-2 !text-[11px] !text-town-danger ml-auto"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
