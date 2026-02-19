import { useState, useEffect, useCallback, useRef } from "react";
import {
  HealthMetrics,
  getHealthMetrics,
  escalateStuckTasks,
  TaskItem,
} from "../lib/tauri";

export function useHealth(rigId: string | null, pollIntervalMs = 30000) {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setMetrics(null);
      return;
    }
    try {
      setLoading(true);
      const data = await getHealthMetrics(rigId);
      setMetrics(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
    if (rigId && pollIntervalMs > 0) {
      timerRef.current = setInterval(refresh, pollIntervalMs);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh, rigId, pollIntervalMs]);

  const escalate = useCallback(
    async (thresholdMinutes?: number): Promise<TaskItem[]> => {
      if (!rigId) return [];
      const result = await escalateStuckTasks(rigId, thresholdMinutes);
      await refresh();
      return result;
    },
    [rigId, refresh],
  );

  return { metrics, loading, refresh, escalate };
}
