import { useState, useEffect } from "react";
import { useConvoys } from "../hooks/useConvoys";
import {
  ConvoyInfo,
  ConvoyStatus,
  TaskItem,
  listTasks,
  RigInfo,
  convoyLand,
} from "../lib/tauri";

interface ConvoyBoardProps {
  rigs: RigInfo[];
  selectedRigId: string | null;
}

const statusColors: Record<ConvoyStatus, string> = {
  planning: "bg-blue-500/20 text-blue-400",
  active: "bg-green-500/20 text-green-400",
  blocked: "bg-red-500/20 text-red-400",
  completed: "bg-town-accent/20 text-town-accent",
  cancelled: "bg-gray-500/20 text-gray-400",
};

const statusOptions: ConvoyStatus[] = [
  "planning",
  "active",
  "blocked",
  "completed",
  "cancelled",
];

export default function ConvoyBoard({
  rigs: _rigs,
  selectedRigId,
}: ConvoyBoardProps) {
  const {
    convoys,
    loading,
    addConvoy,
    addItem,
    changeStatus,
    refresh: _refresh,
  } = useConvoys();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [landingId, setLandingId] = useState<string | null>(null);

  // Load all tasks from selected rig for linking
  useEffect(() => {
    if (!selectedRigId) return;
    listTasks(selectedRigId).then(setTasks).catch(console.error);
  }, [selectedRigId]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedRigId) return;
    await addConvoy(title.trim(), description.trim(), [selectedRigId]);
    setTitle("");
    setDescription("");
    setShowCreate(false);
  };

  const handleLand = async (convoyId: string) => {
    setLandingId(convoyId);
    try {
      await convoyLand(convoyId);
      // Refresh tasks after land
      if (selectedRigId) {
        listTasks(selectedRigId).then(setTasks).catch(console.error);
      }
    } catch (e) {
      console.error("convoy_land failed:", e);
    } finally {
      setLandingId(null);
    }
  };

  const handleAddItem = async (convoyId: string) => {
    if (!selectedTaskId) return;
    await addItem(convoyId, selectedTaskId);
    setSelectedTaskId("");
    setAddingItemTo(null);
    // Refresh tasks to update convoy_id
    if (selectedRigId) {
      listTasks(selectedRigId).then(setTasks).catch(console.error);
    }
  };

  const getTaskById = (id: string) => tasks.find((t) => t.id === id);

  const getProgress = (convoy: ConvoyInfo) => {
    if (convoy.work_item_ids.length === 0) return 0;
    const done = convoy.work_item_ids.filter((id) => {
      const t = getTaskById(id);
      return t?.status === "done";
    }).length;
    return Math.round((done / convoy.work_item_ids.length) * 100);
  };

  const getBlockedCount = (convoy: ConvoyInfo) =>
    convoy.work_item_ids.filter((id) => {
      const t = getTaskById(id);
      return t?.status === "blocked";
    }).length;

  if (!selectedRigId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-town-surface flex items-center justify-center mx-auto mb-4">
            <span className="text-xl text-town-text-faint">🚛</span>
          </div>
          <p className="text-sm text-town-text-muted">
            Select a rig first to manage convoys
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Convoys</h2>
          <p className="text-xs text-town-text-muted mt-0.5">
            Cross-task orchestration &amp; progress tracking
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-xs font-medium bg-town-accent text-town-bg rounded-lg hover:bg-town-accent/90 transition-colors"
        >
          + New Convoy
        </button>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <input
            className="w-full px-3 py-2 text-sm bg-town-bg border border-town-border rounded-lg focus:outline-none focus:border-town-accent"
            placeholder="Convoy title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="w-full px-3 py-2 text-sm bg-town-bg border border-town-border rounded-lg focus:outline-none focus:border-town-accent resize-none"
            rows={2}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-xs text-town-text-muted hover:text-town-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-town-accent text-town-bg rounded-lg hover:bg-town-accent/90 disabled:opacity-50 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Convoy cards */}
      {!loading && convoys.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-town-text-muted">
            No convoys yet. Create one to orchestrate multiple tasks together.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {convoys.map((convoy) => {
          const progress = getProgress(convoy);
          const blockedCount = getBlockedCount(convoy);

          return (
            <div
              key={convoy.convoy_id}
              className="glass-card p-4 space-y-3 animate-fade-in"
            >
              {/* Convoy header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold truncate">
                      {convoy.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${statusColors[convoy.status]}`}
                    >
                      {convoy.status}
                    </span>
                    {/* Owned badge */}
                    {convoy.owned && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-yellow-500/20 text-yellow-400">
                        🔒 owned
                      </span>
                    )}
                    {/* Merge strategy chip */}
                    {convoy.merge_strategy && convoy.merge_strategy !== "direct" && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/20 text-purple-400">
                        ⬡ {convoy.merge_strategy}
                      </span>
                    )}
                  </div>
                  {convoy.description && (
                    <p className="text-xs text-town-text-muted mt-1 line-clamp-2">
                      {convoy.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Land button — only for active owned convoys */}
                  {convoy.owned && convoy.status === "active" && (
                    <button
                      onClick={() => handleLand(convoy.convoy_id)}
                      disabled={landingId === convoy.convoy_id}
                      className="px-2 py-1 text-[10px] font-medium bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 transition-colors"
                      title="Land convoy — close all tasks and complete"
                    >
                      {landingId === convoy.convoy_id ? "…" : "🛬 Land"}
                    </button>
                  )}
                  {/* Status changer */}
                  <select
                    value={convoy.status}
                    onChange={(e) =>
                      changeStatus(
                        convoy.convoy_id,
                        e.target.value as ConvoyStatus,
                      )
                    }
                    className="px-2 py-1 text-[10px] bg-town-bg border border-town-border rounded-md text-town-text-muted focus:outline-none"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-town-text-muted">
                  <span>
                    {convoy.work_item_ids.length} tasks ·{" "}
                    {blockedCount > 0 && (
                      <span className="text-red-400">
                        {blockedCount} blocked
                      </span>
                    )}
                  </span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="h-1.5 bg-town-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-town-accent rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Work items list */}
              {convoy.work_item_ids.length > 0 && (
                <div className="space-y-1">
                  {convoy.work_item_ids.map((taskId) => {
                    const task = getTaskById(taskId);
                    if (!task) {
                      return (
                        <div
                          key={taskId}
                          className="text-[10px] text-town-text-faint px-2 py-1"
                        >
                          {taskId.slice(0, 8)}… (not found)
                        </div>
                      );
                    }
                    return (
                      <div
                        key={taskId}
                        className="flex items-center gap-2 px-2 py-1 rounded bg-town-bg/50"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            task.status === "done"
                              ? "bg-green-400"
                              : task.status === "blocked"
                                ? "bg-red-400"
                                : task.status === "in_progress"
                                  ? "bg-blue-400"
                                  : "bg-gray-400"
                          }`}
                        />
                        <span className="text-xs truncate flex-1">
                          {task.title}
                        </span>
                        <span className="text-[10px] text-town-text-faint">
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add item */}
              {addingItemTo === convoy.convoy_id ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs bg-town-bg border border-town-border rounded-md focus:outline-none"
                  >
                    <option value="">Select a task</option>
                    {tasks
                      .filter((t) => !convoy.work_item_ids.includes(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleAddItem(convoy.convoy_id)}
                    disabled={!selectedTaskId}
                    className="px-2 py-1 text-[10px] font-medium bg-town-accent text-town-bg rounded disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingItemTo(null)}
                    className="px-2 py-1 text-[10px] text-town-text-muted hover:text-town-text"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingItemTo(convoy.convoy_id)}
                  className="text-[10px] text-town-accent hover:text-town-accent/80 transition-colors"
                >
                  + Add task
                </button>
              )}

              {/* Footer meta */}
              <div className="flex items-center gap-3 text-[10px] text-town-text-faint">
                <span>
                  Created {new Date(convoy.created_at).toLocaleDateString()}
                </span>
                {convoy.rig_ids.length > 0 && (
                  <span>
                    {convoy.rig_ids.length} rig
                    {convoy.rig_ids.length > 1 ? "s" : ""}
                  </span>
                )}
                {convoy.completed_at && (
                  <span className="text-green-400">
                    Completed{" "}
                    {new Date(convoy.completed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
