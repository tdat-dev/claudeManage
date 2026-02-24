import { useState, useRef, DragEvent, useEffect } from "react";
import {
  HookInfo,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TaskUpdate,
} from "../lib/tauri";
import { AppLanguage, t } from "../lib/i18n";

interface TaskBoardProps {
  language: AppLanguage;
  tasks: TaskItem[];
  hooks: HookInfo[];
  loading: boolean;
  onCreateClick: () => void;
  onEdit: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onExecute: (task: TaskItem) => void;
  onQuickStart?: (task: TaskItem) => Promise<void> | void;
  onSling?: (taskId: string, hookId: string) => Promise<void>;
  onAiIntake?: (
    brief: string,
  ) => Promise<{ created: number; ignoredLines: number }>;
}

// ── Column definitions ──

interface KanbanColumn {
  id: string;
  labelKey: string;
  statuses: TaskStatus[];
  icon: string;
  accentColor: string;
  dotColor: string;
  headerBg: string;
  borderAccent: string;
  dropTarget: TaskStatus;
}

const COLUMNS: KanbanColumn[] = [
  {
    id: "todo",
    labelKey: "col_todo",
    statuses: ["todo", "deferred"],
    icon: "○",
    accentColor: "text-slate-400",
    dotColor: "bg-slate-400",
    headerBg: "bg-slate-500/8",
    borderAccent: "border-slate-500/30",
    dropTarget: "todo",
  },
  {
    id: "in_progress",
    labelKey: "col_in_progress",
    statuses: ["in_progress", "escalated"],
    icon: "◉",
    accentColor: "text-town-accent",
    dotColor: "bg-town-accent",
    headerBg: "bg-town-accent/8",
    borderAccent: "border-town-accent/30",
    dropTarget: "in_progress",
  },
  {
    id: "blocked",
    labelKey: "col_blocked",
    statuses: ["blocked"],
    icon: "⊘",
    accentColor: "text-orange-400",
    dotColor: "bg-orange-400",
    headerBg: "bg-orange-500/8",
    borderAccent: "border-orange-500/30",
    dropTarget: "blocked",
  },
  {
    id: "done",
    labelKey: "col_done",
    statuses: ["done", "cancelled"],
    icon: "✓",
    accentColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
    headerBg: "bg-emerald-500/8",
    borderAccent: "border-emerald-500/30",
    dropTarget: "done",
  },
];

const priorityConfig: Record<
  TaskPriority,
  {
    labelKey: string;
    color: string;
    bgColor: string;
    icon: string;
    barColor: string;
  }
> = {
  critical: {
    labelKey: "pri_critical",
    color: "text-red-400",
    bgColor: "bg-red-500/12 border-red-500/20",
    icon: "🔴",
    barColor: "bg-red-500",
  },
  high: {
    labelKey: "pri_high",
    color: "text-orange-400",
    bgColor: "bg-orange-500/12 border-orange-500/20",
    icon: "🟠",
    barColor: "bg-orange-500",
  },
  medium: {
    labelKey: "pri_medium",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    icon: "🟡",
    barColor: "bg-yellow-500",
  },
  low: {
    labelKey: "pri_low",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: "🔵",
    barColor: "bg-blue-500",
  },
};

const subStatusConfig: Partial<
  Record<TaskStatus, { labelKey: string; color: string; bgColor: string }>
> = {
  deferred: {
    labelKey: "status_deferred",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  escalated: {
    labelKey: "status_escalated",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
  },
  cancelled: {
    labelKey: "status_cancelled",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
  },
};

const priorityOrder: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function TaskBoard({
  language,
  tasks,
  hooks,
  loading,
  onCreateClick,
  onEdit,
  onDelete,
  onExecute,
  onQuickStart,
  onSling,
  onAiIntake,
}: TaskBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetCol, setDropTargetCol] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [aiIntaking, setAiIntaking] = useState(false);
  const [aiIntakeError, setAiIntakeError] = useState<string | null>(null);
  const [aiIntakeSummary, setAiIntakeSummary] = useState<string | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Sync selected task with latest data
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
      else setSelectedTask(null);
    }
  }, [tasks]);

  // Focus quick add input
  useEffect(() => {
    if (quickAddCol && quickAddRef.current) {
      quickAddRef.current.focus();
    }
  }, [quickAddCol]);

  const filtered = tasks.filter((task) => {
    if (filterPriority !== "all" && task.priority !== filterPriority)
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        task.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

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

  const handleDragLeave = (e: DragEvent) => {
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
    if (!task || task.status === col.dropTarget) {
      setDraggingId(null);
      setDropTargetCol(null);
      return;
    }
    if (col.dropTarget === "blocked") {
      const reason = prompt("Blocked reason:");
      if (reason) onEdit(taskId, { status: "blocked", blocked_reason: reason });
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
          <span className="text-sm text-town-text-muted">{t(language, "loading")}</span>
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

  const donePercent =
    counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between">
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
              <h1 className="text-xl font-bold tracking-tight">{t(language, "task_board")}</h1>
              <p className="text-xs text-town-text-muted mt-0.5">
                {counts.total} {t(language, "tasks_count")} · {donePercent}% {t(language, "task_complete")}
              </p>
            </div>
          </div>
          <button
            onClick={onCreateClick}
            title={`${t(language, "task_new")} (Ctrl+N)`}
            className="btn-primary !py-2 !px-4 !text-sm inline-flex items-center gap-2"
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
            {t(language, "task_new")}
          </button>
        </div>

        {/* Toolbar: search + filters + stats */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-town-text-faint"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(language, "task_search")}
              className="input-base !pl-9 !py-1.5 !text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-town-text-faint hover:text-town-text"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Priority filter chips */}
          <div className="flex items-center gap-1">
            {(["all", "critical", "high", "medium", "low"] as const).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${filterPriority === p
                    ? "bg-town-accent/20 text-town-accent border border-town-accent/30"
                    : "text-town-text-faint hover:text-town-text-muted hover:bg-town-surface-hover border border-transparent"
                    }`}
                >
                  {p === "all"
                    ? t(language, "all")
                    : priorityConfig[p].icon + " " + t(language, priorityConfig[p].labelKey)}
                </button>
              ),
            )}
          </div>

          {/* Progress mini bar */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex gap-0.5">
              {COLUMNS.map((col) => {
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
                    className="flex items-center gap-1"
                    title={`${t(language, col.labelKey)}: ${count}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`}
                    />
                    <span className="text-[10px] text-town-text-faint font-mono">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Quick Intake */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-semibold text-town-text">
                AI Quick Intake
              </h3>
              <p className="text-[11px] text-town-text-faint mt-0.5">
                Paste brief to split into tasks automatically.
              </p>
            </div>
            <button
              disabled={!onAiIntake || aiIntaking || !aiBrief.trim()}
              onClick={async () => {
                if (!onAiIntake || !aiBrief.trim()) return;
                try {
                  setAiIntaking(true);
                  setAiIntakeError(null);
                  setAiIntakeSummary(null);
                  const result = await onAiIntake(aiBrief.trim());
                  setAiIntakeSummary(
                    `Created ${result.created} task(s)${
                      result.ignoredLines > 0
                        ? `, ignored ${result.ignoredLines} line(s)`
                        : ""
                    }.`,
                  );
                  setAiBrief("");
                } catch (e) {
                  setAiIntakeError(String(e));
                } finally {
                  setAiIntaking(false);
                }
              }}
              className="btn-primary !py-1.5 !px-3 !text-xs disabled:opacity-60"
            >
              {aiIntaking ? "Ingesting..." : "Ingest Brief"}
            </button>
          </div>
          <textarea
            value={aiBrief}
            onChange={(e) => setAiBrief(e.target.value)}
            placeholder="- [P1] Add auth guard to API routes #backend&#10;- Create migration for user profile fields #db&#10;- Update onboarding screen copy #frontend"
            rows={4}
            className="input-base w-full !text-xs !py-2 resize-y"
          />
          {aiIntakeSummary && (
            <p className="text-[11px] text-emerald-300 mt-2">{aiIntakeSummary}</p>
          )}
          {aiIntakeError && (
            <p className="text-[11px] text-rose-300 mt-2">
              Intake failed: {aiIntakeError}
            </p>
          )}
        </div>
      </div>

      {/* Board */}
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
              className={`flex flex-col flex-1 min-w-[240px] max-w-[360px] rounded-xl border transition-all duration-200 ${isDropTarget
                ? `${col.borderAccent} bg-town-accent/[0.03] shadow-[0_0_24px_rgba(124,92,252,0.08)]`
                : "border-town-border/25 bg-town-bg/30"
                }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col)}
            >
              {/* Column header */}
              <div
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl ${col.headerBg}`}
              >
                <span className={`text-sm ${col.accentColor}`}>{col.icon}</span>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${col.accentColor}`}
                >
                  {t(language, col.labelKey)}
                </span>
                <span
                  className={`ml-auto text-[11px] font-bold ${col.accentColor} opacity-50 bg-white/5 px-1.5 py-0.5 rounded`}
                >
                  {count}
                </span>
              </div>

              {/* Quick add button */}
              <div className="px-2 pt-2">
                {quickAddCol === col.id ? (
                  <div className="flex gap-1.5">
                    <input
                      ref={quickAddRef}
                      type="text"
                      value={quickAddTitle}
                      onChange={(e) => setQuickAddTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && quickAddTitle.trim()) {
                          onCreateClick();
                          setQuickAddCol(null);
                          setQuickAddTitle("");
                        }
                        if (e.key === "Escape") {
                          setQuickAddCol(null);
                          setQuickAddTitle("");
                        }
                      }}
                      onBlur={() => {
                        setQuickAddCol(null);
                        setQuickAddTitle("");
                      }}
                      placeholder={t(language, "task_title_placeholder")}
                      className="input-base !py-1.5 !px-2.5 !text-xs flex-1"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (col.id === "todo") {
                        onCreateClick();
                      } else {
                        setQuickAddCol(col.id);
                      }
                    }}
                    className="w-full py-1.5 rounded-lg border border-dashed border-town-border/30 text-[11px] text-town-text-faint hover:text-town-text-muted hover:border-town-border/50 hover:bg-town-surface-hover/30 transition-all flex items-center justify-center gap-1"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {t(language, "add")}
                  </button>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[80px]">
                {colTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[60px]">
                    <p className="text-[11px] text-town-text-faint/50 italic">
                      {isDropTarget ? t(language, "task_drop_here") : t(language, "task_no_tasks")}
                    </p>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      language={language}
                      isDragging={draggingId === task.id}
                      isSelected={selectedTask?.id === task.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() =>
                        setSelectedTask(
                          selectedTask?.id === task.id ? null : task,
                        )
                      }
                      onQuickAction={(action) => {
                        if (action === "done")
                          onEdit(task.id, { status: "done" });
                        else if (action === "start") {
                          if (onQuickStart) {
                            void onQuickStart(task);
                          } else {
                            onEdit(task.id, { status: "in_progress" });
                          }
                        }
                        else if (action === "delete") {
                          if (confirm(`${t(language, "task_delete_confirm")} "${task.title}"?`))
                            onDelete(task.id);
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Panel (slide-in from right) */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          allTasks={tasks}
          language={language}
          onClose={() => setSelectedTask(null)}
          onEdit={onEdit}
          onDelete={(id) => {
            onDelete(id);
            setSelectedTask(null);
          }}
          onExecute={onExecute}
          onSling={onSling}
          hooks={hooks}
        />
      )}
    </div>
  );
}

// ── Task Card ──

function TaskCard({
  task,
  language,
  isDragging,
  isSelected,
  onDragStart,
  onDragEnd,
  onClick,
  onQuickAction,
}: {
  task: TaskItem;
  language: AppLanguage;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (e: DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onQuickAction: (action: string) => void;
}) {
  const pConfig = priorityConfig[task.priority];
  const sub = subStatusConfig[task.status];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative rounded-lg border p-2.5 cursor-grab active:cursor-grabbing select-none
        transition-all duration-150
        ${isDragging
          ? "opacity-30 scale-95 border-town-accent/40 bg-town-accent/5 rotate-1"
          : isSelected
            ? "bg-town-accent/8 border-town-accent/40 shadow-[0_0_12px_rgba(124,92,252,0.1)]"
            : "bg-town-surface/50 border-town-border/30 hover:border-town-border/50 hover:bg-town-surface/80 hover:shadow-sm"
        }`}
    >
      {/* Priority bar (left edge) */}
      <div
        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${pConfig.barColor} opacity-60`}
      />

      <div className="pl-2">
        {/* Top row: priority + sub-status + time */}
        <div className="flex items-center gap-1 mb-1">
          <span className={`text-[10px] font-semibold ${pConfig.color}`}>
            {pConfig.icon}
          </span>
          {sub && (
            <span
              className={`text-[9px] font-medium px-1.5 py-px rounded ${sub.bgColor} ${sub.color}`}
            >
              {sub.labelKey ? t(language, sub.labelKey) : ""}
            </span>
          )}
          {task.dependencies.length > 0 && (
            <span
              className="text-[9px] text-town-text-faint"
              title={`${task.dependencies.length} dep(s)`}
            >
              🔗{task.dependencies.length}
            </span>
          )}
          <span className="ml-auto text-[9px] text-town-text-faint/60 font-mono">
            {timeAgo(task.created_at)}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-[12px] font-semibold leading-snug line-clamp-2 text-town-text/90">
          {task.title}
        </h4>

        {/* Description preview */}
        {task.description && (
          <p className="text-[10px] text-town-text-muted/70 mt-0.5 line-clamp-1 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Blocked reason */}
        {task.blocked_reason && task.status === "blocked" && (
          <div className="text-[10px] text-orange-400/80 mt-1 flex items-center gap-1 bg-orange-500/5 px-1.5 py-0.5 rounded">
            <span className="shrink-0">⚠</span>
            <span className="line-clamp-1">{task.blocked_reason}</span>
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] bg-town-bg/60 border border-town-border/20 px-1.5 py-px rounded text-town-text-faint"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-[9px] text-town-text-faint/50">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Quick actions on hover */}
        <div
          className="hidden group-hover:flex items-center gap-1 mt-1.5 pt-1.5 border-t border-town-border/15"
          onClick={(e) => e.stopPropagation()}
        >
          {task.status === "todo" && (
            <button
              onClick={() => onQuickAction("start")}
              className="text-[10px] text-town-accent hover:text-town-accent/80 font-medium px-1.5 py-0.5 rounded hover:bg-town-accent/10 transition-colors"
            >
              {t(language, "task_start")}
            </button>
          )}
          {task.status === "in_progress" && (
            <button
              onClick={() => onQuickAction("done")}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium px-1.5 py-0.5 rounded hover:bg-emerald-500/10 transition-colors"
            >
              {t(language, "task_done")}
            </button>
          )}
          <button
            onClick={() => onQuickAction("delete")}
            className="text-[10px] text-town-text-faint hover:text-red-400 ml-auto px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Detail Panel ──

function TaskDetailPanel({
  task,
  allTasks,
  language,
  onClose,
  onEdit,
  onDelete,
  onExecute,
  onSling,
  hooks,
}: {
  task: TaskItem;
  allTasks: TaskItem[];
  language: AppLanguage;
  onClose: () => void;
  onEdit: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onExecute: (task: TaskItem) => void;
  onSling?: (taskId: string, hookId: string) => Promise<void>;
  hooks: HookInfo[];
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(task.description);
  const pConfig = priorityConfig[task.priority];

  // Keep editable values in sync
  useEffect(() => {
    setTitleValue(task.title);
    setDescValue(task.description);
  }, [task.title, task.description]);

  const depTasks = task.dependencies
    .map((depId) => allTasks.find((t) => t.id === depId))
    .filter(Boolean) as TaskItem[];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="w-[440px] h-full bg-town-surface border-l border-town-border/40 shadow-2xl overflow-y-auto animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-town-surface/95 backdrop-blur-sm z-10 px-5 pt-5 pb-3 border-b border-town-border/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${pConfig.color}`}>{pConfig.icon}</span>
              <span className={`text-[11px] font-medium ${pConfig.color}`}>
                {t(language, pConfig.labelKey)} {t(language, "priority")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onExecute(task)}
                className="btn-success !py-1 !px-2.5 !text-[11px] inline-flex items-center gap-1"
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
              {onSling && hooks.length > 0 && (
                <SlingButton
                  taskId={task.id}
                  hooks={hooks}
                  onSling={onSling}
                  language={language}
                />
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-town-surface-hover text-town-text-faint hover:text-town-text transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Title - editable */}
          {editingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                if (titleValue.trim() && titleValue !== task.title) {
                  onEdit(task.id, { title: titleValue.trim() });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setTitleValue(task.title);
                  setEditingTitle(false);
                }
              }}
              className="input-base !text-base !font-bold !p-1"
            />
          ) : (
            <h2
              className="text-base font-bold cursor-pointer hover:text-town-accent transition-colors leading-snug"
              onClick={() => setEditingTitle(true)}
              title="Click to edit"
            >
              {task.title}
            </h2>
          )}
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Status controls */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(["todo", "in_progress", "blocked", "done"] as TaskStatus[]).map(
                (s) => {
                  const col = COLUMNS.find((c) => c.dropTarget === s)!;
                  const isActive =
                    task.status === s ||
                    (col.statuses.includes(task.status) &&
                      col.dropTarget === s);
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        if (s === "blocked") {
                          const reason = prompt("Blocked reason:");
                          if (reason)
                            onEdit(task.id, {
                              status: "blocked",
                              blocked_reason: reason,
                            });
                        } else {
                          onEdit(task.id, { status: s });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${isActive
                        ? `${col.headerBg} ${col.accentColor} ${col.borderAccent}`
                        : "border-town-border/20 text-town-text-faint hover:text-town-text-muted hover:bg-town-surface-hover"
                        }`}
                    >
                      {col.icon} {t(language, col.labelKey)}
                    </button>
                  );
                },
              )}
            </div>
            {/* Sub-status actions */}
            {task.status === "in_progress" && (
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => onEdit(task.id, { status: "escalated" })}
                  className="text-[10px] text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded transition-colors"
                >
                  ↑ {t(language, "status_escalated")}
                </button>
                <button
                  onClick={() => onEdit(task.id, { status: "deferred" })}
                  className="text-[10px] text-amber-400 hover:bg-amber-500/10 px-2 py-1 rounded transition-colors"
                >
                  ⏸ {t(language, "status_deferred")}
                </button>
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
              {t(language, "priority")}
            </label>
            <div className="flex gap-1.5">
              {(["low", "medium", "high", "critical"] as TaskPriority[]).map(
                (p) => {
                  const pc = priorityConfig[p];
                  return (
                    <button
                      key={p}
                      onClick={() => onEdit(task.id, { priority: p })}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${task.priority === p
                        ? `${pc.bgColor} ${pc.color}`
                        : "border-town-border/20 text-town-text-faint hover:text-town-text-muted hover:bg-town-surface-hover"
                        }`}
                    >
                      {pc.icon} {t(language, pc.labelKey)}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Description - editable */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
              Description
            </label>
            {editingDesc ? (
              <textarea
                autoFocus
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={() => {
                  setEditingDesc(false);
                  if (descValue !== task.description) {
                    onEdit(task.id, { description: descValue });
                  }
                }}
                rows={4}
                className="input-base !text-sm resize-none"
              />
            ) : (
              <div
                className="text-sm text-town-text-muted/80 leading-relaxed cursor-pointer hover:bg-town-surface-hover/50 rounded-lg p-2 -m-2 transition-colors min-h-[40px]"
                onClick={() => setEditingDesc(true)}
                title="Click to edit"
              >
                {task.description || (
                  <span className="text-town-text-faint italic text-xs">
                    Click to add description...
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Acceptance Criteria */}
          {task.acceptance_criteria && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
                Acceptance Criteria
              </label>
              <div className="text-sm text-town-text-muted/80 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                <span className="text-emerald-400 mr-1">✓</span>{" "}
                {task.acceptance_criteria}
              </div>
            </div>
          )}

          {/* Blocked reason */}
          {task.blocked_reason && task.status === "blocked" && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
                Blocked Reason
              </label>
              <div className="text-sm text-orange-300/80 bg-orange-500/5 border border-orange-500/10 rounded-lg p-3">
                <span className="mr-1">⚠</span> {task.blocked_reason}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.length > 0 ? (
                task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] bg-town-bg/60 border border-town-border/30 px-2.5 py-1 rounded-md text-town-text-muted"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-town-text-faint italic">
                  No tags
                </span>
              )}
            </div>
          </div>

          {/* Dependencies */}
          {depTasks.length > 0 && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
                Dependencies
              </label>
              <div className="space-y-1">
                {depTasks.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center gap-2 text-[11px] bg-town-bg/40 rounded-lg px-2.5 py-1.5 border border-town-border/20"
                  >
                    <span
                      className={
                        dep.status === "done"
                          ? "text-emerald-400"
                          : "text-town-text-faint"
                      }
                    >
                      {dep.status === "done" ? "✓" : "○"}
                    </span>
                    <span
                      className={
                        dep.status === "done"
                          ? "line-through text-town-text-faint"
                          : "text-town-text-muted"
                      }
                    >
                      {dep.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcome */}
          {task.outcome && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
                Outcome
              </label>
              <div className="text-sm text-town-text-muted/80 bg-town-bg/40 rounded-lg p-3 border border-town-border/20">
                {task.outcome}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-2 border-t border-town-border/15">
            <label className="text-[11px] font-bold uppercase tracking-wider text-town-text-faint mb-2 block">
              Details
            </label>
            <div className="grid grid-cols-2 gap-y-2 text-[11px]">
              <span className="text-town-text-faint">Created</span>
              <span className="text-town-text-muted font-mono">
                {new Date(task.created_at).toLocaleString()}
              </span>
              <span className="text-town-text-faint">Updated</span>
              <span className="text-town-text-muted font-mono">
                {new Date(task.updated_at).toLocaleString()}
              </span>
              {task.completed_at && (
                <>
                  <span className="text-town-text-faint">Completed</span>
                  <span className="text-town-text-muted font-mono">
                    {new Date(task.completed_at).toLocaleString()}
                  </span>
                </>
              )}
              {task.owner_actor_id && (
                <>
                  <span className="text-town-text-faint">Owner</span>
                  <span className="text-town-text-muted font-mono">
                    {task.owner_actor_id.slice(0, 8)}...
                  </span>
                </>
              )}
              {task.convoy_id && (
                <>
                  <span className="text-town-text-faint">Convoy</span>
                  <span className="text-town-text-muted font-mono">
                    {task.convoy_id.slice(0, 8)}...
                  </span>
                </>
              )}
              <span className="text-town-text-faint">Task ID</span>
              <span className="text-town-text-faint/60 font-mono">
                {task.id.slice(0, 12)}...
              </span>
            </div>
          </div>

          {/* Danger zone */}
          <div className="pt-3 border-t border-town-border/15">
            <button
              onClick={() => {
                if (confirm(`Delete "${task.title}"? This cannot be undone.`)) {
                  onDelete(task.id);
                }
              }}
              className="btn-danger !py-1.5 !px-3 !text-[11px] w-full"
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
                className="inline mr-1.5"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sling Button with Hook Picker ──

function SlingButton({
  taskId,
  hooks,
  onSling,
  language,
}: {
  taskId: string;
  hooks: HookInfo[];
  onSling: (taskId: string, hookId: string) => Promise<void>;
  language: AppLanguage;
}) {
  const [open, setOpen] = useState(false);
  const [slinging, setSlinging] = useState(false);

  const readyHooks = hooks.filter(
    (h) => h.status === "idle" || h.status === "assigned",
  );

  const doSling = async (hookId: string) => {
    setSlinging(true);
    try {
      await onSling(taskId, hookId);
    } finally {
      setSlinging(false);
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={readyHooks.length === 0}
        className="btn-ghost !py-1 !px-2.5 !text-[11px] !text-town-accent"
        title={
          readyHooks.length === 0
            ? "No idle hooks available"
            : "Sling task to a hook"
        }
      >
        ⚡ {t(language, "sling")}
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-full right-0 mt-1 w-56 bg-town-surface border border-town-border/40 rounded-lg shadow-xl z-50 py-1">
        <div className="px-3 py-1.5 text-[10px] text-town-text-faint font-semibold uppercase tracking-wide border-b border-town-border/20">
          Select Hook
        </div>
        {readyHooks.length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-town-text-faint">
            No idle hooks — create hooks first
          </div>
        ) : (
          readyHooks.map((hook) => (
            <button
              key={hook.hook_id}
              onClick={() => doSling(hook.hook_id)}
              disabled={slinging}
              className="w-full text-left px-3 py-2 text-xs hover:bg-town-surface-hover transition-colors flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-town-accent shrink-0" />
              <span className="truncate text-town-text">
                {hook.attached_actor_id.slice(0, 20)}
              </span>
              <span className="text-[10px] text-town-text-faint ml-auto">
                {hook.status}
              </span>
            </button>
          ))
        )}
        <div className="border-t border-town-border/20 px-3 py-1.5">
          <button
            onClick={() => setOpen(false)}
            className="text-[11px] text-town-text-faint hover:text-town-text"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
