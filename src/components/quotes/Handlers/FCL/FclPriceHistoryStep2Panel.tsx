import { OceanPriceHistoryStep2Panel } from "../shared/OceanPriceHistoryStep2Panel";
import type { FclPriceHistorySeriesResult } from "./HandlerQuoteFCLHistorical";
import { FCL_PRICE_HISTORY_TIERS } from "./FclPriceHistoryModal";

interface FclPriceHistoryStep2PanelProps {
  polLabel: string;
  podLabel: string;
  loading: boolean;
  error: string | null;
  seriesResult: FclPriceHistorySeriesResult | null;
}

export function FclPriceHistoryStep2Panel(props: FclPriceHistoryStep2PanelProps) {
  return (
    <OceanPriceHistoryStep2Panel
      {...props}
      i18nNamespace="Quotefcl"
      tiers={[...FCL_PRICE_HISTORY_TIERS]}
    />
  );
}
