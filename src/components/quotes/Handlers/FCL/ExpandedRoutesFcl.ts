// ExpandedRoutesFcl.ts
// Carga y parsea el sheet de "Rutas Existentes FCL" para generar
// todas las combinaciones POL × POD expandidas.
// Sistema independiente para FCL — no comparte estado con LCL ni AÉREO.

export const EXPANDED_ROUTES_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqDOOy1LOPWCns63VUeiH2QDRdk7LcTqBT2zKBYE6TZsONKaMlznyyPCNb_TX9z1L8V6znOhL-5sKf/pub?output=csv";

// ============================================================================
// URLs POR PAÍS — agregar aquí cada nuevo país (gid del sheet correspondiente)
// ============================================================================

export const CHINA_PORTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?gid=899880956&single=true&output=csv";

export const USA_PORTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?gid=791272190&single=true&output=csv";

export const SPAIN_PORTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?gid=1857721100&single=true&output=csv";

export const MALAYSIA_PORTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?gid=1667996270&single=true&output=csv";

export const UNITED_KINGDOM_PORTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?gid=34492007&single=true&output=csv";

/**
 * Normalizar texto: quitar acentos, lowercase, trim
 */
const normalize = (str: string): string => {
  if (!str) return "";
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

/**
 * Capitalizar cada palabra
 */
const capitalize = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Detecta si un POD es una combinación de puertos (e.g. "San Antonio - Valparaiso").
 * Devuelve un array con los puertos individuales normalizados.
 */
const splitCombinedPOD = (pod: string): string[] => {
  if (!pod) return [""];

  const podLower = pod
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const combinedPatterns: { [key: string]: string[] } = {
    "san antonio - valparaiso": ["san antonio", "valparaiso"],
    "san antonio / valparaiso": ["san antonio", "valparaiso"],
    "vap / sai": ["san antonio", "valparaiso"],
    "sai / vap": ["san antonio", "valparaiso"],
    "valparaiso - san antonio": ["san antonio", "valparaiso"],
    "valparaiso / san antonio": ["san antonio", "valparaiso"],
  };

  if (combinedPatterns[podLower]) {
    return combinedPatterns[podLower];
  }

  return [podLower];
};

const getPODDisplayName = (podNormalized: string): string => {
  const displayNames: { [key: string]: string } = {
    valparaiso: "Valparaiso",
    "san antonio": "San Antonio",
    iquique: "Iquique",
    "iquique via san antonio": "Iquique via San Antonio",
    santos: "Santos",
    callao: "Callao",
    tbc: "Tbc",
  };

  return displayNames[podNormalized] || capitalize(podNormalized);
};

/**
 * Parsea el CSV del tercer sheet.
 * El CSV tiene columnas: [vacía], POL, POD
 * - Extrae todos los POL únicos (row[1]) y POD únicos (row[2])
 * - Normaliza y deduplica nombres
 */
export interface ExpandedRoutesData {
  pols: Array<{ value: string; label: string }>;
  pods: Array<{ value: string; label: string }>;
  rows: Array<{ polNorm: string; podNorm: string; podLabel: string }>;
}

export const parseExpandedRoutesCSV = (csvText: string): ExpandedRoutesData => {
  const lines = csvText.split("\n");

  // Maps para deduplicar (normalized → display name preferido)
  const polMap = new Map<string, string>();
  const podMap = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parsear línea CSV simple (sin comillas complejas en este sheet)
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

    const polRaw = fields[1]?.trim();
    const podRaw = fields[2]?.trim();

    const polNorm = polRaw ? normalize(polRaw) : "";

    if (polRaw && polNorm) {
      if (!polMap.has(polNorm)) {
        polMap.set(polNorm, capitalize(polRaw));
      }
    }

    if (podRaw) {
      const parts = splitCombinedPOD(podRaw);
      for (const norm of parts) {
        if (norm && !podMap.has(norm)) {
          podMap.set(norm, getPODDisplayName(norm));
        }
      }
    }
  }

  const pols = Array.from(polMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const pods = Array.from(podMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Generate ALL combinations: every POL × every POD
  const rows: Array<{ polNorm: string; podNorm: string; podLabel: string }> = [];
  for (const pol of pols) {
    for (const pod of pods) {
      rows.push({ polNorm: pol.value, podNorm: pod.value, podLabel: pod.label });
    }
  }

  return { pols, pods, rows };
};

/**
 * Carga el CSV de rutas expandidas desde Google Sheets
 */
export const fetchExpandedRoutes = async (): Promise<ExpandedRoutesData> => {
  const response = await fetch(EXPANDED_ROUTES_CSV_URL);
  if (!response.ok) {
    throw new Error(`Error al cargar rutas expandidas: ${response.status}`);
  }
  const csvText = await response.text();
  return parseExpandedRoutesCSV(csvText);
};

// ============================================================================
// API GENÉRICA DE PUERTOS POR PAÍS (selector EXW marítimo FCL)
// Para agregar un nuevo país: añadir su URL arriba y una entrada en
// COUNTRY_PORT_CONFIGS con el prefijo UN/LOCODE correspondiente.
// ============================================================================

/**
 * Registro de países soportados para selección de puerto EXW (FCL).
 * Cada entrada mapea un prefijo UN/LOCODE (2 letras) a la URL de su CSV.
 * Agregar aquí para soportar un nuevo país — sin tocar ningún otro archivo.
 */
export const COUNTRY_PORT_CONFIGS: ReadonlyArray<{ prefix: string; url: string }> = [
  { prefix: "CN", url: CHINA_PORTS_CSV_URL },
  { prefix: "US", url: USA_PORTS_CSV_URL },
  { prefix: "ES", url: SPAIN_PORTS_CSV_URL },
  { prefix: "MY", url: MALAYSIA_PORTS_CSV_URL },
  { prefix: "GB", url: UNITED_KINGDOM_PORTS_CSV_URL },
];

/**
 * Puerto con coordenadas para cualquier país.
 * Estructura: col[1] = nombre, col[2] = lat, col[3] = lng en el CSV.
 */
export interface CountryPort {
  value: string; // nombre normalizado (lowercase, sin acentos)
  label: string; // nombre para mostrar
  lat: number;
  lng: number;
}

/**
 * Distancia haversine en kilómetros entre dos coordenadas.
 */
export function haversineKm(
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
 * Devuelve los N puertos más cercanos a una coordenada, con distancia adjunta.
 */
export function getNearestPorts(
  origin: { lat: number; lng: number },
  ports: CountryPort[],
  count = 3,
): Array<CountryPort & { distanceKm: number }> {
  return ports
    .map((p) => ({ ...p, distanceKm: haversineKm(origin, p) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count);
}

/**
 * Parsea el CSV de cualquier hoja de puertos por país.
 * Estructura: col[0] vacía, col[1] = nombre, col[2] = lat, col[3] = lng.
 */
export const parseCountryPortsCSV = (csvText: string): CountryPort[] => {
  const lines = csvText.split("\n");
  const ports: CountryPort[] = [];

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
    if (nameRaw.toLowerCase() === "puerto principal") continue;

    const lat = parseFloat(latRaw.replace(",", "."));
    const lng = parseFloat(lngRaw.replace(",", "."));
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    const norm = nameRaw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    ports.push({ value: norm, label: nameRaw.trim(), lat, lng });
  }

  return ports;
};

/**
 * Carga y parsea los puertos de un país dado su URL de CSV.
 */
export const fetchCountryPorts = async (url: string): Promise<CountryPort[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al cargar puertos: ${response.status}`);
  }
  const csvText = await response.text();
  return parseCountryPortsCSV(csvText);
};
