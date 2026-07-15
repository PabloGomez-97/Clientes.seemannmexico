import type { OriginIndex, RatedOrigin } from "./types";

export function getOriginsInCountry(
  index: OriginIndex | null,
  countryCode: string | null | undefined,
) {
  if (!index || !countryCode) return [];
  return index.originsByCountry.get(countryCode.toUpperCase()) ?? [];
}

export function buildPodOptionsForCountry<
  TRoute extends { polNormalized: string; podNormalized: string; pod: string },
>(
  rutas: TRoute[],
  index: OriginIndex | null,
  countryCode: string | null | undefined,
  getPodLabel: (podNormalized: string, routePod: string) => string,
): Array<{ value: string; label: string }> {
  if (!index || !countryCode) return [];

  const originNorms = new Set(
    getOriginsInCountry(index, countryCode).map((o) => o.normalized),
  );
  if (originNorms.size === 0) return [];

  const podMap = new Map<string, string>();
  for (const ruta of rutas) {
    if (!originNorms.has(ruta.polNormalized)) continue;
    if (!podMap.has(ruta.podNormalized)) {
      podMap.set(ruta.podNormalized, getPodLabel(ruta.podNormalized, ruta.pod));
    }
  }

  return Array.from(podMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function findCountryForOrigin(
  index: OriginIndex | null,
  originNormalized: string | null | undefined,
): string | null {
  if (!index || !originNormalized) return null;
  for (const [code, origins] of index.originsByCountry.entries()) {
    if (origins.some((o) => o.normalized === originNormalized)) {
      return code;
    }
  }
  return null;
}

/** POL/origen con al menos una tarifa recurrente al destino indicado. */
export function getPolNormsWithTariffForPod<
  TRoute extends { polNormalized: string; podNormalized: string },
>(
  rutas: TRoute[],
  podNormalized: string | null | undefined,
  isRouteEligible?: (route: TRoute) => boolean,
): Set<string> {
  const pols = new Set<string>();
  if (!podNormalized) return pols;
  for (const ruta of rutas) {
    if (ruta.podNormalized !== podNormalized) continue;
    if (isRouteEligible && !isRouteEligible(ruta)) continue;
    pols.add(ruta.polNormalized);
  }
  return pols;
}

export function getRatedOriginsInCountryForPod<
  TRoute extends { polNormalized: string; podNormalized: string },
>(
  index: OriginIndex | null,
  countryCode: string | null | undefined,
  podNormalized: string | null | undefined,
  rutas: TRoute[],
  isRouteEligible?: (route: TRoute) => boolean,
): RatedOrigin[] {
  if (!index || !countryCode || !podNormalized) return [];
  const polsWithTariff = getPolNormsWithTariffForPod(
    rutas,
    podNormalized,
    isRouteEligible,
  );
  return getOriginsInCountry(index, countryCode).filter((o) =>
    polsWithTariff.has(o.normalized),
  );
}

export function buildPolOptionsForCountryAndPod<
  TRoute extends {
    polNormalized: string;
    podNormalized: string;
    pol: string;
  },
>(
  rutas: TRoute[],
  index: OriginIndex | null,
  countryCode: string | null | undefined,
  podNormalized: string | null | undefined,
  getPolLabel: (polNormalized: string, routePol: string) => string,
  isRouteEligible?: (route: TRoute) => boolean,
): Array<{ value: string; label: string }> {
  if (!index || !countryCode || !podNormalized) return [];

  const polsWithTariff = getPolNormsWithTariffForPod(
    rutas,
    podNormalized,
    isRouteEligible,
  );
  if (polsWithTariff.size === 0) return [];

  const originNorms = new Set(
    getOriginsInCountry(index, countryCode).map((o) => o.normalized),
  );

  const polMap = new Map<string, string>();
  for (const ruta of rutas) {
    if (ruta.podNormalized !== podNormalized) continue;
    if (!originNorms.has(ruta.polNormalized)) continue;
    if (!polsWithTariff.has(ruta.polNormalized)) continue;
    if (isRouteEligible && !isRouteEligible(ruta)) continue;
    if (!polMap.has(ruta.polNormalized)) {
      polMap.set(ruta.polNormalized, getPolLabel(ruta.polNormalized, ruta.pol));
    }
  }

  return Array.from(polMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Aéreo: origen con tarifa recurrente al destino indicado. */
export function getOriginNormsWithTariffForDestination<
  TRoute extends { originNormalized: string; destinationNormalized: string },
>(
  rutas: TRoute[],
  destinationNormalized: string | null | undefined,
  isRouteEligible?: (route: TRoute) => boolean,
): Set<string> {
  const origins = new Set<string>();
  if (!destinationNormalized) return origins;
  for (const ruta of rutas) {
    if (ruta.destinationNormalized !== destinationNormalized) continue;
    if (isRouteEligible && !isRouteEligible(ruta)) continue;
    origins.add(ruta.originNormalized);
  }
  return origins;
}

export function getRatedOriginsInCountryForDestination<
  TRoute extends { originNormalized: string; destinationNormalized: string },
>(
  index: OriginIndex | null,
  countryCode: string | null | undefined,
  destinationNormalized: string | null | undefined,
  rutas: TRoute[],
  isRouteEligible?: (route: TRoute) => boolean,
): RatedOrigin[] {
  if (!index || !countryCode || !destinationNormalized) return [];
  const originsWithTariff = getOriginNormsWithTariffForDestination(
    rutas,
    destinationNormalized,
    isRouteEligible,
  );
  return getOriginsInCountry(index, countryCode).filter((o) =>
    originsWithTariff.has(o.normalized),
  );
}

export function buildOriginOptionsForCountryAndDestination<
  TRoute extends {
    originNormalized: string;
    destinationNormalized: string;
    origin: string;
  },
>(
  rutas: TRoute[],
  index: OriginIndex | null,
  countryCode: string | null | undefined,
  destinationNormalized: string | null | undefined,
  getOriginLabel: (originNormalized: string, routeOrigin: string) => string,
  isRouteEligible?: (route: TRoute) => boolean,
): Array<{ value: string; label: string }> {
  if (!index || !countryCode || !destinationNormalized) return [];

  const originsWithTariff = getOriginNormsWithTariffForDestination(
    rutas,
    destinationNormalized,
    isRouteEligible,
  );
  if (originsWithTariff.size === 0) return [];

  const countryOriginNorms = new Set(
    getOriginsInCountry(index, countryCode).map((o) => o.normalized),
  );

  const originMap = new Map<string, string>();
  for (const ruta of rutas) {
    if (ruta.destinationNormalized !== destinationNormalized) continue;
    if (!countryOriginNorms.has(ruta.originNormalized)) continue;
    if (!originsWithTariff.has(ruta.originNormalized)) continue;
    if (isRouteEligible && !isRouteEligible(ruta)) continue;
    if (!originMap.has(ruta.originNormalized)) {
      originMap.set(
        ruta.originNormalized,
        getOriginLabel(ruta.originNormalized, ruta.origin),
      );
    }
  }

  return Array.from(originMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}
