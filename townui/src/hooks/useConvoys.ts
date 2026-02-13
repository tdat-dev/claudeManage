import { useState, useEffect, useCallback } from "react";
import {
  ConvoyInfo,
  ConvoyStatus,
  listConvoys,
  createConvoy,
  addItemToConvoy,
  updateConvoyStatus,
} from "../lib/tauri";

export function useConvoys() {
  const [convoys, setConvoys] = useState<ConvoyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listConvoys();
      setConvoys(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addConvoy = useCallback(
    async (title: string, description: string, rigIds: string[]) => {
      const convoy = await createConvoy(title, description, rigIds);
      await refresh();
      return convoy;
    },
    [refresh],
  );

  const addItem = useCallback(
    async (convoyId: string, workItemId: string) => {
      const convoy = await addItemToConvoy(convoyId, workItemId);
      await refresh();
      return convoy;
    },
    [refresh],
  );

  const changeStatus = useCallback(
    async (convoyId: string, status: ConvoyStatus) => {
      const convoy = await updateConvoyStatus(convoyId, status);
      await refresh();
      return convoy;
    },
    [refresh],
  );

  return { convoys, loading, error, refresh, addConvoy, addItem, changeStatus };
}
