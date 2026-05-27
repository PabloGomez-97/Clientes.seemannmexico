// api/agent/sheets.ts
// Fetch + parseo + cache de los 4 Google Sheets de tarifas.
// Cache TTL 5 minutos para no abusar de Google.

export type SheetType = 'AEREO' | 'FCL' | 'LCL' | 'LASTMILE';

export const SHEET_URLS: Record<SheetType, string> = {
  AEREO:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWBXW_l3kB2V0A9D732Le0AjyGnXDjgV8nasTz1Z3gWUbCklXKICxTE4kEMjYMoaTG4v78XB2aVrHe/pub?output=csv',
  FCL:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?output=csv',
  LCL:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vT5T29WmDAI_z4RxlPtY3GoB3pm7NyBBiWZGc06cYRR1hg5fdFx7VEr3-i2geKxgw/pub?output=csv',
  LASTMILE:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQR3oDDQTX5G7AN0yEkV3dzDS_SHP3ERZNkud92VuugEO2tggHh4hi9Ssat8L_VrTsmRmVCrXkQGQ1r/pub?output=csv',
};

// ============================================================================
// CACHE (5 min)
// ============================================================================

interface CacheEntry { rows: string[][]; ts: number }
const CACHE: Partial<Record<SheetType, CacheEntry>> = {};
const TTL_MS = 5 * 60 * 1000;

function parseCSV(csvText: string): string[][] {
  const lines = csvText.split('\n');
  const result: string[][] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;
    const row: string[] = [];
    let field = '';
    let inQ = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (inQ && line[j + 1] === '"') { field += '"'; j++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { row.push(field.trim()); field = ''; }
      else field += c;
    }
    row.push(field.trim());
    result.push(row);
  }
  return result;
}

export async function fetchSheet(type: SheetType): Promise<string[][]> {
  const cached = CACHE[type];
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.rows;

  const res = await fetch(SHEET_URLS[type]);
  if (!res.ok) throw new Error(`Sheet ${type} unreachable (${res.status})`);
  const csv = await res.text();
  const rows = parseCSV(csv);
  CACHE[type] = { rows, ts: Date.now() };
  return rows;
}

// ============================================================================
// PARSERS TIPADOS POR TIPO DE TARIFA
// ============================================================================

function num(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = String(s).replace(/[^0-9.,-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : 0;
}

export interface AirRate {
  origin: string;
  destination: string;
  kg45: number;
  kg100: number;
  kg300: number;
  kg500: number;
  kg1000: number;
  carrier: string;
  frequency: string;
  transitTime: string;
  routing: string;
  currency: string;
  validUntil: string;
  localCharges: number;
  gastosXKg: number;
  minGastosXKg: number;
  minAirFreight: number;
}

export async function getAirRates(): Promise<AirRate[]> {
  const rows = await fetchSheet('AEREO');
  const out: AirRate[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const o = (r[1] || '').trim();
    const d = (r[2] || '').trim();
    if (!o || !d) continue;
    out.push({
      origin: o,
      destination: d,
      kg45: num(r[3]),
      kg100: num(r[4]),
      kg300: num(r[5]),
      kg500: num(r[6]),
      kg1000: num(r[7]),
      carrier: (r[8] || '').trim(),
      frequency: (r[9] || '').trim(),
      transitTime: (r[10] || '').trim(),
      routing: (r[11] || '').trim(),
      currency: (r[14] || 'USD').trim() || 'USD',
      validUntil: (r[15] || '').trim(),
      localCharges: num(r[17]),
      gastosXKg: num(r[18]),
      minGastosXKg: num(r[19]),
      minAirFreight: num(r[20]),
    });
  }
  return out;
}

export interface FclRate {
  pol: string;
  pod: string;
  gp20: number;
  hq40: number;
  nor40: number;
  carrier: string;
  transitTime: string;
  remarks: string;
  freeTime: string;
  currency: string;
  validUntil: string;
}

export async function getFclRates(): Promise<FclRate[]> {
  const rows = await fetchSheet('FCL');
  const out: FclRate[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const pol = (r[1] || '').trim();
    const podRaw = (r[2] || '').trim();
    if (!pol || !podRaw) continue;
    const podList = podRaw.split(/\s*[-/]\s*|\s*,\s*/).map((s) => s.trim()).filter(Boolean);
    for (const pod of podList.length ? podList : [podRaw]) {
      out.push({
        pol,
        pod,
        gp20: num(r[3]),
        hq40: num(r[4]),
        nor40: num(r[5]),
        carrier: (r[6] || '').trim(),
        transitTime: (r[7] || '').trim(),
        remarks: (r[8] || '').trim(),
        freeTime: (r[9] || '').trim(),
        currency: (r[11] || 'USD').trim() || 'USD',
        validUntil: (r[12] || '').trim(),
      });
    }
  }
  return out;
}

export interface LclRate {
  pol: string;
  servicio: string;
  pod: string;
  ofWM: number;       // USD por CBM (W/M)
  currency: string;
  frecuencia: string;
  agente: string;
  transitTime: string;
  operador: string;
  validUntil: string;
}

export async function getLclRates(): Promise<LclRate[]> {
  const rows = await fetchSheet('LCL');
  const out: LclRate[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const pol = (r[1] || '').trim();
    const podRaw = (r[3] || '').trim();
    if (!pol || !podRaw) continue;
    const podList = podRaw.split(/\s*[-/]\s*|\s*,\s*/).map((s) => s.trim()).filter(Boolean);
    for (const pod of podList.length ? podList : [podRaw]) {
      out.push({
        pol,
        servicio: (r[2] || '').trim(),
        pod,
        ofWM: num(r[4]),
        currency: (r[5] || 'USD').trim() || 'USD',
        frecuencia: (r[6] || '').trim(),
        agente: (r[7] || '').trim(),
        transitTime: (r[8] || '').trim(),
        operador: (r[9] || '').trim(),
        validUntil: (r[10] || '').trim(),
      });
    }
  }
  return out;
}

export interface LastmileRoute { origen: string; destino: string }

export async function getLastmileRoutes(): Promise<LastmileRoute[]> {
  const rows = await fetchSheet('LASTMILE');
  const origenes = new Set<string>();
  const destinos = new Set<string>();
  for (const r of rows) {
    if (!r) continue;
    const o = (r[1] || '').trim();
    const d = (r[2] || '').trim();
    if (o) origenes.add(o);
    if (d) destinos.add(d);
  }
  const out: LastmileRoute[] = [];
  for (const o of origenes) for (const d of destinos) out.push({ origen: o, destino: d });
  return out;
}

// Tarifas fijas LASTMILE (espejo de los rangos del frontend).
export const LASTMILE_PRICING = {
  delivery: [
    { maxKg: 500, maxCbm: 2.5, usd: 183.26 },
    { maxKg: 1000, maxCbm: 5, usd: 202.90 },
    { maxKg: 2000, maxCbm: 8, usd: 248.71 },
    { maxKg: 3000, maxCbm: 11, usd: 274.89 },
    { maxKg: 4000, maxCbm: 15, usd: 294.53 },
    { maxKg: 5000, maxCbm: 20, usd: 314.16 },
    { maxKg: 6000, maxCbm: 25, usd: 353.43 },
    { maxKg: 7000, maxCbm: 30, usd: 392.70 },
  ],
  terrestrial: [
    { maxKg: 300, usd: 85.09 },
    { maxKg: 500, usd: 91.63 },
    { maxKg: 1000, usd: 104.72 },
    { maxKg: 1500, usd: 117.81 },
    { maxKg: 2000, usd: 163.63 },
  ],
};

// ============================================================================
// PARSE FECHA DE VALIDEZ (subset del pricingExpiryService — rápido)
// ============================================================================

const SP_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12,
};

export function parseValidUntil(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/válid[oa]\s*hasta/g, '').replace(/valid until/g, '').replace(/hasta/g, '').replace(/validez:?/g, '').replace(/\sde\s/g, ' ').trim();
  if (!s) return null;

  // Excel serial
  const asNum = parseFloat(s);
  if (!isNaN(asNum) && asNum > 40000 && asNum < 80000) {
    return new Date((asNum - 25569) * 86400 * 1000);
  }

  // DD/MM/YYYY o DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m1) {
    const d = +m1[1], mo = +m1[2], y = +m1[3] < 100 ? 2000 + +m1[3] : +m1[3];
    return new Date(y, mo - 1, d);
  }

  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);

  // "DD mes YYYY" en español
  const m3 = s.match(/^(\d{1,2})\s+([a-záéíóú]+)\s+(\d{2,4})$/);
  if (m3) {
    const mo = SP_MONTHS[m3[2]];
    if (mo) {
      const y = +m3[3] < 100 ? 2000 + +m3[3] : +m3[3];
      return new Date(y, mo - 1, +m3[1]);
    }
  }

  // "DD/MM" sin año → asume año actual o siguiente
  const m4 = s.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
  if (m4) {
    const now = new Date();
    let y = now.getFullYear();
    const date = new Date(y, +m4[2] - 1, +m4[1]);
    if (date < now) date.setFullYear(y + 1);
    return date;
  }

  // Fallback Date()
  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
