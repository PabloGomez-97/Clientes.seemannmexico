export interface ExwRatedPoint {
  value: string;
  label: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

export interface ExwMapDestinationCoords {
  lat: number;
  lng: number;
  name: string;
  code: string;
}

/**
 * Destino del mapa EXW: respeta el puerto/aeropuerto elegido en el selector alternativo.
 */
export function resolveExwMapDestination(
  nearbyRated: ExwRatedPoint[],
  selected: { value: string } | null,
  getCode: (normalizedValue: string) => string,
): ExwMapDestinationCoords | null {
  if (nearbyRated.length === 0) return null;

  const effective = selected
    ? (nearbyRated.find((p) => p.value === selected.value) ?? nearbyRated[0])
    : nearbyRated[0];

  return {
    lat: effective.lat,
    lng: effective.lng,
    name: effective.label,
    code: getCode(effective.value),
  };
}
