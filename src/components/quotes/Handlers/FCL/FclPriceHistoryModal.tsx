import { PriceHistoryModal } from "../shared/PriceHistoryModal";
import type { FclPriceHistorySeriesResult } from "./HandlerQuoteFCLHistorical";

export const FCL_PRICE_HISTORY_TIERS = [
  { tier: "gp20", labelKey: "priceHistoryTier20GP" },
  { tier: "hq40", labelKey: "priceHistoryTier40HQ" },
  { tier: "nor40", labelKey: "priceHistoryTier40NOR" },
] as const;

interface FclPriceHistoryModalProps {
  polLabel: string;
  podLabel: string;
  loading: boolean;
  error: string | null;
  seriesResult: FclPriceHistorySeriesResult | null;
}

export function FclPriceHistoryModal({
  polLabel,
  podLabel,
  loading,
  error,
  seriesResult,
}: FclPriceHistoryModalProps) {
  return (
    <PriceHistoryModal
      i18nNamespace="Quotefcl"
      originLabel={polLabel}
      destinationLabel={podLabel}
      tiers={[...FCL_PRICE_HISTORY_TIERS]}
      loading={loading}
      error={error}
      seriesResult={seriesResult}
    />
  );
}
