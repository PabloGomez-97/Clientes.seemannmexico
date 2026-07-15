import {
  formatValidUntilDisplay,
  parseValidUntilToDate,
} from "../handlerFechas";
import type {
  HistoricalOceanRow,
  PriceHistoryCurrency,
  PriceHistoryPoint,
  PriceHistorySeriesResult,
} from "./priceHistoryTypes";

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveDominantCurrency<TTier extends string>(
  filtered: HistoricalOceanRow<TTier>[],
): { currency: PriceHistoryCurrency; hasMixed: boolean } {
  if (filtered.length === 0) {
    return { currency: "USD", hasMixed: false };
  }

  const counts = new Map<PriceHistoryCurrency, number>();
  for (const row of filtered) {
    counts.set(row.currency, (counts.get(row.currency) || 0) + 1);
  }

  let dominant: PriceHistoryCurrency = "USD";
  let max = 0;
  for (const [cur, count] of counts) {
    if (count > max) {
      max = count;
      dominant = cur;
    }
  }

  return { currency: dominant, hasMixed: counts.size > 1 };
}

export function buildPriceHistoryMarketMinSeries<TTier extends string>(
  rows: HistoricalOceanRow<TTier>[],
  tiers: readonly TTier[],
  polNorm: string,
  podNorm: string,
  markup: number,
  rowMatches: (row: HistoricalOceanRow<TTier>) => boolean,
  extractPrice: (raw: string | null) => number,
): PriceHistorySeriesResult<TTier> {
  const filtered = rows.filter(rowMatches);

  const { currency: dominantCurrency, hasMixed: hasMixedCurrencies } =
    resolveDominantCurrency(filtered);

  const buckets = Object.fromEntries(
    tiers.map((tier) => [tier, new Map<string, { label: string; value: number }>()]),
  ) as Record<TTier, Map<string, { label: string; value: number }>>;

  for (const row of filtered) {
    const date = parseValidUntilToDate(row.validUntil);
    if (!date) continue;

    const dateKey = dateToKey(date);
    const label = formatValidUntilDisplay(row.validUntil);

    for (const tier of tiers) {
      const price = extractPrice(row.prices[tier]) * markup;
      if (price <= 0) continue;

      const tierMap = buckets[tier];
      const existing = tierMap.get(dateKey);
      if (!existing || price < existing.value) {
        tierMap.set(dateKey, { label, value: price });
      }
    }
  }

  const seriesByTier = {} as Record<TTier, PriceHistoryPoint[]>;

  for (const tier of tiers) {
    seriesByTier[tier] = Array.from(buckets[tier].entries())
      .map(([dateKey, { label, value }]) => ({ dateKey, label, value }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  return {
    seriesByTier,
    dominantCurrency,
    hasMixedCurrencies,
    rowCount: filtered.length,
  };
}

export function historicalPodMatchesSelection(
  historicalPod: string,
  selectedPodNorm: string,
  splitCombinedPOD: (pod: string) => string[],
): boolean {
  if (!historicalPod || !selectedPodNorm) return false;
  const parts = splitCombinedPOD(historicalPod);
  return parts.includes(selectedPodNorm);
}
