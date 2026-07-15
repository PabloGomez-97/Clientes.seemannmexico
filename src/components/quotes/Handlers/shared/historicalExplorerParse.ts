import { parseCSV } from "../FCL/HandlerQuoteFCL";
import {
  extractPrice as extractAirPrice,
  normalize as normalizeAir,
  parseCurrency as parseAirCurrency,
} from "../Air/HandlerQuoteAir";
import {
  extractPrice as extractOceanPrice,
  normalize as normalizeOcean,
  parseCurrency as parseFclCurrency,
  splitCombinedPOD,
  getPODDisplayName,
} from "../FCL/HandlerQuoteFCL";
import { GOOGLE_SHEET_HISTORICAL_CSV_URL as AIR_HISTORICAL_URL } from "../Air/HandlerQuoteAirHistorical";
import { GOOGLE_SHEET_FCL_HISTORICAL_CSV_URL as FCL_HISTORICAL_URL } from "../FCL/HandlerQuoteFCLHistorical";
import { GOOGLE_SHEET_LCL_HISTORICAL_CSV_URL as LCL_HISTORICAL_URL } from "../LCL/HandlerQuoteLCLHistorical";
import { GOOGLE_SHEET_CSV_URL as AIR_CURRENT_CSV_URL } from "../Air/HandlerQuoteAir";
import { GOOGLE_SHEET_CSV_URL as FCL_CURRENT_CSV_URL } from "../FCL/HandlerQuoteFCL";
import { GOOGLE_SHEET_CSV_URL as LCL_CURRENT_CSV_URL } from "../LCL/HandlerQuoteLCL";
import { AIR_PRICE_HISTORY_MARKUP } from "../Air/HandlerQuoteAirHistorical";
import { FCL_PRICE_HISTORY_MARKUP } from "../FCL/HandlerQuoteFCLHistorical";
import { LCL_PRICE_HISTORY_MARKUP } from "../LCL/HandlerQuoteLCLHistorical";
import {
  formatEntityLabel,
  getPolCountry,
  normalizeEntityKey,
} from "./resolvePolCountry";
import { parseValidUntilToDate } from "../handlerFechas";
import type { PriceHistoryCurrency } from "./priceHistoryTypes";
import {
  COTIZADOR_DATA_START_ROW,
} from "./historicalExplorerCurrentUrls";

export type ExplorerMode = "air" | "fcl" | "lcl";

export const AIR_TIER_ORDER: { tierKey: string; tierLabel: string }[] = [
  { tierKey: "kg45", tierLabel: "45–99 kg" },
  { tierKey: "kg100", tierLabel: "100–299 kg" },
  { tierKey: "kg300", tierLabel: "300–499 kg" },
  { tierKey: "kg500", tierLabel: "500–999 kg" },
  { tierKey: "kg1000", tierLabel: "+1000 kg" },
];

export const FCL_TIER_ORDER: { tierKey: string; tierLabel: string }[] = [
  { tierKey: "gp20", tierLabel: "20GP" },
  { tierKey: "hq40", tierLabel: "40HQ" },
  { tierKey: "nor40", tierLabel: "40NOR" },
];

/** Colores por línea del gráfico (índice 0 = más económico). */
export const EXPLORER_ENTITY_COLORS = [
  "#FF6200",
  "#111827",
  "#2563EB",
  "#059669",
  "#7C3AED",
  "#DB2777",
] as const;

export function getExplorerEntityColor(index: number): string {
  return EXPLORER_ENTITY_COLORS[index % EXPLORER_ENTITY_COLORS.length];
}

export interface HistoricalExplorerPoint {
  dateKey: string;
  label: string;
  value: number;
}

export interface HistoricalEntitySeries {
  entityKey: string;
  entityLabel: string;
  points: HistoricalExplorerPoint[];
}

export interface HistoricalTierSeries {
  tierKey: string;
  tierLabel: string;
  currency: PriceHistoryCurrency;
  entities: HistoricalEntitySeries[];
}

export interface HistoricalRouteBundle {
  routeKey: string;
  mode: ExplorerMode;
  originLabel: string;
  originNorm: string;
  destLabel: string;
  destNorm: string;
  countryCode: string;
  countryLabel: string;
  tiers: HistoricalTierSeries[];
}

export interface HistoricalExplorerSnapshot {
  routes: HistoricalRouteBundle[];
  countries: { code: string; label: string }[];
}

type RowSource = "historical" | "current";

interface RawHistoricalRow {
  mode: ExplorerMode;
  originLabel: string;
  originNorm: string;
  destLabel: string;
  destNorm: string;
  podRaw: string;
  entityLabel: string;
  entityKey: string;
  tierKey: string;
  tierLabel: string;
  validUntil: string;
  currency: PriceHistoryCurrency;
  price: number;
  countryCode: string;
  countryLabel: string;
  source: RowSource;
}

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pushTierPrice(
  rows: RawHistoricalRow[],
  base: Omit<RawHistoricalRow, "tierKey" | "tierLabel" | "price">,
  tierKey: string,
  tierLabel: string,
  rawPrice: string | null,
  markup: number,
  extractPrice: (v: string | null) => number,
) {
  const price = extractPrice(rawPrice) * markup;
  if (price <= 0) return;
  rows.push({ ...base, tierKey, tierLabel, price });
}

function parseAirRows(
  data: string[][],
  startRow = 0,
  source: RowSource = "historical",
): RawHistoricalRow[] {
  const out: RawHistoricalRow[] = [];
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row?.[1] || !row?.[2]) continue;
    const originLabel = row[1].toString().trim();
    const destLabel = row[2].toString().trim();
    const originNorm = normalizeAir(originLabel);
    const destNorm = normalizeAir(destLabel);
    const validUntil = row[15]?.toString().trim() || "";
    if (!validUntil || !parseValidUntilToDate(validUntil)) continue;

    const country = getPolCountry(originNorm, originLabel, "air");
    const entityLabel = formatEntityLabel(row[8]);
    const base = {
      mode: "air" as const,
      originLabel,
      originNorm,
      destLabel,
      destNorm,
      podRaw: destLabel,
      entityLabel,
      entityKey: normalizeEntityKey(row[8]),
      validUntil,
      currency: parseAirCurrency(row[14]) as PriceHistoryCurrency,
      countryCode: country.code,
      countryLabel: country.label,
      source,
    };

    const tiers: [string, string, string | null][] = [
      ["kg45", "45–99 kg", row[3]],
      ["kg100", "100–299 kg", row[4]],
      ["kg300", "300–499 kg", row[5]],
      ["kg500", "500–999 kg", row[6]],
      ["kg1000", "+1000 kg", row[7]],
    ];
    for (const [tierKey, tierLabel, raw] of tiers) {
      pushTierPrice(
        out,
        base,
        tierKey,
        tierLabel,
        raw ? raw.toString() : null,
        AIR_PRICE_HISTORY_MARKUP,
        extractAirPrice,
      );
    }
  }
  return out;
}

function parseFclRows(
  data: string[][],
  startRow = 0,
  source: RowSource = "historical",
): RawHistoricalRow[] {
  const out: RawHistoricalRow[] = [];
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row?.[1] || !row?.[2]) continue;
    const originLabel = row[1].toString().trim();
    const podRaw = row[2].toString().trim();
    const originNorm = normalizeOcean(originLabel);
    const validUntil = row[12]?.toString().trim() || "";
    if (!validUntil || !parseValidUntilToDate(validUntil)) continue;

    const country = getPolCountry(originNorm, originLabel, "fcl");
    const entityLabel = formatEntityLabel(row[6]);
    const base = {
      mode: "fcl" as const,
      originLabel,
      originNorm,
      entityLabel,
      entityKey: normalizeEntityKey(row[6]),
      validUntil,
      currency: parseFclCurrency(row[11]) as PriceHistoryCurrency,
      countryCode: country.code,
      countryLabel: country.label,
      podRaw,
      source,
    };

    for (const podNorm of splitCombinedPOD(podRaw)) {
      const destLabel = getPODDisplayName(podNorm);
      const destNorm = podNorm;
      const podBase = { ...base, destLabel, destNorm };
      const tiers: [string, string, string | null][] = [
        ["gp20", "20GP", row[3] ? row[3].toString() : null],
        ["hq40", "40HQ", row[4] ? row[4].toString() : null],
        ["nor40", "40NOR", row[5] ? row[5].toString() : null],
      ];
      for (const [tierKey, tierLabel, raw] of tiers) {
        pushTierPrice(out, podBase, tierKey, tierLabel, raw, FCL_PRICE_HISTORY_MARKUP, extractOceanPrice);
      }
    }
  }
  return out;
}

function parseLclRows(
  data: string[][],
  startRow = 0,
  source: RowSource = "historical",
): RawHistoricalRow[] {
  const out: RawHistoricalRow[] = [];
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row?.[1] || !row?.[3]) continue;
    const originLabel = row[1].toString().trim();
    const podRaw = row[3].toString().trim();
    const originNorm = normalizeOcean(originLabel);
    const validUntil = row[10]?.toString().trim() || "";
    if (!validUntil || !parseValidUntilToDate(validUntil)) continue;

    const country = getPolCountry(originNorm, originLabel, "lcl");
    const entityLabel = formatEntityLabel(row[7]);
    const base = {
      mode: "lcl" as const,
      originLabel,
      originNorm,
      entityLabel,
      entityKey: normalizeEntityKey(row[7]),
      validUntil,
      currency: (row[5]?.toString().trim().toUpperCase() === "EUR" ? "EUR" : "USD") as PriceHistoryCurrency,
      countryCode: country.code,
      countryLabel: country.label,
      podRaw,
      source,
    };

    for (const podNorm of splitCombinedPOD(podRaw)) {
      const destLabel = getPODDisplayName(podNorm);
      const destNorm = podNorm;
      pushTierPrice(
        out,
        { ...base, destLabel, destNorm },
        "ofWM",
        "OF W/M",
        row[4] ? row[4].toString() : null,
        LCL_PRICE_HISTORY_MARKUP,
        extractOceanPrice,
      );
    }
  }
  return out;
}

function buildBundles(rawRows: RawHistoricalRow[]): HistoricalRouteBundle[] {
  const routeMap = new Map<string, HistoricalRouteBundle>();

  for (const row of rawRows) {
    const routeKey = `${row.mode}|${row.originNorm}|${row.destNorm}`;
    let route = routeMap.get(routeKey);
    if (!route) {
      route = {
        routeKey,
        mode: row.mode,
        originLabel: row.originLabel,
        originNorm: row.originNorm,
        destLabel: row.destLabel,
        destNorm: row.destNorm,
        countryCode: row.countryCode,
        countryLabel: row.countryLabel,
        tiers: [],
      };
      routeMap.set(routeKey, route);
    }

    let tier = route.tiers.find((t) => t.tierKey === row.tierKey);
    if (!tier) {
      tier = {
        tierKey: row.tierKey,
        tierLabel: row.tierLabel,
        currency: row.currency,
        entities: [],
      };
      route.tiers.push(tier);
    }

    let entity = tier.entities.find((e) => e.entityKey === row.entityKey);
    if (!entity) {
      entity = {
        entityKey: row.entityKey,
        entityLabel: row.entityLabel,
        points: [],
      };
      tier.entities.push(entity);
    }

    const date = parseValidUntilToDate(row.validUntil);
    if (!date) continue;
    const dateKey = dateToKey(date);
    const label = row.validUntil;
    const existing = entity.points.find((p) => p.dateKey === dateKey);
    const shouldSet =
      !existing ||
      row.source === "current" ||
      row.price < existing.value;
    if (shouldSet) {
      if (existing) {
        existing.value = row.price;
        existing.label = label;
      } else {
        entity.points.push({ dateKey, label, value: row.price });
      }
    }
  }

  for (const route of routeMap.values()) {
    for (const tier of route.tiers) {
      for (const entity of tier.entities) {
        entity.points.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      }
      tier.entities = tier.entities.filter((e) => e.points.length > 0);
    }
    route.tiers = route.tiers.filter((t) => t.entities.length > 0);
  }

  return Array.from(routeMap.values())
    .filter((r) => r.tiers.length > 0)
    .sort((a, b) =>
      `${a.originLabel}${a.destLabel}`.localeCompare(
        `${b.originLabel}${b.destLabel}`,
      ),
    );
}

export function buildHistoricalExplorerSnapshot(
  airData: string[][],
  fclData: string[][],
  lclData: string[][],
  current?: {
    air?: string[][];
    fcl?: string[][];
    lcl?: string[][];
  },
): HistoricalExplorerSnapshot {
  const raw = [
    ...parseAirRows(airData),
    ...parseFclRows(fclData),
    ...parseLclRows(lclData),
    ...(current?.air
      ? parseAirRows(current.air, COTIZADOR_DATA_START_ROW, "current")
      : []),
    ...(current?.fcl
      ? parseFclRows(current.fcl, COTIZADOR_DATA_START_ROW, "current")
      : []),
    ...(current?.lcl
      ? parseLclRows(current.lcl, COTIZADOR_DATA_START_ROW, "current")
      : []),
  ];
  const routes = buildBundles(raw);
  const countryMap = new Map<string, string>();
  for (const route of routes) {
    if (!countryMap.has(route.countryCode)) {
      countryMap.set(route.countryCode, route.countryLabel);
    }
  }
  const countries = Array.from(countryMap.entries())
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => {
      if (a.code === "XX") return 1;
      if (b.code === "XX") return -1;
      return a.label.localeCompare(b.label);
    });

  return { routes, countries };
}

async function fetchCsvRows(url: string): Promise<string[][] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return parseCSV(text) as string[][];
  } catch {
    return null;
  }
}

export async function fetchHistoricalExplorerSnapshot(): Promise<HistoricalExplorerSnapshot> {
  const [
    airRes,
    fclRes,
    lclRes,
    airCurrent,
    fclCurrent,
    lclCurrent,
  ] = await Promise.all([
    fetch(AIR_HISTORICAL_URL),
    fetch(FCL_HISTORICAL_URL),
    fetch(LCL_HISTORICAL_URL),
    fetchCsvRows(AIR_CURRENT_CSV_URL),
    fetchCsvRows(FCL_CURRENT_CSV_URL),
    fetchCsvRows(LCL_CURRENT_CSV_URL),
  ]);

  if (!airRes.ok || !fclRes.ok || !lclRes.ok) {
    throw new Error("No se pudieron cargar los históricos de precios.");
  }

  const [airText, fclText, lclText] = await Promise.all([
    airRes.text(),
    fclRes.text(),
    lclRes.text(),
  ]);

  return buildHistoricalExplorerSnapshot(
    parseCSV(airText) as string[][],
    parseCSV(fclText) as string[][],
    parseCSV(lclText) as string[][],
    {
      air: airCurrent ?? undefined,
      fcl: fclCurrent ?? undefined,
      lcl: lclCurrent ?? undefined,
    },
  );
}

export function pickRandomFeatured(
  snapshot: HistoricalExplorerSnapshot,
): {
  route: HistoricalRouteBundle;
  tier: HistoricalTierSeries;
} | null {
  const candidates: { route: HistoricalRouteBundle; tier: HistoricalTierSeries }[] = [];
  for (const route of snapshot.routes) {
    for (const tier of route.tiers) {
      if (tier.entities.some((e) => e.points.length > 0)) {
        candidates.push({ route, tier });
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function filterRoutesByCountryAndMode(
  snapshot: HistoricalExplorerSnapshot,
  countryCode: string,
  mode: ExplorerMode,
): HistoricalRouteBundle[] {
  return snapshot.routes.filter(
    (r) => r.countryCode === countryCode && r.mode === mode,
  );
}

export interface OriginCityOption {
  originNorm: string;
  originLabel: string;
}

export function listOriginCitiesFromRoutes(
  routes: HistoricalRouteBundle[],
): OriginCityOption[] {
  const byNorm = new Map<string, string>();
  for (const route of routes) {
    if (!byNorm.has(route.originNorm)) {
      byNorm.set(route.originNorm, route.originLabel);
    }
  }
  return Array.from(byNorm.entries())
    .map(([originNorm, originLabel]) => ({ originNorm, originLabel }))
    .sort((a, b) => a.originLabel.localeCompare(b.originLabel));
}

export function filterRoutesByOriginCity(
  routes: HistoricalRouteBundle[],
  originNorm: string,
): HistoricalRouteBundle[] {
  if (!originNorm) return routes;
  return routes.filter((r) => r.originNorm === originNorm);
}

export interface TierFilterOption {
  tierKey: string;
  tierLabel: string;
}

export function listTierOptionsFromRoutes(
  routes: HistoricalRouteBundle[],
  mode: ExplorerMode,
): TierFilterOption[] {
  const labelByKey = new Map<string, string>();
  for (const route of routes) {
    for (const tier of route.tiers) {
      labelByKey.set(tier.tierKey, tier.tierLabel);
    }
  }

  const order =
    mode === "air"
      ? AIR_TIER_ORDER
      : mode === "fcl"
        ? FCL_TIER_ORDER
        : [];

  const ordered: TierFilterOption[] = [];
  for (const { tierKey, tierLabel } of order) {
    if (labelByKey.has(tierKey)) {
      ordered.push({ tierKey, tierLabel: labelByKey.get(tierKey) ?? tierLabel });
      labelByKey.delete(tierKey);
    }
  }

  const rest = Array.from(labelByKey.entries())
    .map(([tierKey, tierLabel]) => ({ tierKey, tierLabel }))
    .sort((a, b) => a.tierLabel.localeCompare(b.tierLabel));

  return [...ordered, ...rest];
}

export function filterRoutesByTierKey(
  routes: HistoricalRouteBundle[],
  tierKey: string,
): HistoricalRouteBundle[] {
  if (!tierKey) return routes;
  return routes
    .map((route) => ({
      ...route,
      tiers: route.tiers.filter((t) => t.tierKey === tierKey),
    }))
    .filter((route) => route.tiers.length > 0);
}
