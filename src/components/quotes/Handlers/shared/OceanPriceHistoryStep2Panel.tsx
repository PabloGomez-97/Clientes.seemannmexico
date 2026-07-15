import {
  PriceHistoryCharts,
  type PriceHistoryTierConfig,
} from "./PriceHistoryCharts";
import type { PriceHistorySeriesResult } from "./priceHistoryTypes";

interface OceanPriceHistoryStep2PanelProps {
  polLabel: string;
  podLabel: string;
  loading: boolean;
  error: string | null;
  seriesResult: PriceHistorySeriesResult | null;
  i18nNamespace: string;
  tiers: PriceHistoryTierConfig[];
}

export function OceanPriceHistoryStep2Panel({
  polLabel,
  podLabel,
  loading,
  error,
  seriesResult,
  i18nNamespace,
  tiers,
}: OceanPriceHistoryStep2PanelProps) {
  return (
    <div className="cotizador-history-panel" aria-label="Tendencia de precios">
      <header className="cotizador-history-panel__header">
        <h2 className="cotizador-history-panel__title">Tendencia de precios estimada</h2>
        <p className="cotizador-history-panel__route">
          {polLabel} → {podLabel}
        </p>
      </header>
      <div className="cotizador-history-panel__body">
        <PriceHistoryCharts
          i18nNamespace={i18nNamespace}
          tiers={tiers}
          loading={loading}
          error={error}
          seriesResult={seriesResult}
          embedded
          layout="stack"
        />
      </div>
    </div>
  );
}
