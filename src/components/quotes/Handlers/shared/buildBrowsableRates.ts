import {
  GOOGLE_SHEET_CSV_URL as AIR_CSV_URL,
  parseAEREO,
  parseCSV,
  extractPrice as extractAirPrice,
  type RutaAerea,
} from "../Air/HandlerQuoteAir";
import {
  GOOGLE_SHEET_CSV_URL as FCL_CSV_URL,
  parseFCL,
  extractPrice as extractFclPrice,
  type RutaFCL,
} from "../FCL/HandlerQuoteFCL";
import {
  GOOGLE_SHEET_CSV_URL as LCL_CSV_URL,
  parseLCL,
  type RutaLCL,
} from "../LCL/HandlerQuoteLCL";
import { AIR_PRICE_HISTORY_MARKUP } from "../Air/HandlerQuoteAirHistorical";
import { FCL_PRICE_HISTORY_MARKUP } from "../FCL/HandlerQuoteFCLHistorical";
import { LCL_PRICE_HISTORY_MARKUP } from "../LCL/HandlerQuoteLCLHistorical";
import {
  formatValidUntilDisplay,
  getValidityClass,
  type ValidityState,
} from "../handlerFechas";
import { getPolCountry } from "./resolvePolCountry";
import type { CountryRateRow, CountryRateService } from "./countryRatesTypes";
import {
  getCachedBrowsableRates,
  setCachedBrowsableRates,
} from "./browsableRatesCache";

/**
 * Fila navegable de tarifa para el módulo "Consultar Tarifas".
 * Extiende CountryRateRow (el formato que consume el PDF / botón de descarga)
 * con metadatos para filtrar y enlazar con el histórico, e incluye las tarifas
 * VENCIDAS (a diferencia de buildCountry*Rates que las descarta).
 */
export interface BrowsableRateRow extends CountryRateRow {
  mode: CountryRateService;
  originNorm: string;
  destNorm: string;
  countryCode: string;
  countryLabel: string;
  validityState: ValidityState | null;
  /** Coincide con HistoricalRouteBundle.routeKey = `${mode}|${originNorm}|${destNorm}`. */
  routeKey: string;
}

export interface BrowsableRatesSnapshot {
  air: BrowsableRateRow[];
  fcl: BrowsableRateRow[];
  lcl: BrowsableRateRow[];
}

function isContainerAvailable(val?: string | null): boolean {
  return !!val && val !== "N/A" && val !== "-";
}

function airTierPrice(raw: string | null): string | null {
  const base = extractAirPrice(raw);
  if (base <= 0) return null;
  return (base * AIR_PRICE_HISTORY_MARKUP).toFixed(2);
}

function fclTierPrice(raw: string | null | undefined): string | null {
  if (!isContainerAvailable(raw)) return null;
  const base = extractFclPrice(raw ?? null);
  if (base <= 0) return null;
  return Math.round(base * FCL_PRICE_HISTORY_MARKUP).toString();
}

export function mapAirRows(rutas: RutaAerea[]): BrowsableRateRow[] {
  return rutas.map((ruta) => {
    const { code, label } = getPolCountry(
      ruta.originNormalized,
      ruta.origin,
      "air",
    );
    return {
      id: ruta.id,
      mode: "air",
      origin: ruta.origin,
      destination: ruta.destination,
      originNorm: ruta.originNormalized,
      destNorm: ruta.destinationNormalized,
      countryCode: code,
      countryLabel: label,
      carrier: ruta.carrier ? ruta.carrier : "Por confirmar",
      prices: {
        kg45: airTierPrice(ruta.kg45),
        kg100: airTierPrice(ruta.kg100),
        kg300: airTierPrice(ruta.kg300),
        kg500: airTierPrice(ruta.kg500),
        kg1000: airTierPrice(ruta.kg1000),
      },
      currency: ruta.currency,
      validUntil: ruta.validUntil
        ? formatValidUntilDisplay(ruta.validUntil)
        : "—",
      validityState: getValidityClass(ruta.validUntil),
      routeKey: `air|${ruta.originNormalized}|${ruta.destinationNormalized}`,
    };
  });
}

export function mapFclRows(rutas: RutaFCL[]): BrowsableRateRow[] {
  return rutas.map((ruta) => {
    const { code, label } = getPolCountry(ruta.polNormalized, ruta.pol, "fcl");
    return {
      id: ruta.id,
      mode: "fcl",
      origin: ruta.pol,
      destination: ruta.pod,
      originNorm: ruta.polNormalized,
      destNorm: ruta.podNormalized,
      countryCode: code,
      countryLabel: label,
      carrier:
        ruta.carrier && ruta.carrier !== "N/A" ? ruta.carrier : "Por confirmar",
      ttAprox: ruta.tt || null,
      freeTime: ruta.freeTime || null,
      prices: {
        gp20: fclTierPrice(ruta.gp20),
        hq40: fclTierPrice(ruta.hq40),
        nor40: fclTierPrice(ruta.nor40),
      },
      currency: ruta.currency,
      validUntil: ruta.validUntil
        ? formatValidUntilDisplay(ruta.validUntil)
        : "—",
      validityState: getValidityClass(ruta.validUntil),
      routeKey: `fcl|${ruta.polNormalized}|${ruta.podNormalized}`,
    };
  });
}

export function mapLclRows(rutas: RutaLCL[]): BrowsableRateRow[] {
  return rutas.map((ruta) => {
    const { code, label } = getPolCountry(ruta.polNormalized, ruta.pol, "lcl");
    return {
      id: ruta.id,
      mode: "lcl",
      origin: ruta.pol,
      destination: ruta.pod,
      originNorm: ruta.polNormalized,
      destNorm: ruta.podNormalized,
      countryCode: code,
      countryLabel: label,
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
      validityState: getValidityClass(ruta.validUntil),
      routeKey: `lcl|${ruta.polNormalized}|${ruta.podNormalized}`,
    };
  });
}

async function fetchCsvText(
  url: string,
  cacheBust: boolean,
): Promise<string | null> {
  try {
    const finalUrl = cacheBust
      ? `${url}${url.includes("?") ? "&" : "?"}timestamp=${Date.now()}`
      : url;
    const res = await fetch(finalUrl);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Descarga las tarifas vigentes (y vencidas) de los 3 cotizadores en paralelo.
 * Lanza un error solo si NINGUNA modalidad pudo cargarse, para que la UI
 * pueda mostrar el estado de error con opción de reintentar.
 */
export async function fetchBrowsableRates(
  cacheBust = false,
): Promise<BrowsableRatesSnapshot> {
  const [airText, fclText, lclText] = await Promise.all([
    fetchCsvText(AIR_CSV_URL, cacheBust),
    fetchCsvText(FCL_CSV_URL, cacheBust),
    fetchCsvText(LCL_CSV_URL, cacheBust),
  ]);

  if (airText === null && fclText === null && lclText === null) {
    throw new Error("No se pudieron cargar las tarifas.");
  }

  return {
    air: airText ? mapAirRows(parseAEREO(parseCSV(airText))) : [],
    fcl: fclText ? mapFclRows(parseFCL(parseCSV(fclText))) : [],
    lcl: lclText ? mapLclRows(parseLCL(parseCSV(lclText))) : [],
  };
}

/**
 * Devuelve tarifas desde caché local (2 h) si están vigentes.
 * Con `forceRefresh` ignora la caché y vuelve a descargar los CSV.
 */
export async function fetchBrowsableRatesCached(
  forceRefresh = false,
): Promise<BrowsableRatesSnapshot> {
  if (!forceRefresh) {
    const cached = getCachedBrowsableRates();
    if (cached) return cached;
  }

  const fresh = await fetchBrowsableRates(forceRefresh);
  setCachedBrowsableRates(fresh);
  return fresh;
}

export interface CountryOption {
  code: string;
  label: string;
}

export function listCountriesFromRows(
  rows: BrowsableRateRow[],
): CountryOption[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.countryCode)) map.set(row.countryCode, row.countryLabel);
  }
  return Array.from(map.entries())
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => {
      if (a.code === "XX") return 1;
      if (b.code === "XX") return -1;
      return a.label.localeCompare(b.label, "es");
    });
}

export interface OriginCityOption {
  norm: string;
  label: string;
}

export function listOriginCitiesFromRows(
  rows: BrowsableRateRow[],
): OriginCityOption[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.originNorm)) map.set(row.originNorm, row.origin);
  }
  return Array.from(map.entries())
    .map(([norm, label]) => ({ norm, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export interface DestinationOption {
  norm: string;
  label: string;
}

export function listDestinationsFromRows(
  rows: BrowsableRateRow[],
): DestinationOption[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.destNorm)) map.set(row.destNorm, row.destination);
  }
  return Array.from(map.entries())
    .map(([norm, label]) => ({ norm, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}
