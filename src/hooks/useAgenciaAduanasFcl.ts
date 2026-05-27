import { useState, useEffect, useCallback } from "react";
import type {
  IAgenciaAduanaFclConfig,
  IFclChargeValues,
} from "../types/agenciaAduanaFcl";
import { DEFAULT_FCL_CONFIG } from "../types/agenciaAduanaFcl";
import { useAuth } from "../auth/AuthContext";

export type { IAgenciaAduanaFclConfig, IFclChargeValues };
export { calculateAduanaChargesFcl } from "../types/agenciaAduanaFcl";

export function useAgenciaAduanasFcl() {
  const { token } = useAuth();
  const [config, setConfig] = useState<IAgenciaAduanaFclConfig>(DEFAULT_FCL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/agencia-aduana-fcl/config");
      if (!res.ok) throw new Error("Error al obtener configuración FCL");
      const data = await res.json();
      setConfig({
        charges: data.charges,
        updatedBy: data.updatedBy,
      });
    } catch (e) {
      console.error("[useAgenciaAduanasFcl] fetch error:", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(
    async (updates: { charges?: Partial<IFclChargeValues> }) => {
      try {
        setSaving(true);
        setError(null);
        const res = await fetch("/api/agencia-aduana-fcl/config", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al guardar");
        }
        const data = await res.json();
        setConfig({
          charges: data.charges,
          updatedBy: data.updatedBy,
        });
      } catch (e) {
        console.error("[useAgenciaAduanasFcl] update error:", e);
        setError((e as Error).message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [token],
  );

  return { config, loading, error, saving, updateConfig, refetch: fetchConfig };
}
