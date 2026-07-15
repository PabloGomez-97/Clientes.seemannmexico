import { PriceHistoryModal } from "../shared/PriceHistoryModal";
import type { LclPriceHistorySeriesResult } from "./HandlerQuoteLCLHistorical";

export const LCL_PRICE_HISTORY_TIERS = [
  { tier: "ofWM", labelKey: "priceHistoryTierWM" },
] as const;

interface LclPriceHistoryModalProps {
  polLabel: string;
  podLabel: string;
  loading: boolean;
  error: string | null;
  seriesResult: LclPriceHistorySeriesResult | null;
}

export function LclPriceHistoryModal({
  polLabel,
  podLabel,
  loading,
  error,
  seriesResult,
}: LclPriceHistoryModalProps) {
  return (
    <PriceHistoryModal
      i18nNamespace="Quotelcl"
      originLabel={polLabel}
      destinationLabel={podLabel}
      tiers={[...LCL_PRICE_HISTORY_TIERS]}
      loading={loading}
      error={error}
      seriesResult={seriesResult}
    />
  );
}
