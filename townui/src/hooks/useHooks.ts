import { useState, useEffect, useCallback } from "react";
import {
  HookInfo,
  listHooks,
  createHook,
  deleteHook,
  assignToHook,
  sling,
  doneHook,
  resumeHook,
} from "../lib/tauri";

export function useHooks(rigId: string | null) {
  const [hooks, setHooks] = useState<HookInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setHooks([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await listHooks(rigId);
      setHooks(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addHook = useCallback(
    async (attachedActorId: string) => {
      if (!rigId) return;
      try {
        setError(null);
        const created = await createHook(rigId, attachedActorId);
        setHooks((prev) => [created, ...prev]);
        return created;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [rigId],
  );

  const assign = useCallback(
    async (hookId: string, workItemId: string, stateBlob?: string) => {
      try {
        setError(null);
        const updated = await assignToHook(hookId, workItemId, stateBlob);
        setHooks((prev) =>
          prev.map((h) => (h.hook_id === hookId ? updated : h)),
        );
        return updated;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [],
  );

  const slingNow = useCallback(
    async (hookId: string, workItemId: string, stateBlob?: string) => {
      try {
        setError(null);
        const updated = await sling(hookId, workItemId, stateBlob);
        setHooks((prev) =>
          prev.map((h) => (h.hook_id === hookId ? updated : h)),
        );
        return updated;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [],
  );

  const done = useCallback(async (hookId: string, outcome?: string) => {
    try {
      setError(null);
      const updated = await doneHook(hookId, outcome);
      setHooks((prev) => prev.map((h) => (h.hook_id === hookId ? updated : h)));
      return updated;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  const resume = useCallback(async (hookId: string) => {
    try {
      setError(null);
      const updated = await resumeHook(hookId);
      setHooks((prev) => prev.map((h) => (h.hook_id === hookId ? updated : h)));
      return updated;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  const remove = useCallback(async (hookId: string) => {
    try {
      setError(null);
      await deleteHook(hookId);
      setHooks((prev) => prev.filter((h) => h.hook_id !== hookId));
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  return {
    hooks,
    loading,
    error,
    refresh,
    addHook,
    assign,
    slingNow,
    done,
    resume,
    remove,
  };
}
