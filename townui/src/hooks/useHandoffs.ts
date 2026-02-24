import { useState, useEffect, useCallback } from "react";
import {
  HandoffInfo,
  listHandoffs,
  createHandoff,
  acceptHandoff,
  rejectHandoff,
  exportHandoff,
  importHandoff,
} from "../lib/tauri";

export function useHandoffs(rigId: string | null) {
  const [handoffs, setHandoffs] = useState<HandoffInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setHandoffs([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await listHandoffs(rigId);
      setHandoffs(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addHandoff = useCallback(
    async (
      fromActorId: string,
      toActorId: string,
      workItemId: string,
      contextSummary: string,
      blockers: string[],
      nextSteps: string[],
    ) => {
      if (!rigId) return;
      try {
        setError(null);
        const created = await createHandoff(
          rigId,
          fromActorId,
          toActorId,
          workItemId,
          contextSummary,
          blockers,
          nextSteps,
        );
        setHandoffs((prev) => [created, ...prev]);
        return created;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [rigId],
  );

  const accept = useCallback(
    async (handoffId: string, acceptedByActorId?: string) => {
      try {
        setError(null);
        const updated = await acceptHandoff(handoffId, acceptedByActorId);
        setHandoffs((prev) =>
          prev.map((h) => (h.handoff_id === handoffId ? updated : h)),
        );
        return updated;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [],
  );

  const reject = useCallback(
    async (handoffId: string, reason?: string) => {
      try {
        setError(null);
        const updated = await rejectHandoff(handoffId, reason);
        setHandoffs((prev) =>
          prev.map((h) => (h.handoff_id === handoffId ? updated : h)),
        );
        return updated;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [],
  );

  const doExport = useCallback(
    async (handoffId: string) => {
      try {
        setError(null);
        return await exportHandoff(handoffId);
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [],
  );

  const doImport = useCallback(
    async (jsonData: string) => {
      if (!rigId) return;
      try {
        setError(null);
        const created = await importHandoff(rigId, jsonData);
        setHandoffs((prev) => [created, ...prev]);
        return created;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [rigId],
  );

  return {
    handoffs,
    loading,
    error,
    refresh,
    addHandoff,
    accept,
    reject,
    doExport,
    doImport,
  };
}
