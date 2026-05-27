import { useState, useEffect, useCallback } from "react";
import type {
  IAgenciaAduanaLclConfig,
  ILclChargeValues,
} from "../types/agenciaAduanaLcl";
import { DEFAULT_LCL_CONFIG } from "../types/agenciaAduanaLcl";
import { useAuth } from "../auth/AuthContext";

export type { IAgenciaAduanaLclConfig, ILclChargeValues };
export { calculateAduanaChargesLcl, DESPACHO_SUELTA_IVA_PCT } from "../types/agenciaAduanaLcl";

export function useAgenciaAduanasLcl() {
  const { token } = useAuth();
  const [config, setConfig] = useState<IAgenciaAduanaLclConfig>(DEFAULT_LCL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/agencia-aduana-lcl/config");
      if (!res.ok) throw new Error("Error al obtener configuración LCL");
      const data = await res.json();
      setConfig({
        charges: data.charges,
        updatedBy: data.updatedBy,
      });
    } catch (e) {
      console.error("[useAgenciaAduanasLcl] fetch error:", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(
    async (updates: { charges?: Partial<ILclChargeValues> }) => {
      try {
        setSaving(true);
        setError(null);
        const res = await fetch("/api/agencia-aduana-lcl/config", {
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
        console.error("[useAgenciaAduanasLcl] update error:", e);
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
