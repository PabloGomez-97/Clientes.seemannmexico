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
import type {
  PriceHistoryCurrency,
  PriceHistorySeriesResult,
} from "./priceHistoryTypes";

export interface PriceHistoryTierConfig {
  tier: string;
  labelKey: string;
}

interface PriceHistoryChartsProps {
  i18nNamespace: string;
  tiers: PriceHistoryTierConfig[];
  loading: boolean;
  error: string | null;
  seriesResult: PriceHistorySeriesResult | null;
  embedded?: boolean;
  /** Una columna apilada (panel lateral paso 2). */
  layout?: "grid" | "stack";
}

const CHART_COLOR = "#6366f1";

function formatPrice(value: number, currency: PriceHistoryCurrency): string {
  return `${currency} ${value.toFixed(2)}`;
}

function makePriceHistoryTooltip(currency: PriceHistoryCurrency) {
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
  i18nNamespace,
  labelKey,
  data,
  currency,
  limited,
  chartHeight,
}: {
  i18nNamespace: string;
  labelKey: string;
  data: { label: string; value: number }[];
  currency: PriceHistoryCurrency;
  limited: boolean;
  chartHeight: number;
}) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <div className="qa-price-history-panel qa-price-history-panel--empty">
        <div className="qa-price-history-panel-title">
          {t(`${i18nNamespace}.${labelKey}`)}
        </div>
        <p className="qa-price-history-empty-tier">
          {t(`${i18nNamespace}.priceHistoryNoTierData`)}
        </p>
      </div>
    );
  }

  return (
    <div className="qa-price-history-panel">
      <div className="qa-price-history-panel-title">
        {t(`${i18nNamespace}.${labelKey}`)}
        <span className="qa-price-history-panel-currency">{currency}</span>
      </div>
      {limited && (
        <p className="qa-price-history-limited">
          {t(`${i18nNamespace}.priceHistoryLimited`)}
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

export function PriceHistoryCharts({
  i18nNamespace,
  tiers,
  loading,
  error,
  seriesResult,
  embedded = false,
  layout = "grid",
}: PriceHistoryChartsProps) {
  const { t } = useTranslation();
  const isStack = layout === "stack";
  const chartHeight = isStack ? 140 : embedded ? 200 : 160;
  const wrapClass = embedded
    ? "qa-price-history-embedded"
    : "qa-price-history-section";
  const gridClass = isStack
    ? "qa-price-history-grid qa-price-history-grid--stack"
    : `qa-price-history-grid${tiers.length === 1 ? " qa-price-history-grid--single" : ""}`;
  const skeletonClass = isStack
    ? "qa-price-history-skeleton-grid qa-price-history-skeleton-grid--stack"
    : "qa-price-history-skeleton-grid";

  if (loading) {
    return (
      <div className={wrapClass}>
        <div className={skeletonClass}>
          {tiers.map(({ tier }) => (
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
          {t(`${i18nNamespace}.priceHistoryError`)}
        </p>
      </div>
    );
  }

  if (!seriesResult || seriesResult.rowCount === 0) {
    return (
      <div className={wrapClass}>
        <p className="qa-price-history-message">
          {t(`${i18nNamespace}.priceHistoryEmpty`)}
        </p>
      </div>
    );
  }

  const { seriesByTier, dominantCurrency, hasMixedCurrencies } = seriesResult;
  const hasAnyData = tiers.some(({ tier }) => seriesByTier[tier]?.length > 0);

  if (!hasAnyData) {
    return (
      <div className={wrapClass}>
        <p className="qa-price-history-message">
          {t(`${i18nNamespace}.priceHistoryEmpty`)}
        </p>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      {hasMixedCurrencies && (
        <div className="qa-price-history-header qa-price-history-header--compact mb-2">
          <span className="qa-price-history-mixed-badge">
            {t(`${i18nNamespace}.priceHistoryMixedCurrency`)}
          </span>
        </div>
      )}

      <div className={gridClass}>
        {tiers.map(({ tier, labelKey }) => {
          const points = seriesByTier[tier] ?? [];
          const chartData = points.map((p) => ({
            label: p.label,
            value: p.value,
          }));
          return (
            <TierChart
              key={tier}
              i18nNamespace={i18nNamespace}
              labelKey={labelKey}
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
