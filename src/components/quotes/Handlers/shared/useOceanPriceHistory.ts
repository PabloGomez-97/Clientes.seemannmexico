import { useCallback, useEffect, useMemo, useState } from "react";
import { parseCSV } from "../FCL/HandlerQuoteFCL";
import type { PriceHistorySeriesResult } from "./priceHistoryTypes";

export function useOceanPriceHistory<TRow, TTier extends string>(
  csvUrl: string,
  originNorm: string | null | undefined,
  destNorm: string | null | undefined,
  refreshToken: number,
  parseRows: (data: string[][]) => TRow[],
  buildSeries: (
    rows: TRow[],
    originNorm: string,
    destNorm: string,
  ) => PriceHistorySeriesResult<TTier>,
) {
  const [historicalRows, setHistoricalRows] = useState<TRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistorical = useCallback(
    async (cacheBust = false) => {
      try {
        setLoading(true);
        setError(null);

        const url = cacheBust
          ? `${csvUrl}&timestamp=${Date.now()}`
          : csvUrl;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Error al cargar histórico: ${response.status} ${response.statusText}`,
          );
        }

        const csvText = await response.text();
        const data = parseCSV(csvText);
        setHistoricalRows(parseRows(data));
      } catch (err) {
        console.error("Error al cargar histórico de precios:", err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el histórico de precios",
        );
      } finally {
        setLoading(false);
      }
    },
    [csvUrl, parseRows],
  );

  useEffect(() => {
    void loadHistorical(refreshToken > 0);
  }, [loadHistorical, refreshToken]);

  const seriesResult = useMemo(() => {
    if (!originNorm || !destNorm || historicalRows.length === 0) {
      return null;
    }
    return buildSeries(historicalRows, originNorm, destNorm);
  }, [historicalRows, originNorm, destNorm, buildSeries]);

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
