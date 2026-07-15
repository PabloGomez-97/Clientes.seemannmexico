import type { PriceHistoryCurrency, PriceHistoryPoint, PriceHistorySeriesResult } from "./priceHistoryTypes";

export const CURRENT_PRICE_HISTORY_LABEL = "Actual";

function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function mergeCurrentRatesIntoPriceHistory<TTier extends string>(
  series: PriceHistorySeriesResult<TTier> | null,
  tiers: readonly TTier[],
  currentByTier: Partial<Record<TTier, number>>,
  options?: {
    currentCurrency?: PriceHistoryCurrency;
    currentRowCount?: number;
  },
): PriceHistorySeriesResult<TTier> | null {
  const hasCurrent = tiers.some((tier) => (currentByTier[tier] ?? 0) > 0);
  if (!series && !hasCurrent) {
    return null;
  }

  const todayKey = todayDateKey();
  const currentPoint = (value: number): PriceHistoryPoint => ({
    dateKey: todayKey,
    label: CURRENT_PRICE_HISTORY_LABEL,
    value,
  });

  const base: PriceHistorySeriesResult<TTier> = series ?? {
    seriesByTier: Object.fromEntries(
      tiers.map((tier) => [tier, [] as PriceHistoryPoint[]]),
    ) as Record<TTier, PriceHistoryPoint[]>,
    dominantCurrency: options?.currentCurrency ?? "USD",
    hasMixedCurrencies: false,
    rowCount: 0,
  };

  const seriesByTier = { ...base.seriesByTier };

  for (const tier of tiers) {
    const value = currentByTier[tier];
    if (!value || value <= 0) continue;

    const points = [...(seriesByTier[tier] ?? [])];
    const idx = points.findIndex((p) => p.dateKey === todayKey);
    const next = currentPoint(value);
    if (idx >= 0) {
      points[idx] = next;
    } else {
      points.push(next);
    }
    points.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    seriesByTier[tier] = points;
  }

  const hasAnyData = tiers.some((tier) => (seriesByTier[tier]?.length ?? 0) > 0);

  if (!hasAnyData) {
    return series;
  }

  return {
    ...base,
    seriesByTier,
    rowCount: base.rowCount + (options?.currentRowCount ?? 0),
    ...(options?.currentCurrency && !series
      ? { dominantCurrency: options.currentCurrency }
      : {}),
  };
}
