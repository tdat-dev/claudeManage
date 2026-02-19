import { useState, useEffect, useCallback } from "react";
import { CrewInfo, listCrews, createCrew, deleteCrew, listBranches } from "../lib/tauri";

export function useCrews(rigId: string | null) {
  const [crews, setCrews] = useState<CrewInfo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rigId) {
      setCrews([]);
      setBranches([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [crewData, branchData] = await Promise.all([
        listCrews(rigId),
        listBranches(rigId),
      ]);
      setCrews(crewData);
      setBranches(branchData);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCrew = useCallback(async (name: string, baseBranch: string) => {
    if (!rigId) return;
    try {
      setError(null);
      const crew = await createCrew(rigId, name, baseBranch);
      setCrews((prev) => [...prev, crew]);
      return crew;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, [rigId]);

  const removeCrew = useCallback(async (id: string) => {
    try {
      setError(null);
      await deleteCrew(id);
      setCrews((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return { crews, branches, loading, error, refresh, addCrew, removeCrew };
}
