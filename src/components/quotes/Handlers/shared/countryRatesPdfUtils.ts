import type { CountryRateRow } from "./countryRatesTypes";

/** Filas por hoja landscape A4 con header completo en cada página. */
export const ROWS_PER_PDF_PAGE = 18;

export interface OriginRateGroup {
  origin: string;
  rows: CountryRateRow[];
}

export function groupRowsByOrigin(
  rows: CountryRateRow[],
  preferredOriginLabel?: string,
): OriginRateGroup[] {
  const groupMap = new Map<string, OriginRateGroup>();

  for (const row of rows) {
    const key = row.origin.trim();
    const existing = groupMap.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groupMap.set(key, { origin: row.origin, rows: [row] });
    }
  }

  const preferredKey = preferredOriginLabel?.trim().toLowerCase();

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) =>
        a.destination.localeCompare(b.destination, "es"),
      ),
    }))
    .sort((a, b) => {
      if (preferredKey) {
        const aIsPreferred = a.origin.trim().toLowerCase() === preferredKey;
        const bIsPreferred = b.origin.trim().toLowerCase() === preferredKey;
        if (aIsPreferred !== bIsPreferred) {
          return aIsPreferred ? -1 : 1;
        }
      }
      return a.origin.localeCompare(b.origin, "es");
    });
}

export function chunkRows<T>(rows: T[], chunkSize: number): T[][] {
  if (rows.length === 0) return [];
  if (chunkSize <= 0) return [rows];

  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  return chunks;
}
