import { OceanPriceHistoryStep2Panel } from "../shared/OceanPriceHistoryStep2Panel";
import type { LclPriceHistorySeriesResult } from "./HandlerQuoteLCLHistorical";
import { LCL_PRICE_HISTORY_TIERS } from "./LclPriceHistoryModal";

interface LclPriceHistoryStep2PanelProps {
  polLabel: string;
  podLabel: string;
  loading: boolean;
  error: string | null;
  seriesResult: LclPriceHistorySeriesResult | null;
}

export function LclPriceHistoryStep2Panel(props: LclPriceHistoryStep2PanelProps) {
  return (
    <OceanPriceHistoryStep2Panel
      {...props}
      i18nNamespace="Quotelcl"
      tiers={[...LCL_PRICE_HISTORY_TIERS]}
    />
  );
}
