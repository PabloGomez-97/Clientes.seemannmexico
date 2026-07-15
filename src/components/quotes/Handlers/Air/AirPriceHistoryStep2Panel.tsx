import { AirPriceHistoryCharts } from "./AirPriceHistoryCharts";
import type { AirPriceHistorySeriesResult } from "./HandlerQuoteAirHistorical";

interface AirPriceHistoryStep2PanelProps {
  originLabel: string;
  destinationLabel: string;
  loading: boolean;
  error: string | null;
  seriesResult: AirPriceHistorySeriesResult | null;
}

export function AirPriceHistoryStep2Panel({
  originLabel,
  destinationLabel,
  loading,
  error,
  seriesResult,
}: AirPriceHistoryStep2PanelProps) {
  return (
    <div className="cotizador-history-panel" aria-label="Tendencia de precios">
      <header className="cotizador-history-panel__header">
        <h2 className="cotizador-history-panel__title">Tendencia de precios estimada</h2>
        <p className="cotizador-history-panel__route">
          {originLabel} → {destinationLabel}
        </p>
      </header>
      <div className="cotizador-history-panel__body">
        <AirPriceHistoryCharts
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
