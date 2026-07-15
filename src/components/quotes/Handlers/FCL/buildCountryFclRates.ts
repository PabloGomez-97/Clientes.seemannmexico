import type { OriginIndex } from "../../originSelection/types";
import { formatValidUntilDisplay } from "../handlerFechas";
import {
  getCountryPolNorms,
  isRouteInCountryAndValid,
} from "../shared/filterRoutesByCountryPol";
import type { CountryRateRow } from "../shared/countryRatesTypes";
import {
  extractPrice,
  capitalize,
  type RutaFCL,
} from "./HandlerQuoteFCL";
import { FCL_PRICE_HISTORY_MARKUP } from "./HandlerQuoteFCLHistorical";

function isContainerAvailable(val?: string | null): boolean {
  return !!val && val !== "N/A" && val !== "-";
}

function formatFclMarkedUpPrice(raw: string | null | undefined): string | null {
  if (!isContainerAvailable(raw)) return null;
  const base = extractPrice(raw ?? null);
  if (base <= 0) return null;
  return Math.round(base * FCL_PRICE_HISTORY_MARKUP).toString();
}

function matchesCarrier(
  carrier: string,
  carriersActivos: Set<string>,
): boolean {
  return !carrier || carrier === "N/A" || carriersActivos.has(carrier);
}

export function buildCountryFclRates(
  rutas: RutaFCL[],
  originIndex: OriginIndex | null,
  countryCode: string | null | undefined,
  carriersActivos: Set<string>,
  destinationNormalized: string | null | undefined,
): CountryRateRow[] {
  if (!destinationNormalized) return [];

  const countryPolNorms = getCountryPolNorms(originIndex, countryCode);
  if (countryPolNorms.size === 0) return [];

  const filtered = rutas.filter(
    (ruta) =>
      isRouteInCountryAndValid(ruta, countryPolNorms) &&
      ruta.podNormalized === destinationNormalized &&
      matchesCarrier(ruta.carrier, carriersActivos),
  );

  const sorted = [...filtered].sort((a, b) => {
    const polCmp = a.pol.localeCompare(b.pol, "es");
    if (polCmp !== 0) return polCmp;
    return (a.carrier || "").localeCompare(b.carrier || "", "es");
  });

  return sorted.map((ruta) => ({
    id: ruta.id,
    origin: capitalize(ruta.pol),
    destination: capitalize(ruta.pod),
    carrier: ruta.carrier && ruta.carrier !== "N/A"
      ? capitalize(ruta.carrier)
      : "Por confirmar",
    ttAprox: ruta.tt || null,
    freeTime: ruta.freeTime || null,
    prices: {
      gp20: formatFclMarkedUpPrice(ruta.gp20),
      hq40: formatFclMarkedUpPrice(ruta.hq40),
      nor40: formatFclMarkedUpPrice(ruta.nor40),
    },
    currency: ruta.currency,
    validUntil: ruta.validUntil
      ? formatValidUntilDisplay(ruta.validUntil)
      : "—",
  }));
}
