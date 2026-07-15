import { useCallback, useEffect, useMemo, useState } from "react";
import { parseCSV } from "./HandlerQuoteAir";
import {
  buildMarketMinSeries,
  GOOGLE_SHEET_HISTORICAL_CSV_URL,
  parseHistoricalAEREO,
  type AirPriceHistorySeriesResult,
  type HistoricalAirRow,
} from "./HandlerQuoteAirHistorical";

export function useAirPriceHistory(
  originNorm: string | null | undefined,
  destNorm: string | null | undefined,
  refreshToken = 0,
) {
  const [historicalRows, setHistoricalRows] = useState<HistoricalAirRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistorical = useCallback(async (cacheBust = false) => {
    try {
      setLoading(true);
      setError(null);

      const url = cacheBust
        ? `${GOOGLE_SHEET_HISTORICAL_CSV_URL}&timestamp=${Date.now()}`
        : GOOGLE_SHEET_HISTORICAL_CSV_URL;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Error al cargar histórico: ${response.status} ${response.statusText}`,
        );
      }

      const csvText = await response.text();
      const data = parseCSV(csvText);
      const parsed = parseHistoricalAEREO(data);
      setHistoricalRows(parsed);
    } catch (err) {
      console.error("Error al cargar histórico de precios AIR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el histórico de precios",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistorical(refreshToken > 0);
  }, [loadHistorical, refreshToken]);

  const seriesResult: AirPriceHistorySeriesResult | null = useMemo(() => {
    if (!originNorm || !destNorm || historicalRows.length === 0) {
      return null;
    }
    return buildMarketMinSeries(historicalRows, originNorm, destNorm);
  }, [historicalRows, originNorm, destNorm]);

  const reload = useCallback(() => {
    void loadHistorical(true);
  }, [loadHistorical]);

  return {
    loading,
    error,
    seriesResult,
    reload,
  };
}
