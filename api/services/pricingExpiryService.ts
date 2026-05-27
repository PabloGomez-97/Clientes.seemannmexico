/**
 * Servicio compartido para verificar tarifas próximas a vencer.
 * Utilizado por el cron job y los endpoints de la API.
 */

import type {
  TarifaAereaExpiringData,
  TarifaFCLExpiringData,
  TarifaLCLExpiringData,
} from '../emails/pricingAlertEmailTemplate.js';

export type { TarifaAereaExpiringData, TarifaFCLExpiringData, TarifaLCLExpiringData };

export const SHEET_AIR =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWBXW_l3kB2V0A9D732Le0AjyGnXDjgV8nasTz1Z3gWUbCklXKICxTE4kEMjYMoaTG4v78XB2aVrHe/pub?output=csv';
export const SHEET_FCL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?output=csv';
export const SHEET_LCL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQYi3-CA6itt2SBNYumE3fuxpE0SSAtMMPn7K2LaqRPmduRvU3hSu11Vznn8NtG2yuDriuuL2E8VvOG/pub?output=csv';

// ─── CSV PARSER ──────────────────────────────────────────────

function parseCSV(csvText: string): string[][] {
  const lines = csvText.split('\n');
  const result: string[][] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let j = 0; j < trimmed.length; j++) {
      const ch = trimmed[j];
      const next = trimmed[j + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    result.push(row);
  }
  return result;
}

// ─── DATE PARSER ─────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  // Spanish abbreviated
  ene: 0, abr: 3, ago: 7, set: 8, dic: 11,
  // Spanish full names (looked up via slice(0,3) but listed here for explicitness)
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

/**
 * Parse a validity date string from Google Sheets into a Date object.
 * Handles: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD/MM, DD-MM,
 * "30 Apr 2025", "Apr 30, 2025", Excel serial numbers, embedded text.
 */
export function parseValidityDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Excel serial date number (e.g. 45742)
  const asNum = Number(str.replace(/[, ]/g, ''));
  if (!isNaN(asNum) && asNum > 40000 && asNum < 60000) {
    // Excel dates: days since 1899-12-30
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + asNum * 86400000);
    if (!isNaN(d.getTime())) return d;
  }

  // Strip common prefix text, then remove Spanish "de" particles
  // Handles: "20 de abril", "20 de abril de 2026", "válido hasta 30 de mayo de 2026"
  const clean = str
    .replace(/válido\s*hasta\s*/i, '')
    .replace(/valid\s*until\s*/i, '')
    .replace(/hasta\s*/i, '')
    .replace(/validez\s*:/i, '')
    .replace(/\bde\b\s*/gi, '')   // "20 de abril de 2026" → "20 abril 2026"
    .replace(/\s+/g, ' ')
    .trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const d = new Date(+m1[3], +m1[2] - 1, +m1[1]);
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const m2 = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    const d = new Date(+m2[1], +m2[2] - 1, +m2[3]);
    if (!isNaN(d.getTime())) return d;
  }

  // DD/MM or DD-MM (assume current year; advance year if already past by >30 days)
  const m3 = clean.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m3) {
    const y = new Date().getFullYear();
    const d = new Date(y, +m3[2] - 1, +m3[1]);
    if (!isNaN(d.getTime())) {
      if (d.getTime() < Date.now() - 30 * 86400000) d.setFullYear(y + 1);
      return d;
    }
  }

  // "30 Apr 2025" or "30 Apr"
  const m4 = clean.match(/^(\d{1,2})\s+([a-záéíóúüñ]{3,})\s*(\d{4})?$/i);
  if (m4) {
    const m4name = m4[2].toLowerCase();
    const mon = MONTH_NAMES[m4name] ?? MONTH_NAMES[m4name.slice(0, 3)];
    if (mon !== undefined) {
      const y = m4[3] ? +m4[3] : new Date().getFullYear();
      const d = new Date(y, mon, +m4[1]);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // "Apr 30, 2025" or "Apr 30"
  const m5 = clean.match(/^([a-záéíóúüñ]{3,})\s+(\d{1,2})[,\s]*(\d{4})?$/i);
  if (m5) {
    const m5name = m5[1].toLowerCase();
    const mon = MONTH_NAMES[m5name] ?? MONTH_NAMES[m5name.slice(0, 3)];
    if (mon !== undefined) {
      const y = m5[3] ? +m5[3] : new Date().getFullYear();
      const d = new Date(y, mon, +m5[2]);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Native Date parse as a last resort (handles many ISO / locale strings)
  const native = new Date(clean);
  if (!isNaN(native.getTime()) && native.getFullYear() > 2000 && native.getFullYear() < 2100) {
    return native;
  }

  return null;
}

/**
 * Returns how many calendar days until the given date.
 * Returns 0 if the date is today, negative if already past.
 */
export function daysUntil(date: Date): number {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((expMidnight.getTime() - todayMidnight.getTime()) / 86400000);
}

// ─── FETCH HELPERS ────────────────────────────────────────────

async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al obtener ${url}`);
  return parseCSV(await res.text());
}

function n(v: any): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

// ─── FETCH EXPIRING RATES ─────────────────────────────────────

/**
 * @param maxDays Fetch rows expiring within this many days (inclusive).
 *                Use 1 for 24-hr window, 2 for 48-hr window, 7 for admin preview.
 *                Pass -1 to return all rows regardless of expiry.
 */

export async function fetchExpiringAir(maxDays: number): Promise<TarifaAereaExpiringData[]> {
  const data = await fetchCSV(SHEET_AIR);
  const result: TarifaAereaExpiringData[] = [];

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || !n(row[1]) || !n(row[2])) continue;

    const validUntilRaw = n(row[15]);
    if (!validUntilRaw) continue;

    const date = parseValidityDate(validUntilRaw);
    if (!date) continue;

    const days = daysUntil(date);
    if (maxDays >= 0 && (days < 0 || days > maxDays)) continue;

    result.push({
      origen: n(row[1]) || '',
      destino: n(row[2]) || '',
      kg45: n(row[3]),
      kg100: n(row[4]),
      kg300: n(row[5]),
      kg500: n(row[6]),
      kg1000: n(row[7]),
      carrier: n(row[8]),
      frequency: n(row[9]),
      transitTime: n(row[10]),
      routing: n(row[11]),
      remark1: n(row[12]),
      remark2: n(row[13]),
      currency: n(row[14]),
      validUntil: validUntilRaw,
      company: n(row[16]),
      localCharges: n(row[17]),
      gastosXKg: n(row[18]),
      minGastosXKg: n(row[19]),
      rowNumber: i + 1,
      daysUntilExpiry: days,
    });
  }

  return result;
}

export async function fetchExpiringFCL(maxDays: number): Promise<TarifaFCLExpiringData[]> {
  const data = await fetchCSV(SHEET_FCL);
  const result: TarifaFCLExpiringData[] = [];

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || !n(row[1]) || !n(row[2])) continue;

    const validUntilRaw = n(row[12]);
    if (!validUntilRaw) continue;

    const date = parseValidityDate(validUntilRaw);
    if (!date) continue;

    const days = daysUntil(date);
    if (maxDays >= 0 && (days < 0 || days > maxDays)) continue;

    result.push({
      pol: n(row[1]) || '',
      pod: n(row[2]) || '',
      gp20: n(row[3]),
      hq40: n(row[4]),
      nor40: n(row[5]),
      carrier: n(row[6]),
      tt: n(row[7]),
      remarks: n(row[8]),
      freeTime: n(row[9]),
      company: n(row[10]),
      currency: n(row[11]),
      validUntil: validUntilRaw,
      rowNumber: i + 1,
      daysUntilExpiry: days,
    });
  }

  return result;
}

export async function fetchExpiringLCL(maxDays: number): Promise<TarifaLCLExpiringData[]> {
  const data = await fetchCSV(SHEET_LCL);
  const result: TarifaLCLExpiringData[] = [];

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || !n(row[1]) || !n(row[3])) continue;

    const validUntilRaw = n(row[10]);
    if (!validUntilRaw) continue;

    const date = parseValidityDate(validUntilRaw);
    if (!date) continue;

    const days = daysUntil(date);
    if (maxDays >= 0 && (days < 0 || days > maxDays)) continue;

    result.push({
      pol: n(row[1]) || '',
      servicio: n(row[2]),
      pod: n(row[3]) || '',
      ofWM: n(row[4]),
      currency: n(row[5]),
      frecuencia: n(row[6]),
      agente: n(row[7]),
      ttAprox: n(row[8]),
      operador: n(row[9]),
      validUntil: validUntilRaw,
      rowNumber: i + 1,
      daysUntilExpiry: days,
    });
  }

  return result;
}

/**
 * Fetch ALL expiring rates from all three sheets in parallel.
 * @param maxDays Max days ahead to include (e.g. 7 for admin preview, 2 for 48-hr alert).
 */
export async function fetchAllExpiring(maxDays: number) {
  const [air, fcl, lcl] = await Promise.all([
    fetchExpiringAir(maxDays),
    fetchExpiringFCL(maxDays),
    fetchExpiringLCL(maxDays),
  ]);
  return { air, fcl, lcl };
}

/**
 * Filter a list of expiring rates to only those in the exact daily window.
 * Used by the CRON job to avoid duplicate sends on consecutive days.
 * windowDays = 1 → expiring exactly tomorrow (24hr alert)
 * windowDays = 2 → expiring exactly in 2 days (48hr alert)
 */
export function filterExactWindow<T extends { daysUntilExpiry?: number }>(
  rates: T[],
  windowDays: 1 | 2,
): T[] {
  return rates.filter((r) => r.daysUntilExpiry === windowDays);
}

/**
 * Filter a list of expiring rates to those expiring within [0..windowDays] days.
 * Used by MANUAL sends — includes tariffs expiring today (daysUntilExpiry=0)
 * and all tariffs within the window, giving the user a full picture.
 * windowDays = 1 → expiring today or tomorrow
 * windowDays = 2 → expiring today, tomorrow, or day after
 */
export function filterMaxWindow<T extends { daysUntilExpiry?: number }>(
  rates: T[],
  windowDays: number,
): T[] {
  return rates.filter(
    (r) => (r.daysUntilExpiry ?? -1) >= 0 && (r.daysUntilExpiry ?? 999) <= windowDays,
  );
}
