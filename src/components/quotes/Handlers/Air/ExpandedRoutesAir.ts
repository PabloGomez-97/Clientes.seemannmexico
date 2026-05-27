// ExpandedRoutesAir.ts
// Carga y parsea el sheet de "Rutas Aéreas Expandidas" para generar
// todas las combinaciones Origin × Destination expandidas.

export const EXPANDED_ROUTES_AIR_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRH46DfK8BWlYXwZoR3UdVP_mXiQZn_JdWaQwCQUGPmu5qv6Eov2hNnoaaZHpWXN1VXfL7vqIgpwOyD/pub?output=csv";

const normalize = (str: string): string => {
  if (!str) return "";
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const capitalize = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export interface ExpandedRoutesAirData {
  origins: Array<{ value: string; label: string }>;
  destinations: Array<{ value: string; label: string }>;
  rows: Array<{ originNorm: string; destNorm: string; destLabel: string }>;
}

export const parseExpandedRoutesAirCSV = (
  csvText: string,
): ExpandedRoutesAirData => {
  const lines = csvText.split("\n");

  const originMap = new Map<string, string>();
  const destMap = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields: string[] = [];
    let currentField = "";
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          j++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());

    const originRaw = fields[1]?.trim();
    const destRaw = fields[2]?.trim();

    const originNorm = originRaw ? normalize(originRaw) : "";

    if (originRaw && originNorm) {
      if (!originMap.has(originNorm)) {
        originMap.set(originNorm, capitalize(originRaw));
      }
    }

    if (destRaw) {
      const destNorm = normalize(destRaw);
      if (destNorm && !destMap.has(destNorm)) {
        destMap.set(destNorm, capitalize(destRaw));
      }
    }
  }

  const origins = Array.from(originMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const destinations = Array.from(destMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Generate ALL combinations: every Origin × every Destination
  const rows: Array<{ originNorm: string; destNorm: string; destLabel: string }> = [];
  for (const origin of origins) {
    for (const dest of destinations) {
      rows.push({ originNorm: origin.value, destNorm: dest.value, destLabel: dest.label });
    }
  }

  return { origins, destinations, rows };
};

export const fetchExpandedRoutesAir =
  async (): Promise<ExpandedRoutesAirData> => {
    const response = await fetch(EXPANDED_ROUTES_AIR_CSV_URL);
    if (!response.ok) {
      throw new Error(
        `Error al cargar rutas aéreas expandidas: ${response.status}`,
      );
    }
    const csvText = await response.text();
    return parseExpandedRoutesAirCSV(csvText);
  };

// ============================================================================
// API GENÉRICA DE AEROPUERTOS POR PAÍS (selector EXW aéreo)
// Para agregar un nuevo país: añadir su URL abajo y una entrada en
// COUNTRY_AIRPORT_CONFIGS con el countryCode ISO-3166-1 alpha-2.
// ============================================================================

export const USA_AIRPORTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRH46DfK8BWlYXwZoR3UdVP_mXiQZn_JdWaQwCQUGPmu5qv6Eov2hNnoaaZHpWXN1VXfL7vqIgpwOyD/pub?gid=333350608&single=true&output=csv";

export const CHINA_AIRPORTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRH46DfK8BWlYXwZoR3UdVP_mXiQZn_JdWaQwCQUGPmu5qv6Eov2hNnoaaZHpWXN1VXfL7vqIgpwOyD/pub?gid=1390179997&single=true&output=csv";

/**
 * Registro de países soportados para selección de aeropuerto en EXW aéreo.
 * countryCode = código ISO-3166-1 alpha-2, mismo que AirportCoords.countryCode.
 * Agregar aquí para soportar un nuevo país — sin tocar ningún otro archivo.
 */
export const COUNTRY_AIRPORT_CONFIGS: ReadonlyArray<{
  countryCode: string;
  url: string;
}> = [
  { countryCode: "US", url: USA_AIRPORTS_CSV_URL },
  { countryCode: "CN", url: CHINA_AIRPORTS_CSV_URL },
];

/**
 * Aeropuerto con coordenadas para cualquier país.
 * Estructura CSV: col[0] vacía, col[1] = nombre, col[2] = lat, col[3] = lng.
 */
export interface CountryAirport {
  value: string; // nombre normalizado (lowercase, sin acentos)
  label: string; // nombre para mostrar
  lat: number;
  lng: number;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Devuelve los N aeropuertos más cercanos a una coordenada, con distancia adjunta.
 */
export function getNearestAirports(
  origin: { lat: number; lng: number },
  airports: CountryAirport[],
  count = 4,
): Array<CountryAirport & { distanceKm: number }> {
  return airports
    .map((a) => ({ ...a, distanceKm: haversineKm(origin, a) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count);
}

/**
 * Parsea el CSV de cualquier hoja de aeropuertos por país.
 * Estructura: col[0] vacía, col[1] = nombre, col[2] = lat, col[3] = lng.
 */
export const parseCountryAirportsCSV = (csvText: string): CountryAirport[] => {
  const lines = csvText.split("\n");
  const airports: CountryAirport[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields: string[] = [];
    let currentField = "";
    let insideQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          j++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());

    const nameRaw = fields[1]?.trim();
    const latRaw = fields[2]?.trim();
    const lngRaw = fields[3]?.trim();

    if (!nameRaw || !latRaw || !lngRaw) continue;
    if (nameRaw.toLowerCase() === "aeropuerto principal") continue;

    const lat = parseFloat(latRaw.replace(",", "."));
    const lng = parseFloat(lngRaw.replace(",", "."));
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    const norm = nameRaw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    airports.push({ value: norm, label: nameRaw.trim(), lat, lng });
  }

  return airports;
};

/**
 * Carga y parsea los aeropuertos de un país dado su URL de CSV.
 */
export const fetchCountryAirports = async (
  url: string,
): Promise<CountryAirport[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al cargar aeropuertos: ${response.status}`);
  }
  const csvText = await response.text();
  return parseCountryAirportsCSV(csvText);
};
