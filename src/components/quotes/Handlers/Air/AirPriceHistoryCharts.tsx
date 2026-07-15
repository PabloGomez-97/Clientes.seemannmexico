import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AIR_WEIGHT_TIERS,
  type AirPriceHistorySeriesResult,
  type AirWeightTier,
} from "./HandlerQuoteAirHistorical";
import type { Currency } from "./HandlerQuoteAir";

interface AirPriceHistoryChartsProps {
  loading: boolean;
  error: string | null;
  seriesResult: AirPriceHistorySeriesResult | null;
  /** Sin borde ni título de sección (contenido dentro del modal). */
  embedded?: boolean;
  /** Una columna apilada (panel lateral paso 2). */
  layout?: "grid" | "stack";
}

const TIER_I18N_KEY: Record<AirWeightTier, string> = {
  kg45: "priceHistoryTier45",
  kg100: "priceHistoryTier100",
  kg300: "priceHistoryTier300",
  kg500: "priceHistoryTier500",
  kg1000: "priceHistoryTier1000",
};

const CHART_COLOR = "#6366f1";

function formatPrice(value: number, currency: Currency): string {
  return `${currency} ${value.toFixed(2)}`;
}

function makePriceHistoryTooltip(currency: Currency) {
  return function PriceHistoryTooltip({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value?: number; payload?: { label?: string } }>;
  }) {
    if (!active || !payload?.length) return null;
    const point = payload[0];
    const label = point.payload?.label ?? "";
    const value = point.value ?? 0;

    return (
      <div className="qa-price-history-tooltip">
        <div className="qa-price-history-tooltip-label">{label}</div>
        <div className="qa-price-history-tooltip-value">
          {formatPrice(value, currency)}
        </div>
      </div>
    );
  };
}

function TierChart({
  tier,
  data,
  currency,
  limited,
  chartHeight,
}: {
  tier: AirWeightTier;
  data: { label: string; value: number }[];
  currency: Currency;
  limited: boolean;
  chartHeight: number;
}) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <div className="qa-price-history-panel qa-price-history-panel--empty">
        <div className="qa-price-history-panel-title">
          {t(`QuoteAIR.${TIER_I18N_KEY[tier]}`)}
        </div>
        <p className="qa-price-history-empty-tier">
          {t("QuoteAIR.priceHistoryNoTierData")}
        </p>
      </div>
    );
  }

  return (
    <div className="qa-price-history-panel">
      <div className="qa-price-history-panel-title">
        {t(`QuoteAIR.${TIER_I18N_KEY[tier]}`)}
        <span className="qa-price-history-panel-currency">{currency}</span>
      </div>
      {limited && (
        <p className="qa-price-history-limited">
          {t("QuoteAIR.priceHistoryLimited")}
        </p>
      )}
      <div className="qa-price-history-chart-wrap">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              interval="preserveStartEnd"
              tickMargin={6}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              width={44}
              tickFormatter={(v) => Number(v).toFixed(1)}
            />
            <Tooltip content={makePriceHistoryTooltip(currency)} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={CHART_COLOR}
              strokeWidth={2}
              dot={{ r: data.length === 1 ? 4 : 3, fill: CHART_COLOR }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AirPriceHistoryCharts({
  loading,
  error,
  seriesResult,
  embedded = false,
  layout = "grid",
}: AirPriceHistoryChartsProps) {
  const { t } = useTranslation();
  const isStack = layout === "stack";
  const chartHeight = isStack ? 140 : embedded ? 200 : 160;
  const wrapClass = embedded
    ? "qa-price-history-embedded"
    : "qa-price-history-section";
  const gridClass = isStack
    ? "qa-price-history-grid qa-price-history-grid--stack"
    : "qa-price-history-grid";
  const skeletonClass = isStack
    ? "qa-price-history-skeleton-grid qa-price-history-skeleton-grid--stack"
    : "qa-price-history-skeleton-grid";

  if (loading) {
    return (
      <div className={wrapClass}>
        <div className={skeletonClass}>
          {AIR_WEIGHT_TIERS.map((tier) => (
            <div key={tier} className="qa-price-history-skeleton-panel" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={wrapClass}>
        <p className="qa-price-history-message qa-price-history-message--error">
          {t("QuoteAIR.priceHistoryError")}
        </p>
      </div>
    );
  }

  if (!seriesResult || seriesResult.rowCount === 0) {
    return (
      <div className={wrapClass}>
        <p className="qa-price-history-message">
          {t("QuoteAIR.priceHistoryEmpty")}
        </p>
      </div>
    );
  }

  const { seriesByTier, dominantCurrency, hasMixedCurrencies } = seriesResult;
  const hasAnyData = AIR_WEIGHT_TIERS.some(
    (tier) => seriesByTier[tier].length > 0,
  );

  if (!hasAnyData) {
    return (
      <div className={wrapClass}>
        <p className="qa-price-history-message">
          {t("QuoteAIR.priceHistoryEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      {hasMixedCurrencies && (
        <div className="qa-price-history-header qa-price-history-header--compact mb-2">
          <span className="qa-price-history-mixed-badge">
            {t("QuoteAIR.priceHistoryMixedCurrency")}
          </span>
        </div>
      )}

      <div className={gridClass}>
        {AIR_WEIGHT_TIERS.map((tier) => {
          const points = seriesByTier[tier];
          const chartData = points.map((p) => ({
            label: p.label,
            value: p.value,
          }));
          return (
            <TierChart
              key={tier}
              tier={tier}
              data={chartData}
              currency={dominantCurrency}
              limited={points.length < 2}
              chartHeight={chartHeight}
            />
          );
        })}
      </div>
    </div>
  );
}
