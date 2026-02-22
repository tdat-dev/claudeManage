import { useState, useEffect, useCallback } from "react";
import {
  TaskItem,
  TaskPriority,
  TaskUpdate,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../lib/tauri";
import { listen } from "@tauri-apps/api/event";

export function useTasks(rigId: string | null) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setTasks([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await listTasks(rigId);
      setTasks(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
    const unlisten = listen("data-changed", () => {
      refresh();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  const addTask = useCallback(
    async (
      title: string,
      description: string,
      tags: string[],
      priority: TaskPriority,
      acceptanceCriteria?: string,
    ) => {
      if (!rigId) return;
      try {
        setError(null);
        const task = await createTask(
          rigId,
          title,
          description,
          tags,
          priority,
          acceptanceCriteria,
        );
        setTasks((prev) => [...prev, task]);
        return task;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [rigId],
  );

  const editTask = useCallback(async (id: string, updates: TaskUpdate) => {
    try {
      setError(null);
      const updated = await updateTask(id, updates);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  const removeTask = useCallback(async (id: string) => {
    try {
      setError(null);
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return { tasks, loading, error, refresh, addTask, editTask, removeTask };
}
