import { getOriginsInCountry } from "../../originSelection/maritimeOriginHelpers";
import type { OriginIndex } from "../../originSelection/types";
import { getValidityClass, formatValidUntilDisplay } from "../handlerFechas";
import type { CountryRateRow } from "../shared/countryRatesTypes";
import {
  extractPrice,
  capitalize,
  type RutaAerea,
  type Currency,
} from "./HandlerQuoteAir";
import {
  AIR_PRICE_HISTORY_MARKUP,
  type AirWeightTier,
} from "./HandlerQuoteAirHistorical";

function formatMarkedUpPrice(raw: string | null): string | null {
  const base = extractPrice(raw);
  if (base <= 0) return null;
  return (base * AIR_PRICE_HISTORY_MARKUP).toFixed(2);
}

function tierPrice(ruta: RutaAerea, tier: AirWeightTier): string | null {
  return formatMarkedUpPrice(ruta[tier]);
}

export function buildCountryAirRates(
  rutas: RutaAerea[],
  originIndex: OriginIndex | null,
  countryCode: string | null | undefined,
  carriersActivos: Set<string>,
  monedasActivas: Set<Currency>,
  destinationNormalized: string | null | undefined,
): CountryRateRow[] {
  if (!originIndex || !countryCode || !destinationNormalized) return [];

  const countryOriginNorms = new Set(
    getOriginsInCountry(originIndex, countryCode).map((o) => o.normalized),
  );
  if (countryOriginNorms.size === 0) return [];

  const filtered = rutas.filter((ruta) => {
    if (!countryOriginNorms.has(ruta.originNormalized)) return false;
    if (ruta.destinationNormalized !== destinationNormalized) return false;
    if (getValidityClass(ruta.validUntil) === "expired") return false;
    const matchCarrier = !ruta.carrier || carriersActivos.has(ruta.carrier);
    const matchMoneda = monedasActivas.has(ruta.currency);
    return matchCarrier && matchMoneda;
  });

  const sorted = [...filtered].sort((a, b) => {
    const originCmp = a.origin.localeCompare(b.origin, "es");
    if (originCmp !== 0) return originCmp;
    return (a.carrier || "").localeCompare(b.carrier || "", "es");
  });

  return sorted.map((ruta) => ({
    id: ruta.id,
    origin: capitalize(ruta.origin),
    destination: capitalize(ruta.destination),
    carrier: ruta.carrier ? capitalize(ruta.carrier) : "Por confirmar",
    prices: {
      kg45: tierPrice(ruta, "kg45"),
      kg100: tierPrice(ruta, "kg100"),
      kg300: tierPrice(ruta, "kg300"),
      kg500: tierPrice(ruta, "kg500"),
      kg1000: tierPrice(ruta, "kg1000"),
    },
    currency: ruta.currency,
    validUntil: ruta.validUntil
      ? formatValidUntilDisplay(ruta.validUntil)
      : "—",
  }));
}
