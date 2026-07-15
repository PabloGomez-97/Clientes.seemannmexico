import { haversineKm } from "./haversine";
import type {
  GeoCoords,
  RatedOrigin,
  ResolvedRatedOrigin,
} from "./types";

export function rankRatedOriginsByDistance(
  pickupCoords: GeoCoords,
  ratedOrigins: RatedOrigin[],
  limit = 4,
): ResolvedRatedOrigin[] {
  return ratedOrigins
    .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng))
    .map((origin) => ({
      origin,
      distanceKm: haversineKm(pickupCoords, {
        lat: origin.lat,
        lng: origin.lng,
      }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export function resolveNearestRatedOrigin(
  pickupCoords: GeoCoords,
  ratedOrigins: RatedOrigin[],
): ResolvedRatedOrigin | null {
  const ranked = rankRatedOriginsByDistance(
    pickupCoords,
    ratedOrigins,
    ratedOrigins.length,
  );
  return ranked[0] ?? null;
}
