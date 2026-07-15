export const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTWBXW_l3kB2V0A9D732Le0AjyGnXDjgV8nasTz1Z3gWUbCklXKICxTE4kEMjYMoaTG4v78XB2aVrHe/pub?output=csv";

// TIPOS E INTERFACES
export interface RutaAerea {
  id: string;
  origin: string;
  originNormalized: string;
  destination: string;
  destinationNormalized: string;

  kg45: string | null;
  kg100: string | null;
  kg300: string | null;
  kg500: string | null;
  kg1000: string | null;

  carrier: string | null;
  carrierNormalized: string | null;
  frequency: string | null;
  transitTime: string | null;
  routing: string | null;
  remark1: string | null;
  remark2: string | null;
  validUntil: string | null;
  company: string | null;

  // FCA charges (from CSV columns 17, 18, 19)
  localCharges: number;
  gastosXKg: number;
  minGastosXKg: number;

  // Mínimo flete aéreo (CSV column 20). 0 = sin mínimo definido.
  minAirFreight: number;

  row_number: number;
  priceForComparison: number;
  currency: Currency;
}

export interface SelectOption {
  value: string;
  label: string;
}

export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "CHF" | "CLP" | "SEK";


// FUNCIONES HELPER - PARSING Y FORMATEO
export const extractPrice = (priceStr: string | null): number => {
  if (!priceStr) return 0;
  const cleaned = priceStr.toString().replace(/[^\d,\.]/g, "");
  const normalized = cleaned.replace(",", ".");
  const price = parseFloat(normalized);
  return isNaN(price) ? 0 : price;
};

export const parseCurrency = (currencyStr: string | null): Currency => {
  if (!currencyStr) return "USD";
  const str = currencyStr.toString().trim().toUpperCase();

  if (str === "EUR") return "EUR";
  if (str === "GBP") return "GBP";
  if (str === "CAD") return "CAD";
  if (str === "CHF") return "CHF";
  if (str === "CLP") return "CLP";
  if (str === "SEK") return "SEK";
  if (str === "USD") return "USD";

  return "USD"; // Default fallback
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

// FUNCIÓN PARA PARSEAR CSV CORRECTAMENTE
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

export const capitalize = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(/(\s|\(|\))/) // Divide por espacios, paréntesis de apertura y cierre
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
};

export const getLowestPrice = (
  ruta: RutaAerea,
  currency: Currency,
): { price: number; currency: Currency } => {
  const tarifas = [ruta.kg45, ruta.kg100, ruta.kg300, ruta.kg500, ruta.kg1000];

  for (const tarifa of tarifas) {
    if (tarifa) {
      return {
        price: extractPrice(tarifa),
        currency: currency,
      };
    }
  }

  return { price: 0, currency: currency };
};

export const parseAEREO = (data: any[]): RutaAerea[] => {
  const rutas: RutaAerea[] = [];
  let idCounter = 1;

  for (let i = 2; i < data.length; i++) {
    const row: any = data[i];
    if (!row) continue;

    const origin = row[1];
    const destination = row[2];
    const kg45 = row[3];
    const kg100 = row[4];
    const kg300 = row[5];
    const kg500 = row[6];
    const kg1000 = row[7];
    const carrier = row[8];
    const frequency = row[9];
    const tt = row[10];
    const routing = row[11];
    const remark1 = row[12];
    const remark2 = row[13];
    const currency = row[14];
    const validUntil = row[15];
    const company = row[16];
    const localChargesRaw = row[17];
    const gastosXKgRaw = row[18];
    const minGastosXKgRaw = row[19];
    const minAirFreightRaw = row[20];

    if (
      origin &&
      destination &&
      typeof origin === "string" &&
      typeof destination === "string"
    ) {
      // Parsear la moneda desde la columna [14]
      const parsedCurrency = parseCurrency(currency);

      const lowestPrice = getLowestPrice(
        {
          kg45: kg45 ? kg45.toString().trim() : null,
          kg100: kg100 ? kg100.toString().trim() : null,
          kg300: kg300 ? kg300.toString().trim() : null,
          kg500: kg500 ? kg500.toString().trim() : null,
          kg1000: kg1000 ? kg1000.toString().trim() : null,
        } as RutaAerea,
        parsedCurrency,
      );

      rutas.push({
        id: `AEREO-${idCounter++}`,
        origin: capitalize(
          origin
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim(),
        ),
        originNormalized: normalize(origin),
        destination: capitalize(
          destination
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim(),
        ),
        destinationNormalized: normalize(destination),
        kg45: kg45 ? kg45.toString().trim() : null,
        kg100: kg100 ? kg100.toString().trim() : null,
        kg300: kg300 ? kg300.toString().trim() : null,
        kg500: kg500 ? kg500.toString().trim() : null,
        kg1000: kg1000 ? kg1000.toString().trim() : null,
        carrier: carrier ? carrier.toString().trim() : null,
        carrierNormalized: carrier ? normalize(carrier) : null,
        frequency: frequency ? frequency.toString().trim() : null,
        transitTime: tt ? tt.toString().trim() : null,
        routing: routing ? routing.toString().trim() : null,
        remark1: remark1 ? remark1.toString().trim() : null,
        remark2: remark2 ? remark2.toString().trim() : null,
        validUntil: validUntil ? validUntil.toString().trim() : null,
        company: company ? company.toString().trim() : null,
        localCharges: extractPrice(
          localChargesRaw ? localChargesRaw.toString().trim() : null,
        ),
        gastosXKg: extractPrice(
          gastosXKgRaw ? gastosXKgRaw.toString().trim() : null,
        ),
        minGastosXKg: extractPrice(
          minGastosXKgRaw ? minGastosXKgRaw.toString().trim() : null,
        ),
        minAirFreight: extractPrice(
          minAirFreightRaw ? minAirFreightRaw.toString().trim() : null,
        ),
        row_number: i + 1,
        priceForComparison: lowestPrice.price,
        currency: parsedCurrency, // 🆕 Usar la moneda parseada desde columna [14]
      });
    }
  }

  return rutas;
};

export interface TarifaSeleccionada {
  precio: number;
  moneda: Currency;
  rango: string;
  precioConMarkup: number;
}

export interface PieceData {
  id: string;
  packageType: string;
  description: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  noApilable: boolean;
  // Calculados
  volume: number;
  totalVolume: number;
  volumeWeight: number;
  totalVolumeWeight: number;
  totalWeight: number;
}

export interface ClienteAsignado {
  id: string;
  email: string;
  username: string;
  usernames?: string[];
  nombreuser: string;
  createdAt: string;
}

export interface QuoteAIRProps {
  preselectedOrigin?: { value: string; label: string } | null;
  preselectedDestination?: { value: string; label: string } | null;
  isEjecutivoMode?: boolean;
  isSimulationMode?: boolean;
}

// ============================================================================
// VALIDACIÓN DE RANGOS DE PESO: detecta si la ruta tiene precio en el rango actual
// ============================================================================

export interface WeightRangeValidation {
  rangoActual: string;
  tienePrecio: boolean;
  siguienteRangoDisponible: string | null;
  pesoMinimoRequerido: number | null;
  rangosDisponibles: {
    rango: string;
    limiteInferior: number;
    disponible: boolean;
  }[];
}

/**
 * Determina si el peso chargeable cae en un rango con precio disponible.
 * Si no hay precio, indica cuál es el siguiente rango con precio disponible.
 */

export const getWeightRangeValidation = (
  ruta: RutaAerea,
  pesoChargeable: number,
): WeightRangeValidation => {
  const rangos = [
    { limiteInferior: 0, tarifa: ruta.kg45, nombre: "45-99kg" },
    { limiteInferior: 100, tarifa: ruta.kg100, nombre: "100-299kg" },
    { limiteInferior: 300, tarifa: ruta.kg300, nombre: "300-499kg" },
    { limiteInferior: 500, tarifa: ruta.kg500, nombre: "500-999kg" },
    { limiteInferior: 1000, tarifa: ruta.kg1000, nombre: "+1000kg" },
  ];

  // Determinar en qué rango cae el peso chargeable
  let rangoActualIdx = 0;
  for (let i = rangos.length - 1; i >= 0; i--) {
    if (pesoChargeable >= rangos[i].limiteInferior) {
      rangoActualIdx = i;
      break;
    }
  }

  const rangoActual = rangos[rangoActualIdx];
  const tienePrecio =
    rangoActual.tarifa !== null && extractPrice(rangoActual.tarifa) > 0;

  // Si no tiene precio, buscar el siguiente rango con precio
  let siguienteRangoDisponible: string | null = null;
  let pesoMinimoRequerido: number | null = null;

  if (!tienePrecio) {
    for (let i = rangoActualIdx + 1; i < rangos.length; i++) {
      if (rangos[i].tarifa !== null && extractPrice(rangos[i].tarifa) > 0) {
        siguienteRangoDisponible = rangos[i].nombre;
        pesoMinimoRequerido = rangos[i].limiteInferior;
        break;
      }
    }
  }

  const rangosDisponibles = rangos.map((r) => ({
    rango: r.nombre,
    limiteInferior: r.limiteInferior,
    disponible: r.tarifa !== null && extractPrice(r.tarifa) > 0,
  }));

  return {
    rangoActual: rangoActual.nombre,
    tienePrecio,
    siguienteRangoDisponible,
    pesoMinimoRequerido,
    rangosDisponibles,
  };
};

// FUNCIÓN PARA SELECCIONAR TARIFA SEGÚN PESO CHARGEABLE
export const seleccionarTarifaPorPeso = (
  ruta: RutaAerea,
  pesoChargeable: number,
): TarifaSeleccionada | null => {
  // Definir los rangos en orden ascendente
  const rangos = [
    { limite: 45, tarifa: ruta.kg45, nombre: "45kg" },
    { limite: 100, tarifa: ruta.kg100, nombre: "100kg" },
    { limite: 300, tarifa: ruta.kg300, nombre: "300kg" },
    { limite: 500, tarifa: ruta.kg500, nombre: "500kg" },
    { limite: 1000, tarifa: ruta.kg1000, nombre: "1000kg" },
  ];

  // Encontrar el rango adecuado: el más alto que sea <= al peso chargeable
  let rangoSeleccionado = null;

  for (const rango of rangos) {
    if (rango.tarifa && pesoChargeable >= rango.limite) {
      rangoSeleccionado = rango;
    }
  }

  // Si el peso es menor que 45kg, usar kg45 si existe
  if (!rangoSeleccionado && pesoChargeable < 45 && rangos[0].tarifa) {
    rangoSeleccionado = rangos[0];
  }

  if (!rangoSeleccionado) {
    return null;
  }

  const precio = extractPrice(rangoSeleccionado.tarifa);
  const moneda = ruta.currency; // 🆕 Usar la moneda de la ruta (columna [14])
  const precioConMarkup = precio * 1.15; // 15% adicional para income

  return {
    precio,
    moneda,
    rango: rangoSeleccionado.nombre,
    precioConMarkup,
  };
};
