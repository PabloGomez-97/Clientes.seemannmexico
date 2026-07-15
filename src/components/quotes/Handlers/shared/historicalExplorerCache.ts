import type { HistoricalExplorerSnapshot } from "./historicalExplorerParse";
import { fetchHistoricalExplorerSnapshot } from "./historicalExplorerParse";

const CACHE_KEY = "consulta_tarifas_history_v1";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

interface CachedHistoryPayload {
  data: HistoricalExplorerSnapshot;
  ts: number;
}

export function getCachedHistoricalExplorer(): HistoricalExplorerSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedHistoryPayload;
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

export function setCachedHistoricalExplorer(
  data: HistoricalExplorerSnapshot,
): void {
  try {
    const payload: CachedHistoryPayload = { data, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota exceeded */
  }
}

export function clearCachedHistoricalExplorer(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Devuelve el snapshot desde caché local (2 h) si está vigente.
 * Con `forceRefresh` ignora la caché y vuelve a descargar los CSV.
 */
export async function fetchHistoricalExplorerSnapshotCached(
  forceRefresh = false,
): Promise<HistoricalExplorerSnapshot> {
  if (!forceRefresh) {
    const cached = getCachedHistoricalExplorer();
    if (cached) return cached;
  } else {
    clearCachedHistoricalExplorer();
  }

  const fresh = await fetchHistoricalExplorerSnapshot();
  setCachedHistoricalExplorer(fresh);
  return fresh;
}
