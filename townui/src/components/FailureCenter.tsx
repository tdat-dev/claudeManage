import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActorInfo,
  TaskItem,
  WorkerInfo,
  createHandoff,
  listActors,
  listTasks,
  listWorkers,
  resumeHook,
  updateTask,
} from "../lib/tauri";

interface FailureCenterProps {
  rigId: string;
}

interface FailureItem {
  task: TaskItem;
  reason: string;
  severity: "high" | "medium";
}

export default function FailureCenter({ rigId }: FailureCenterProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [actors, setActors] = useState<ActorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setTasks([]);
      setWorkers([]);
      setActors([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [t, w, a] = await Promise.all([
        listTasks(rigId),
        listWorkers(rigId),
        listActors(rigId),
      ]);
      setTasks(t);
      setWorkers(w);
      setActors(a);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const failedWorkerIds = useMemo(
    () =>
      new Set(
        workers
          .filter((w) => w.status === "failed")
          .map((w) => w.id),
      ),
    [workers],
  );

  const failureItems: FailureItem[] = useMemo(() => {
    const out: FailureItem[] = [];
    for (const task of tasks) {
      if (task.status === "blocked") {
        out.push({
          task,
          reason: task.blocked_reason || "Task is blocked",
          severity: "high",
        });
        continue;
      }
      if (task.status === "escalated") {
        out.push({
          task,
          reason: task.blocked_reason || "Task was escalated",
          severity: "high",
        });
        continue;
      }
      if (
        task.assigned_worker_id &&
        failedWorkerIds.has(task.assigned_worker_id) &&
        task.status !== "done" &&
        task.status !== "cancelled"
      ) {
        out.push({
          task,
          reason: "Assigned worker failed",
          severity: "medium",
        });
      }
    }
    return out;
  }, [tasks, failedWorkerIds]);

  const handleRequeue = async (item: FailureItem) => {
    setBusyTaskId(item.task.id);
    try {
      await updateTask(item.task.id, {
        status: "todo",
        assigned_worker_id: null,
        blocked_reason: null,
      });
      await refresh();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleCancel = async (item: FailureItem) => {
    setBusyTaskId(item.task.id);
    try {
      await updateTask(item.task.id, {
        status: "cancelled",
        outcome: "Cancelled from Failure Center",
      });
      await refresh();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleResume = async (item: FailureItem) => {
    if (!item.task.hook_id) {
      alert("Task has no hook_id to resume.");
      return;
    }
    setBusyTaskId(item.task.id);
    try {
      await resumeHook(item.task.hook_id);
      await refresh();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleHandoff = async (item: FailureItem) => {
    if (!item.task.owner_actor_id) {
      alert("Task has no owner_actor_id for handoff.");
      return;
    }
    const from = item.task.owner_actor_id;
    const to = actors.find((a) => a.actor_id !== from);
    if (!to) {
      alert("No target actor available for handoff.");
      return;
    }
    setBusyTaskId(item.task.id);
    try {
      await createHandoff(
        rigId,
        from,
        to.actor_id,
        item.task.id,
        `Handoff from FailureCenter: ${item.reason}`,
        [item.reason],
        ["Resume investigation", "Apply fix", "Update task outcome"],
      );
      await refresh();
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <section className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-town-text-muted uppercase tracking-wider">
          Failure Center
        </h2>
        <button onClick={refresh} className="btn-base !py-1 !px-2 !text-xs">
          Refresh
        </button>
      </div>

      {loading && (
        <div className="text-xs text-town-text-faint">Loading failures...</div>
      )}

      {!loading && error && (
        <div className="text-xs text-town-danger">{error}</div>
      )}

      {!loading && !error && failureItems.length === 0 && (
        <div className="text-xs text-town-text-muted">
          No blocked/escalated/failed items.
        </div>
      )}

      {!loading &&
        !error &&
        failureItems.map((item) => {
          const isBusy = busyTaskId === item.task.id;
          const tone =
            item.severity === "high"
              ? "border-town-danger/40"
              : "border-town-warning/40";
          return (
            <div
              key={item.task.id}
              className={`rounded-lg border ${tone} bg-town-bg/40 p-3`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{item.task.title}</div>
                  <div className="text-[11px] text-town-text-faint mt-1">
                    {item.reason}
                  </div>
                  <div className="text-[10px] text-town-text-faint mt-1 font-mono">
                    {item.task.id.slice(0, 10)}...
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 shrink-0">
                  <button
                    onClick={() => handleRequeue(item)}
                    disabled={isBusy}
                    className="btn-base !py-1 !px-2 !text-[11px]"
                  >
                    Reassign
                  </button>
                  <button
                    onClick={() => handleResume(item)}
                    disabled={isBusy || !item.task.hook_id}
                    className="btn-base !py-1 !px-2 !text-[11px]"
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => handleHandoff(item)}
                    disabled={isBusy || !item.task.owner_actor_id}
                    className="btn-base !py-1 !px-2 !text-[11px]"
                  >
                    Handoff
                  </button>
                  <button
                    onClick={() => handleCancel(item)}
                    disabled={isBusy}
                    className="btn-danger !py-1 !px-2 !text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })}
    </section>
  );
}
