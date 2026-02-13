import { useState, useEffect, useCallback } from "react";
import {
  WorkerInfo,
  LogEntry,
  listWorkers,
  spawnWorker,
  stopWorker,
  deleteWorker,
  getWorkerLogs,
} from "../lib/tauri";
import { listen } from "@tauri-apps/api/event";

export function useWorkers(rigId: string | null) {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setWorkers([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await listWorkers(rigId);
      setWorkers(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh when worker status changes
  useEffect(() => {
    const unlisten = listen<[string, string]>("worker-status", (event) => {
      const [workerId, newStatus] = event.payload;
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? { ...w, status: newStatus as WorkerInfo["status"] }
            : w,
        ),
      );
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const spawn = useCallback(
    async (crewId: string, agentType: string, initialPrompt: string) => {
      try {
        setError(null);
        const worker = await spawnWorker(crewId, agentType, initialPrompt);
        setWorkers((prev) => [...prev, worker]);
        return worker;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [],
  );

  const stop = useCallback(async (id: string) => {
    try {
      setError(null);
      await stopWorker(id);
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, status: "stopped" as const } : w,
        ),
      );
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      setError(null);
      await deleteWorker(id);
      setWorkers((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const getLogs = useCallback(async (id: string): Promise<LogEntry[]> => {
    try {
      return await getWorkerLogs(id);
    } catch (e) {
      setError(String(e));
      return [];
    }
  }, []);

  return { workers, loading, error, refresh, spawn, stop, remove, getLogs };
}
