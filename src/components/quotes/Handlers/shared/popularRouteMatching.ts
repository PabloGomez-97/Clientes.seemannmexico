import { AIRPORT_ORIGIN_KEY_ALIASES } from "../../../../config/airportOriginAliases";
import { airportCoordinates } from "../../../../config/airportCoordinates";
import { getPortByPOL } from "../../../../config/portCoordinates";
import { normalize } from "../FCL/HandlerQuoteFCL";
import type { CountryRateService } from "./countryRatesTypes";
import type { BrowsableRateRow } from "./buildBrowsableRates";

/** Norma canónica de aeropuerto para comparar catálogo ↔ tarifas (ej. santiago ↔ santiago_de_chile). */
export function canonicalAirNorm(norm: string): string {
  const n = normalize(norm);
  return AIRPORT_ORIGIN_KEY_ALIASES[n] ?? n;
}

export function airNormsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return canonicalAirNorm(a) === canonicalAirNorm(b);
}

/**
 * Resuelve un nombre de puerto (ShipsGo / sheet) al norm usado en tarifas FCL/LCL.
 * Ej.: "FORT LAUDERDALE (PORT EVERGLADES)" → "port everglades"
 */
export function resolveOceanPortNormForRates(portName: string): string {
  const raw = portName.trim();
  if (!raw) return "";

  const n = normalize(raw);
  const port = getPortByPOL(n);
  if (port) return normalize(port.name);

  const paren = raw.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (paren) {
    const fromParen = resolveOceanPortNormForRates(paren);
    if (fromParen) return fromParen;
  }

  return n;
}

export function canonicalOceanNorm(norm: string): string {
  return resolveOceanPortNormForRates(norm) || normalize(norm);
}

export function oceanNormsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ca = canonicalOceanNorm(a);
  const cb = canonicalOceanNorm(b);
  if (ca === cb) return true;
  return ca.includes(cb) || cb.includes(ca);
}

export function locationNormsMatch(
  mode: CountryRateService,
  rowNorm: string,
  filterNorm: string,
): boolean {
  if (!filterNorm) return true;
  if (mode === "air") return airNormsMatch(rowNorm, filterNorm);
  return oceanNormsMatch(rowNorm, filterNorm);
}

export function findAirportCatalogKeyByIata(iata: string): string | null {
  const upper = iata.trim().toUpperCase();
  if (!upper) return null;
  for (const [key, coords] of Object.entries(airportCoordinates)) {
    if (coords.iata.toUpperCase() === upper) return key;
  }
  return null;
}

export function labelFromAirCatalogKey(key: string): string {
  return airportCoordinates[key]?.name ?? key.replace(/_/g, " ");
}

export interface BrowsableRateFilters {
  countryCode: string;
  originNorm: string;
  destNorm: string;
  includeExpired: boolean;
  tierKey: string;
  showTierFilter: boolean;
}

function isActiveRow(row: BrowsableRateRow): boolean {
  return row.validityState !== "expired";
}

export function filterBrowsableRows(
  rows: BrowsableRateRow[],
  mode: CountryRateService,
  filters: BrowsableRateFilters,
): BrowsableRateRow[] {
  let result = rows;
  if (filters.countryCode) {
    result = result.filter((r) => r.countryCode === filters.countryCode);
  }
  if (filters.originNorm) {
    result = result.filter((r) =>
      locationNormsMatch(mode, r.originNorm, filters.originNorm),
    );
  }
  if (filters.destNorm) {
    result = result.filter((r) =>
      locationNormsMatch(mode, r.destNorm, filters.destNorm),
    );
  }
  if (!filters.includeExpired) {
    result = result.filter(isActiveRow);
  }
  if (filters.tierKey && filters.showTierFilter) {
    result = result.filter((r) => r.prices[filters.tierKey] != null);
  }
  return [...result].sort((a, b) => {
    const expiredA = a.validityState === "expired" ? 1 : 0;
    const expiredB = b.validityState === "expired" ? 1 : 0;
    if (expiredA !== expiredB) return expiredA - expiredB;
    const originCmp = a.origin.localeCompare(b.origin, "es");
    if (originCmp !== 0) return originCmp;
    return (a.carrier || "").localeCompare(b.carrier || "", "es");
  });
}

export function findMatchingRateRow(
  rows: BrowsableRateRow[],
  mode: CountryRateService,
  originNorm: string,
  destNorm: string,
): BrowsableRateRow | undefined {
  return rows.find(
    (r) =>
      locationNormsMatch(mode, r.originNorm, originNorm) &&
      locationNormsMatch(mode, r.destNorm, destNorm),
  );
}
