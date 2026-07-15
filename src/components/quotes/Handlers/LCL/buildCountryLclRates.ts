import type { OriginIndex } from "../../originSelection/types";
import { formatValidUntilDisplay } from "../handlerFechas";
import {
  getCountryPolNorms,
  isRouteInCountryAndValid,
} from "../shared/filterRoutesByCountryPol";
import type { CountryRateRow } from "../shared/countryRatesTypes";
import { capitalize, type RutaLCL, type Operador } from "./HandlerQuoteLCL";
import { LCL_PRICE_HISTORY_MARKUP } from "./HandlerQuoteLCLHistorical";

export function buildCountryLclRates(
  rutas: RutaLCL[],
  originIndex: OriginIndex | null,
  countryCode: string | null | undefined,
  operadoresActivos: Set<Operador>,
  destinationNormalized: string | null | undefined,
): CountryRateRow[] {
  if (!destinationNormalized) return [];

  const countryPolNorms = getCountryPolNorms(originIndex, countryCode);
  if (countryPolNorms.size === 0) return [];

  const filtered = rutas.filter(
    (ruta) =>
      isRouteInCountryAndValid(ruta, countryPolNorms) &&
      ruta.podNormalized === destinationNormalized &&
      operadoresActivos.has(ruta.operador),
  );

  const sorted = [...filtered].sort((a, b) => a.pol.localeCompare(b.pol, "es"));

  return sorted.map((ruta) => ({
    id: ruta.id,
    origin: capitalize(ruta.pol),
    destination: capitalize(ruta.pod),
    ttAprox: ruta.ttAprox || null,
    prices: {
      ofWM:
        ruta.ofWM > 0
          ? (ruta.ofWM * LCL_PRICE_HISTORY_MARKUP).toFixed(2)
          : null,
    },
    currency: ruta.currency,
    validUntil: ruta.validUntil
      ? formatValidUntilDisplay(ruta.validUntil)
      : "—",
  }));
}
