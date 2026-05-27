import { capitalize, normalize, parseCSV } from "../FCL/HandlerQuoteFCL";

export const GOOGLE_SHEET_LASTMILE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQR3oDDQTX5G7AN0yEkV3dzDS_SHP3ERZNkud92VuugEO2tggHh4hi9Ssat8L_VrTsmRmVCrXkQGQ1r/pub?output=csv";

export interface LastMileSelectOption {
  value: string;
  label: string;
}

export interface RutaLastMile {
  id: string;
  origen: string;
  origenNormalized: string;
  destino: string;
  destinoNormalized: string;
}

export interface ClienteAsignadoLM {
  id: string;
  email: string;
  username: string;
  usernames?: string[];
  nombreuser: string;
  createdAt: string;
}

export interface QuoteLastMileProps {
  preselectedOrigin?: { value: string; label: string } | null;
  preselectedDestination?: { value: string; label: string } | null;
  isEjecutivoMode?: boolean;
}

/**
 * Estructura de pieza para Última Milla. Mismo modelo que el sistema de
 * piezas de QuoteAIR pero sin `noApilable`. Las dimensiones se almacenan
 * siempre en SI (cm / kg). El factor volumétrico utilizado es 167 kg/m³.
 */
export interface PieceDataLM {
  id: string;
  packageType: string;
  description: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  // Calculados
  volume: number;
  totalVolume: number;
  volumeWeight: number;
  totalVolumeWeight: number;
  totalWeight: number;
}

/**
 * Parsea el CSV publicado del sheet de Última Milla.
 * Estructura observada:
 *   col[0] vacío | col[1] = Origen | col[2] = Destino
 *
 * Existen N orígenes (col[1] en filas sucesivas) y un único destino
 * (col[2] en la primera fila con datos). El resultado expande la combinación
 * NxM (típicamente Nx1).
 */

export const parseLastMile = (data: any[]): RutaLastMile[] => {
  const origenes: { raw: string; norm: string }[] = [];
  const destinos: { raw: string; norm: string }[] = [];

  for (let i = 0; i < data.length; i++) {
    const row: any = data[i];
    if (!row) continue;

    const colA = (row[1] || row[0] || "").toString().trim();
    const colB = (row[2] || "").toString().trim();

    if (colA && !/^origen$/i.test(colA)) {
      const norm = normalize(colA);
      if (norm && !origenes.find((o) => o.norm === norm)) {
        origenes.push({ raw: colA, norm });
      }
    }
    if (colB && !/^destino$/i.test(colB)) {
      const norm = normalize(colB);
      if (norm && !destinos.find((d) => d.norm === norm)) {
        destinos.push({ raw: colB, norm });
      }
    }
  }

  const rutas: RutaLastMile[] = [];
  let id = 1;
  for (const o of origenes) {
    for (const d of destinos) {
      rutas.push({
        id: `LM-${id++}`,
        origen: capitalize(o.raw),
        origenNormalized: o.norm,
        destino: capitalize(d.raw),
        destinoNormalized: d.norm,
      });
    }
  }
  return rutas;
};

export { parseCSV };
