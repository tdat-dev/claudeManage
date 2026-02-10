import { useState, useEffect, useCallback } from "react";
import { RigInfo, listRigs, createRig, getRig, deleteRig } from "../lib/tauri";

export function useRigs() {
  const [rigs, setRigs] = useState<RigInfo[]>([]);
  const [selectedRig, setSelectedRig] = useState<RigInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listRigs();
      setRigs(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addRig = useCallback(async (path: string) => {
    try {
      setError(null);
      const rig = await createRig(path);
      setRigs((prev) => [...prev, rig]);
      setSelectedRig(rig);
      return rig;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  const selectRig = useCallback(async (id: string) => {
    try {
      setError(null);
      const rig = await getRig(id);
      setSelectedRig(rig);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const removeRig = useCallback(async (id: string) => {
    try {
      setError(null);
      await deleteRig(id);
      setRigs((prev) => prev.filter((r) => r.id !== id));
      setSelectedRig((prev) => (prev?.id === id ? null : prev));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return { rigs, selectedRig, loading, error, refresh, addRig, selectRig, removeRig };
}
