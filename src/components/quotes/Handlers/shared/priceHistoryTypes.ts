export type PriceHistoryCurrency =
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "CHF"
  | "CLP"
  | "SEK";

export interface PriceHistoryPoint {
  dateKey: string;
  label: string;
  value: number;
}

export interface PriceHistorySeriesResult<TTier extends string = string> {
  seriesByTier: Record<TTier, PriceHistoryPoint[]>;
  dominantCurrency: PriceHistoryCurrency;
  hasMixedCurrencies: boolean;
  rowCount: number;
}

export interface HistoricalOceanRow<TTier extends string> {
  polNorm: string;
  podRaw: string;
  validUntil: string;
  currency: PriceHistoryCurrency;
  prices: Record<TTier, string | null>;
}
