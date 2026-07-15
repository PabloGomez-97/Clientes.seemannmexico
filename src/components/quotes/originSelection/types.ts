export interface RatedOrigin {
  normalized: string;
  label: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export interface OriginSelectOption {
  value: string;
  label: string;
}

export interface OriginIndex {
  countries: OriginSelectOption[];
  originsByCountry: Map<string, RatedOrigin[]>;
}

export interface ResolvedRatedOrigin {
  origin: RatedOrigin;
  distanceKm: number;
}

export interface GeoCoords {
  lat: number;
  lng: number;
}
