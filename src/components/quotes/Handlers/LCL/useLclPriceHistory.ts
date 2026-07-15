import { useCallback } from "react";
import {
  buildLclMarketMinSeries,
  GOOGLE_SHEET_LCL_HISTORICAL_CSV_URL,
  parseHistoricalLCL,
} from "./HandlerQuoteLCLHistorical";
import { useOceanPriceHistory } from "../shared/useOceanPriceHistory";

export function useLclPriceHistory(
  polNorm: string | null | undefined,
  podNorm: string | null | undefined,
  refreshToken = 0,
) {
  const buildSeries = useCallback(buildLclMarketMinSeries, []);

  return useOceanPriceHistory(
    GOOGLE_SHEET_LCL_HISTORICAL_CSV_URL,
    polNorm,
    podNorm,
    refreshToken,
    parseHistoricalLCL,
    buildSeries,
  );
}
