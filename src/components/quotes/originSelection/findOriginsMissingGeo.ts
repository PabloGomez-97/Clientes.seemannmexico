import type { BuildOriginIndexOptions, OriginRowInput } from "./buildOriginIndex";

/**
 * Orígenes presentes en tarifas pero excluidos del índice por país/coords desconocidos.
 */
export function findOriginsMissingGeo(
  rows: OriginRowInput[],
  { getCountryCode, getCoords }: BuildOriginIndexOptions,
): OriginRowInput[] {
  const missing: OriginRowInput[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.normalized)) continue;
    seen.add(row.normalized);

    const hasCountry = Boolean(getCountryCode(row.normalized));
    const hasCoords = Boolean(getCoords(row.normalized));
    if (!hasCountry || !hasCoords) {
      missing.push(row);
    }
  }

  return missing.sort((a, b) => a.label.localeCompare(b.label, "es"));
}
