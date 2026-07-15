import type { AirShipment, OceanShipment } from "../../../Sidebar/shipsgo/types";
import {
  findAirportCatalogKeyByIata,
  labelFromAirCatalogKey,
  resolveOceanPortNormForRates,
} from "./popularRouteMatching";

export interface PopularRouteStat {
  /** Etiqueta visible, ej. "MIA → SCL" o "Shanghai → San Antonio". */
  label: string;
  count: number;
  mode: "air" | "ocean";
  originNorm: string;
  destNorm: string;
  originLabel: string;
  destLabel: string;
}

const TOP_ROUTES = 5;

export function computeAirPopularRoutes(
  shipments: AirShipment[],
): PopularRouteStat[] {
  const map = new Map<
    string,
    {
      count: number;
      originNorm: string;
      destNorm: string;
      originLabel: string;
      destLabel: string;
      label: string;
    }
  >();

  for (const s of shipments) {
    const o = s.route?.origin.location.iata;
    const d = s.route?.destination.location.iata;
    if (!o || !d) continue;

    const originKey = findAirportCatalogKeyByIata(o);
    const destKey = findAirportCatalogKeyByIata(d);
    if (!originKey || !destKey) continue;

    const originNorm = originKey;
    const destNorm = destKey;
    const label = `${o} → ${d}`;
    const key = `air|${originNorm}|${destNorm}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        count: 1,
        originNorm,
        destNorm,
        originLabel: labelFromAirCatalogKey(originKey),
        destLabel: labelFromAirCatalogKey(destKey),
        label,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_ROUTES)
    .map((item) => ({
      label: item.label,
      count: item.count,
      mode: "air" as const,
      originNorm: item.originNorm,
      destNorm: item.destNorm,
      originLabel: item.originLabel,
      destLabel: item.destLabel,
    }));
}

export function computeOceanPopularRoutes(
  shipments: OceanShipment[],
): PopularRouteStat[] {
  const map = new Map<
    string,
    {
      count: number;
      originNorm: string;
      destNorm: string;
      originLabel: string;
      destLabel: string;
      label: string;
    }
  >();

  for (const s of shipments) {
    const o = s.route?.port_of_loading.location.name;
    const d = s.route?.port_of_discharge.location.name;
    if (!o || !d) continue;

    const originNorm = resolveOceanPortNormForRates(o);
    const destNorm = resolveOceanPortNormForRates(d);
    if (!originNorm || !destNorm) continue;

    const label = `${o} → ${d}`;
    const key = `ocean|${originNorm}|${destNorm}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        count: 1,
        originNorm,
        destNorm,
        originLabel: o.trim(),
        destLabel: d.trim(),
        label,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_ROUTES)
    .map((item) => ({
      label: item.label,
      count: item.count,
      mode: "ocean" as const,
      originNorm: item.originNorm,
      destNorm: item.destNorm,
      originLabel: item.originLabel,
      destLabel: item.destLabel,
    }));
}

export function popularRouteKey(route: PopularRouteStat): string {
  return `${route.mode}|${route.originNorm}|${route.destNorm}`;
}
