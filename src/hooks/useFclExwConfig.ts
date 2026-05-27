import { useCallback, useEffect, useState } from "react";
import type { IFclExwConfig } from "../types/fclExwConfig";
import { DEFAULT_FCL_EXW_CONFIG } from "../types/fclExwConfig";
import { useAuth } from "../auth/AuthContext";

function normalizeConfig(data: Record<string, unknown>): IFclExwConfig {
  return {
    exwRate20GP:
      (data.exwRate20GP as number) ?? DEFAULT_FCL_EXW_CONFIG.exwRate20GP,
    exwRate40: (data.exwRate40 as number) ?? DEFAULT_FCL_EXW_CONFIG.exwRate40,
    updatedBy: (data.updatedBy as string) ?? "system",
  };
}

export function useFclExwConfig() {
  const { token } = useAuth();
  const [config, setConfig] = useState<IFclExwConfig>(DEFAULT_FCL_EXW_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/fcl-exw/config");
      if (!res.ok)
        throw new Error("Error al obtener configuración EXW FCL");
      const data = await res.json();
      setConfig(normalizeConfig(data));
    } catch (e) {
      console.error("[useFclExwConfig] fetch error:", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateExw = useCallback(
    async (updates: Partial<Pick<IFclExwConfig, "exwRate20GP" | "exwRate40">>) => {
      const res = await fetch("/api/fcl-exw/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exw: updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar");
      }
      const data = await res.json();
      setConfig(normalizeConfig(data));
    },
    [token],
  );

  const save = useCallback(
    async (updates: Partial<Pick<IFclExwConfig, "exwRate20GP" | "exwRate40">>) => {
      try {
        setSaving(true);
        setError(null);
        await updateExw(updates);
      } catch (e) {
        console.error("[useFclExwConfig] update error:", e);
        setError((e as Error).message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [updateExw],
  );

  return { config, loading, error, saving, updateExw: save, refetch: fetchConfig };
}

