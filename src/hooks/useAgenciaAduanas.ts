import { useState, useEffect, useCallback } from "react";
import type {
  IAgenciaAduanaConfig,
  IExchangeRates,
  IChargeValues,
  SupportedCurrency,
} from "../types/agenciaAduana";
import {
  DEFAULT_CONFIG,
  calculateAduanaCharges,
  ufToCurrency,
} from "../types/agenciaAduana";
import { useAuth } from "../auth/AuthContext";

export type { IAgenciaAduanaConfig, IExchangeRates, IChargeValues, SupportedCurrency };
export { calculateAduanaCharges, ufToCurrency };

export function useAgenciaAduanas() {
  const { token } = useAuth();
  const [config, setConfig] = useState<IAgenciaAduanaConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/agencia-aduana/config");
      if (!res.ok) throw new Error("Error al obtener configuración");
      const data = await res.json();
      setConfig({
        exchangeRates: data.exchangeRates,
        charges: data.charges,
        updatedBy: data.updatedBy,
      });
    } catch (e) {
      console.error("[useAgenciaAduanas] fetch error:", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(
    async (updates: { exchangeRates?: Partial<IExchangeRates>; charges?: Partial<IChargeValues> }) => {
      try {
        setSaving(true);
        setError(null);
        const res = await fetch("/api/agencia-aduana/config", {
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
          exchangeRates: data.exchangeRates,
          charges: data.charges,
          updatedBy: data.updatedBy,
        });
      } catch (e) {
        console.error("[useAgenciaAduanas] update error:", e);
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
