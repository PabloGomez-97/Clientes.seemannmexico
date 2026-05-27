import { useState, useEffect, useCallback } from "react";
import type {
  IGestionCotizadorConfig,
  IFclCotizadorConfig,
  ILclCotizadorConfig,
  ILclDeliveryBracket,
  IAereoCotizadorConfig,
  IAereoTtBracket,
} from "../types/gestionCotizador";
import { DEFAULT_GESTION_COTIZADOR_CONFIG } from "../types/gestionCotizador";
import { useAuth } from "../auth/AuthContext";

export type {
  IGestionCotizadorConfig,
  IFclCotizadorConfig,
  ILclCotizadorConfig,
  ILclDeliveryBracket,
  IAereoCotizadorConfig,
  IAereoTtBracket,
};
export {
  DEFAULT_GESTION_COTIZADOR_CONFIG,
  getFclTtRate,
  getVespucioExtendedMultiplier,
  findLclDeliveryBracket,
  lclDeliveryExpenseFromIncome,
  findAereoTtBracket,
  aereoTtExpenseFromIncome,
  isAirUltimaMillaEligibleDestination,
  LCL_DELIVERY_EXPENSE_DIVISOR,
} from "../types/gestionCotizador";

function normalizeConfig(data: Record<string, unknown>): IGestionCotizadorConfig {
  const fclRaw = data.fcl as Partial<IFclCotizadorConfig> | undefined;
  const lclRaw = data.lcl as Partial<ILclCotizadorConfig> | undefined;
  const aereoRaw = data.aereo as Partial<IAereoCotizadorConfig> | undefined;
  return {
    fcl: {
      ttRate20GP:
        fclRaw?.ttRate20GP ?? DEFAULT_GESTION_COTIZADOR_CONFIG.fcl.ttRate20GP,
      ttRate40: fclRaw?.ttRate40 ?? DEFAULT_GESTION_COTIZADOR_CONFIG.fcl.ttRate40,
      vespucioExtendedSurchargePct:
        fclRaw?.vespucioExtendedSurchargePct ??
        DEFAULT_GESTION_COTIZADOR_CONFIG.fcl.vespucioExtendedSurchargePct,
    },
    lcl: {
      brackets:
        Array.isArray(lclRaw?.brackets) && lclRaw.brackets.length > 0
          ? lclRaw.brackets
          : DEFAULT_GESTION_COTIZADOR_CONFIG.lcl.brackets,
      maxKg: lclRaw?.maxKg ?? DEFAULT_GESTION_COTIZADOR_CONFIG.lcl.maxKg,
      maxM3: lclRaw?.maxM3 ?? DEFAULT_GESTION_COTIZADOR_CONFIG.lcl.maxM3,
      vespucioExtendedSurchargePct:
        lclRaw?.vespucioExtendedSurchargePct ??
        DEFAULT_GESTION_COTIZADOR_CONFIG.lcl.vespucioExtendedSurchargePct,
    },
    aereo: {
      brackets:
        Array.isArray(aereoRaw?.brackets) && aereoRaw.brackets.length > 0
          ? aereoRaw.brackets
          : DEFAULT_GESTION_COTIZADOR_CONFIG.aereo.brackets,
      maxKg: aereoRaw?.maxKg ?? DEFAULT_GESTION_COTIZADOR_CONFIG.aereo.maxKg,
      vespucioExtendedSurchargePct:
        aereoRaw?.vespucioExtendedSurchargePct ??
        DEFAULT_GESTION_COTIZADOR_CONFIG.aereo.vespucioExtendedSurchargePct,
    },
    updatedBy: (data.updatedBy as string) ?? "system",
  };
}

export function useGestionCotizador() {
  const { token } = useAuth();
  const [config, setConfig] = useState<IGestionCotizadorConfig>(
    DEFAULT_GESTION_COTIZADOR_CONFIG,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/gestion-cotizador/config");
      if (!res.ok) throw new Error("Error al obtener configuración del cotizador");
      const data = await res.json();
      setConfig(normalizeConfig(data));
    } catch (e) {
      console.error("[useGestionCotizador] fetch error:", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const putConfig = useCallback(
    async (body: {
      fcl?: Partial<IFclCotizadorConfig>;
      lcl?: Partial<ILclCotizadorConfig>;
      aereo?: Partial<IAereoCotizadorConfig>;
    }) => {
      const res = await fetch("/api/gestion-cotizador/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }
      const data = await res.json();
      setConfig(normalizeConfig(data));
    },
    [token],
  );

  const updateFcl = useCallback(
    async (updates: Partial<IFclCotizadorConfig>) => {
      try {
        setSaving(true);
        setError(null);
        await putConfig({ fcl: updates });
      } catch (e) {
        console.error("[useGestionCotizador] update FCL error:", e);
        setError((e as Error).message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [putConfig],
  );

  const updateLcl = useCallback(
    async (updates: Partial<ILclCotizadorConfig>) => {
      try {
        setSaving(true);
        setError(null);
        await putConfig({ lcl: updates });
      } catch (e) {
        console.error("[useGestionCotizador] update LCL error:", e);
        setError((e as Error).message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [putConfig],
  );

  const updateAereo = useCallback(
    async (updates: Partial<IAereoCotizadorConfig>) => {
      try {
        setSaving(true);
        setError(null);
        await putConfig({ aereo: updates });
      } catch (e) {
        console.error("[useGestionCotizador] update AÉREO error:", e);
        setError((e as Error).message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [putConfig],
  );

  return {
    config,
    loading,
    error,
    saving,
    updateFcl,
    updateLcl,
    updateAereo,
    refetch: fetchConfig,
  };
}
