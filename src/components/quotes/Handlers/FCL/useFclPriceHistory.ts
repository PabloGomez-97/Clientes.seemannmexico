import { useCallback } from "react";
import {
  buildFclMarketMinSeries,
  GOOGLE_SHEET_FCL_HISTORICAL_CSV_URL,
  parseHistoricalFCL,
} from "./HandlerQuoteFCLHistorical";
import { useOceanPriceHistory } from "../shared/useOceanPriceHistory";

export function useFclPriceHistory(
  polNorm: string | null | undefined,
  podNorm: string | null | undefined,
  refreshToken = 0,
) {
  const buildSeries = useCallback(buildFclMarketMinSeries, []);

  return useOceanPriceHistory(
    GOOGLE_SHEET_FCL_HISTORICAL_CSV_URL,
    polNorm,
    podNorm,
    refreshToken,
    parseHistoricalFCL,
    buildSeries,
  );
}
