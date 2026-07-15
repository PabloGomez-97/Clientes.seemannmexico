import {
  extractPrice,
  normalize,
  parseCurrency,
  splitCombinedPOD,
  type Currency,
  type RutaFCL,
} from "./HandlerQuoteFCL";
import {
  buildPriceHistoryMarketMinSeries,
  historicalPodMatchesSelection,
} from "../shared/buildPriceHistorySeries";
import type {
  HistoricalOceanRow,
  PriceHistorySeriesResult,
} from "../shared/priceHistoryTypes";

export const GOOGLE_SHEET_FCL_HISTORICAL_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?gid=235552740&single=true&output=csv";

export const FCL_PRICE_HISTORY_MARKUP = 1.15;

export type FclPriceTier = "gp20" | "hq40" | "nor40";

export const FCL_PRICE_TIERS: FclPriceTier[] = ["gp20", "hq40", "nor40"];

export type FclPriceHistorySeriesResult = PriceHistorySeriesResult<FclPriceTier>;

export function parseHistoricalFCL(data: string[][]): HistoricalOceanRow<FclPriceTier>[] {
  const rows: HistoricalOceanRow<FclPriceTier>[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const pol = row[1];
    const pod = row[2];
    if (!pol || !pod || typeof pol !== "string" || typeof pod !== "string") {
      continue;
    }

    const validUntil = row[12]?.toString().trim() || "";
    if (!validUntil) continue;

    rows.push({
      polNorm: normalize(pol),
      podRaw: pod,
      validUntil,
      currency: parseCurrency(row[11]) as Currency,
      prices: {
        gp20: row[3] ? row[3].toString().trim() : null,
        hq40: row[4] ? row[4].toString().trim() : null,
        nor40: row[5] ? row[5].toString().trim() : null,
      },
    });
  }

  return rows;
}

export function buildFclMarketMinSeries(
  rows: HistoricalOceanRow<FclPriceTier>[],
  polNorm: string,
  podNorm: string,
  markup: number = FCL_PRICE_HISTORY_MARKUP,
): FclPriceHistorySeriesResult {
  return buildPriceHistoryMarketMinSeries(
    rows,
    FCL_PRICE_TIERS,
    polNorm,
    podNorm,
    markup,
    (row) =>
      row.polNorm === polNorm &&
      historicalPodMatchesSelection(row.podRaw, podNorm, splitCombinedPOD),
    extractPrice,
  );
}

/** Mínimo de mercado por contenedor desde tarifas vigentes (sheet actual). */
export function getCurrentFclMarketMinPrices(
  rutas: RutaFCL[],
  polNorm: string,
  podNorm: string,
  markup: number = FCL_PRICE_HISTORY_MARKUP,
): {
  pricesByTier: Record<FclPriceTier, number>;
  currency: Currency;
  rowCount: number;
} {
  const filtered = rutas.filter(
    (r) => r.polNormalized === polNorm && r.podNormalized === podNorm,
  );

  const pricesByTier = {} as Record<FclPriceTier, number>;
  for (const tier of FCL_PRICE_TIERS) {
    let min = Infinity;
    for (const row of filtered) {
      const price = extractPrice(row[tier]) * markup;
      if (price > 0 && price < min) {
        min = price;
      }
    }
    pricesByTier[tier] = min === Infinity ? 0 : min;
  }

  const currencyCounts = new Map<Currency, number>();
  for (const row of filtered) {
    currencyCounts.set(row.currency, (currencyCounts.get(row.currency) || 0) + 1);
  }
  let currency: Currency = "USD";
  let max = 0;
  for (const [cur, count] of currencyCounts) {
    if (count > max) {
      max = count;
      currency = cur;
    }
  }

  return { pricesByTier, currency, rowCount: filtered.length };
}
