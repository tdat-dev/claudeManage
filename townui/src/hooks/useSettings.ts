import { useState, useEffect, useCallback } from "react";
import { AppSettings, getSettings, updateSettings, validateCliPath } from "../lib/tauri";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSettings();
      setSettings(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (newSettings: AppSettings) => {
    try {
      setSaving(true);
      setError(null);
      await updateSettings(newSettings);
      setSettings(newSettings);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const validatePath = useCallback(async (path: string): Promise<string> => {
    return validateCliPath(path);
  }, []);

  return { settings, loading, saving, error, refresh, save, validatePath };
}
