import { getOriginsInCountry } from "../../originSelection/maritimeOriginHelpers";
import type { OriginIndex } from "../../originSelection/types";
import { getValidityClass } from "../handlerFechas";

export function getCountryPolNorms(
  originIndex: OriginIndex | null,
  countryCode: string | null | undefined,
): Set<string> {
  if (!originIndex || !countryCode) return new Set();
  return new Set(
    getOriginsInCountry(originIndex, countryCode).map((o) => o.normalized),
  );
}

export function isRouteInCountryAndValid<
  TRoute extends { polNormalized: string; validUntil: string | null },
>(ruta: TRoute, countryPolNorms: Set<string>): boolean {
  if (countryPolNorms.size === 0) return false;
  if (!countryPolNorms.has(ruta.polNormalized)) return false;
  return getValidityClass(ruta.validUntil) !== "expired";
}
