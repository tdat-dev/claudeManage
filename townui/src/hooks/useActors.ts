import { useState, useEffect, useCallback } from "react";
import { ActorInfo, listActors, createActor, deleteActor } from "../lib/tauri";

export function useActors(rigId: string | null) {
  const [actors, setActors] = useState<ActorInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setActors([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listActors(rigId);
      setActors(data);
    } catch (err) {
      console.error("Failed to load actors:", err);
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addActor = async (name: string, role: string, agentType: string) => {
    if (!rigId) return;
    await createActor(name, role, agentType, rigId);
    await refresh();
  };

  const removeActor = async (actorId: string) => {
    await deleteActor(actorId);
    await refresh();
  };

  return { actors, loading, addActor, removeActor, refresh };
}
