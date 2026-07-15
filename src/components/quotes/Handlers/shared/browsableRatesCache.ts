import type { BrowsableRatesSnapshot } from "./buildBrowsableRates";

const CACHE_KEY = "consulta_tarifas_rates_v1";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

interface CachedRatesPayload {
  data: BrowsableRatesSnapshot;
  ts: number;
}

export function getCachedBrowsableRates(): BrowsableRatesSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRatesPayload;
    if (!parsed?.data || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedBrowsableRates(data: BrowsableRatesSnapshot): void {
  try {
    const payload: CachedRatesPayload = { data, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota exceeded */
  }
}

export function clearCachedBrowsableRates(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
