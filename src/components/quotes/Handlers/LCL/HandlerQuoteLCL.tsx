// HandlerQuoteLCL.tsx
// Handlers y tipos para cotizaciones LCL

export interface ClienteAsignado {
  id: string;
  email: string;
  username: string;
  usernames?: string[];
  nombreuser: string;
  createdAt: string;
}

export interface QuoteLCLProps {
  preselectedPOL?: { value: string; label: string } | null;
  preselectedPOD?: { value: string; label: string } | null;
  isEjecutivoMode?: boolean;
  isSimulationMode?: boolean;
}

export interface PieceData {
  id: string;
  packageType: string;
  description: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  isNotApilable: boolean;
  // Calculados
  volume: number;
  totalVolume: number;
  weightTons: number; // peso en toneladas
  totalWeightTons: number; // peso total en toneladas
  wmChargeable: number; // W/M individual (mayor entre toneladas y volumen)
}

// Sin Linbis: no usamos OutletContext en cotizaciones México

export interface RutaLCL {
  id: string;
  pol: string;
  polNormalized: string;
  pod: string;
  podNormalized: string;
  servicio: string | null;
  ofWM: number;
  ofWMString: string;
  currency: "USD" | "EUR";
  frecuencia: string | null;
  agente: string | null;
  ttAprox: string | null;
  operador: string;
  operadorNormalized: string;
  validUntil: string | null;
  row_number: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYi3-CA6itt2SBNYumE3fuxpE0SSAtMMPn7K2LaqRPmduRvU3hSu11Vznn8NtG2yuDriuuL2E8VvOG/pub?output=csv";

export type Operador = string;

export const extractPrice = (priceValue: any): number => {
  if (!priceValue) return 0;
  if (typeof priceValue === "number") return priceValue;

  // Reemplazamos cualquier coma por un punto para que JS reconozca el decimal
  const formattedValue = priceValue.toString().replace(/,/g, ".");

  // Extraemos solo los números y el posible punto decimal
  const match = formattedValue.match(/\d+\.?\d*/);
  if (!match) return 0;

  return parseFloat(match[0]);
};

export const getBillableWM = (weightTons: number, volumeM3: number): number => {
  const calculatedWM = Math.max(weightTons, volumeM3);

  if (calculatedWM <= 0) return 0;

  return Math.max(calculatedWM, 1);
};

export const normalize = (str: string | null): string => {
  if (!str) return "";
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export const capitalize = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const parseCSV = (csvText: string): any[] => {
  const lines = csvText.split("\n");
  const result: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row: any[] = [];
    let currentField = "";
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          j++; // Skip next quote
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        // End of field
        row.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }

    // Add last field
    row.push(currentField.trim());
    result.push(row);
  }

  return result;
};

/**
 * Detecta si un POD es una combinación de puertos (e.g. "San Antonio - Valparaiso").
 * Devuelve un array con los puertos individuales normalizados.
 * Si es un solo puerto, devuelve un array con un solo elemento.
 */
export const splitCombinedPOD = (pod: string): string[] => {
  if (!pod) return [""];

  const podLower = pod
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  // Variantes combinadas que deben separarse
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

  // Puerto individual
  return [podLower];
};

export const normalizePOD = (pod: string): string => {
  if (!pod) return "";
  // Para compatibilidad, devuelve el primer puerto del split
  const parts = splitCombinedPOD(pod);
  return parts[0];
};

export const getPODDisplayName = (podNormalized: string): string => {
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

export const parseLCL = (data: any[]): RutaLCL[] => {
  const rutas: RutaLCL[] = [];
  let idCounter = 1;

  for (let i = 2; i < data.length; i++) {
    const row: any = data[i];
    if (!row) continue;

    const pol = row[1];
    const servicio = row[2];
    const pod = row[3];
    const ofWM = row[4];
    const currency = row[5];
    const frecuencia = row[6];
    const agente = row[7];
    const ttAprox = row[8];
    const operador = row[9];
    const validUntil = row[10];

    if (
      pol &&
      pod &&
      typeof pol === "string" &&
      typeof pod === "string" &&
      ofWM &&
      operador
    ) {
      const ofWMNumber = extractPrice(ofWM);

      // Separar PODs combinados (e.g. "San Antonio - Valparaiso") en entradas individuales
      const podParts = splitCombinedPOD(pod);

      for (const podNorm of podParts) {
        rutas.push({
          id: `LCL-${idCounter++}`,
          pol: capitalize(
            pol
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim(),
          ),
          polNormalized: normalize(pol),
          pod: getPODDisplayName(podNorm),
          podNormalized: podNorm,
          servicio: servicio ? servicio.toString().trim() : null,
          ofWM: ofWMNumber,
          ofWMString: ofWM.toString().trim(),
          currency:
            currency && currency.toString().toUpperCase() === "EUR"
              ? "EUR"
              : "USD",
          frecuencia: frecuencia ? frecuencia.toString().trim() : null,
          agente: agente ? agente.toString().trim() : null,
          ttAprox: ttAprox ? ttAprox.toString().trim() : null,
          operador: operador.toString().trim(),
          operadorNormalized: normalize(operador),
          validUntil: validUntil ? validUntil.toString().trim() : null,
          row_number: i + 1,
        });
      }
    }
  }

  return rutas;
};
