import {
  extractPrice,
  normalize,
  parseCurrency,
  type Currency,
  type RutaAerea,
} from "./HandlerQuoteAir";
import {
  formatValidUntilDisplay,
  parseValidUntilToDate,
} from "../handlerFechas";

export const GOOGLE_SHEET_HISTORICAL_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTWBXW_l3kB2V0A9D732Le0AjyGnXDjgV8nasTz1Z3gWUbCklXKICxTE4kEMjYMoaTG4v78XB2aVrHe/pub?gid=1613970414&single=true&output=csv";

export const AIR_PRICE_HISTORY_MARKUP = 1.15;

export type AirWeightTier =
  | "kg45"
  | "kg100"
  | "kg300"
  | "kg500"
  | "kg1000";

export const AIR_WEIGHT_TIERS: AirWeightTier[] = [
  "kg45",
  "kg100",
  "kg300",
  "kg500",
  "kg1000",
];

export interface HistoricalAirRow {
  originNorm: string;
  destNorm: string;
  validUntil: string;
  currency: Currency;
  prices: Record<AirWeightTier, string | null>;
}

export interface AirPriceHistoryPoint {
  dateKey: string;
  label: string;
  value: number;
}

export interface AirPriceHistorySeriesResult {
  seriesByTier: Record<AirWeightTier, AirPriceHistoryPoint[]>;
  dominantCurrency: Currency;
  hasMixedCurrencies: boolean;
  rowCount: number;
}

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseHistoricalAEREO(data: string[][]): HistoricalAirRow[] {
  const rows: HistoricalAirRow[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const origin = row[1];
    const destination = row[2];
    if (
      !origin ||
      !destination ||
      typeof origin !== "string" ||
      typeof destination !== "string"
    ) {
      continue;
    }

    const validUntil = row[15]?.toString().trim() || "";
    if (!validUntil) continue;

    rows.push({
      originNorm: normalize(origin),
      destNorm: normalize(destination),
      validUntil,
      currency: parseCurrency(row[14]),
      prices: {
        kg45: row[3] ? row[3].toString().trim() : null,
        kg100: row[4] ? row[4].toString().trim() : null,
        kg300: row[5] ? row[5].toString().trim() : null,
        kg500: row[6] ? row[6].toString().trim() : null,
        kg1000: row[7] ? row[7].toString().trim() : null,
      },
    });
  }

  return rows;
}

function resolveDominantCurrency(
  filtered: HistoricalAirRow[],
): { currency: Currency; hasMixed: boolean } {
  if (filtered.length === 0) {
    return { currency: "USD", hasMixed: false };
  }

  const counts = new Map<Currency, number>();
  for (const row of filtered) {
    counts.set(row.currency, (counts.get(row.currency) || 0) + 1);
  }

  let dominant: Currency = "USD";
  let max = 0;
  for (const [cur, count] of counts) {
    if (count > max) {
      max = count;
      dominant = cur;
    }
  }

  return { currency: dominant, hasMixed: counts.size > 1 };
}

export function buildMarketMinSeries(
  rows: HistoricalAirRow[],
  originNorm: string,
  destNorm: string,
  markup: number = AIR_PRICE_HISTORY_MARKUP,
): AirPriceHistorySeriesResult {
  const filtered = rows.filter(
    (r) => r.originNorm === originNorm && r.destNorm === destNorm,
  );

  const { currency: dominantCurrency, hasMixed: hasMixedCurrencies } =
    resolveDominantCurrency(filtered);

  const buckets: Record<
    AirWeightTier,
    Map<string, { label: string; value: number }>
  > = {
    kg45: new Map(),
    kg100: new Map(),
    kg300: new Map(),
    kg500: new Map(),
    kg1000: new Map(),
  };

  for (const row of filtered) {
    const date = parseValidUntilToDate(row.validUntil);
    if (!date) continue;

    const dateKey = dateToKey(date);
    const label = formatValidUntilDisplay(row.validUntil);

    for (const tier of AIR_WEIGHT_TIERS) {
      const raw = row.prices[tier];
      const price = extractPrice(raw) * markup;
      if (price <= 0) continue;

      const tierMap = buckets[tier];
      const existing = tierMap.get(dateKey);
      if (!existing || price < existing.value) {
        tierMap.set(dateKey, { label, value: price });
      }
    }
  }

  const seriesByTier = {} as Record<AirWeightTier, AirPriceHistoryPoint[]>;

  for (const tier of AIR_WEIGHT_TIERS) {
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

/** Mínimo de mercado por tramo desde tarifas vigentes (sheet actual). */
export function getCurrentAirMarketMinPrices(
  rutas: RutaAerea[],
  originNorm: string,
  destNorm: string,
  markup: number = AIR_PRICE_HISTORY_MARKUP,
): {
  pricesByTier: Record<AirWeightTier, number>;
  currency: Currency;
  rowCount: number;
} {
  const filtered = rutas.filter(
    (r) =>
      r.originNormalized === originNorm &&
      r.destinationNormalized === destNorm,
  );

  const pricesByTier = {} as Record<AirWeightTier, number>;
  for (const tier of AIR_WEIGHT_TIERS) {
    let min = Infinity;
    for (const row of filtered) {
      const price = extractPrice(row[tier]) * markup;
      if (price > 0 && price < min) {
        min = price;
      }
    }
    pricesByTier[tier] = min === Infinity ? 0 : min;
  }

  const { currency } = resolveDominantCurrency(
    filtered.map((r) => ({
      originNorm: r.originNormalized,
      destNorm: r.destinationNormalized,
      validUntil: r.validUntil ?? "",
      currency: r.currency,
      prices: {
        kg45: r.kg45,
        kg100: r.kg100,
        kg300: r.kg300,
        kg500: r.kg500,
        kg1000: r.kg1000,
      },
    })),
  );

  return { pricesByTier, currency, rowCount: filtered.length };
}
