import { getCountryLabel } from "./countryLabels";
import type { OriginIndex, RatedOrigin } from "./types";

export interface OriginRowInput {
  normalized: string;
  label: string;
}

export interface BuildOriginIndexOptions {
  getCountryCode: (normalized: string) => string | null;
  getCoords: (normalized: string) => { lat: number; lng: number } | null;
}

export function buildOriginIndex(
  rows: OriginRowInput[],
  { getCountryCode, getCoords }: BuildOriginIndexOptions,
): OriginIndex {
  const byCountry = new Map<string, Map<string, RatedOrigin>>();

  for (const row of rows) {
    const countryCode = getCountryCode(row.normalized)?.toUpperCase();
    if (!countryCode) continue;

    const coords = getCoords(row.normalized);
    if (!coords) continue;

    if (!byCountry.has(countryCode)) {
      byCountry.set(countryCode, new Map());
    }
    const countryMap = byCountry.get(countryCode)!;
    if (!countryMap.has(row.normalized)) {
      countryMap.set(row.normalized, {
        normalized: row.normalized,
        label: row.label,
        countryCode,
        lat: coords.lat,
        lng: coords.lng,
      });
    }
  }

  const countries = Array.from(byCountry.keys())
    .map((code) => ({
      value: code,
      label: getCountryLabel(code),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  const originsByCountry = new Map<string, RatedOrigin[]>();
  for (const [code, originMap] of byCountry.entries()) {
    originsByCountry.set(
      code,
      Array.from(originMap.values()).sort((a, b) =>
        a.label.localeCompare(b.label, "es"),
      ),
    );
  }

  return { countries, originsByCountry };
}

export function ratedOriginsToSelectOptions(
  origins: RatedOrigin[],
): Array<{ value: string; label: string }> {
  return origins.map((o) => ({ value: o.normalized, label: o.label }));
}
