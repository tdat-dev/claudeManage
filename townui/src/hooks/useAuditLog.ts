import { useState, useEffect, useCallback } from "react";
import { AuditEvent, listAuditEvents, getTaskAuditEvents } from "../lib/tauri";

export function useAuditLog(rigId: string | null) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setEvents([]);
      return;
    }
    try {
      setLoading(true);
      const data = await listAuditEvents(rigId, 200);
      setEvents(data);
    } catch (e) {
      console.error("Failed to load audit events:", e);
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getForTask = useCallback(async (taskId: string) => {
    try {
      return await getTaskAuditEvents(taskId);
    } catch (e) {
      console.error("Failed to load task audit events:", e);
      return [];
    }
  }, []);

  return { events, loading, refresh, getForTask };
}
