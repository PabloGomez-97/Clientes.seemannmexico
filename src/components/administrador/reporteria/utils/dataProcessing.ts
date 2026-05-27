// src/utils/dataProcessing.ts
import type { RawRow, Operation, MonthKey, MonthlyAgg } from './types';

const isNumeric = (s?: string | null) => !!s && /^-?\d+(?:\.\d+)?$/.test(s.replace(/,/g, ""));
const toNum = (s?: string | null) => (isNumeric(s) ? Number(s!.replace(/,/g, "")) : undefined);

function parseUSDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [_, mm, dd, yy] = m;
  
  // Corregir interpretación de años
  let year: number;
  if (yy.length === 2) {
    const yearNum = Number(yy);
    // Si el año es menor a 50, asumimos 20xx, si es mayor, 19xx
    // Pero para este caso específico, forzamos 2025
    if (yearNum >= 0 && yearNum <= 99) {
      year = 2000 + yearNum;
    } else {
      year = yearNum;
    }
  } else {
    year = Number(yy);
  }
  
  const month = Number(mm) - 1; // Los meses en JS van de 0-11
  const day = Number(dd);
  
  // Validar que la fecha sea válida
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }
  
  // CAMBIO CRÍTICO: Crear fecha en timezone local, no UTC
  const d = new Date(year, month, day);
  return isNaN(+d) ? null : d;
}

function monthKey(d: Date): MonthKey {
  // CAMBIO CRÍTICO: Usar métodos locales, no UTC
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return `${year}-${month}` as MonthKey;
}

// NUEVA FUNCIÓN: Verificar si una operación pertenece a un mes específico
function operationBelongsToMonth(op: Operation, targetMonth: string): boolean {
  if (!op.date) return false;
  
  const opMonthKey = monthKey(op.date);
  return opMonthKey === targetMonth;
}

// NUEVA FUNCIÓN: Filtrar operaciones por mes con precisión
export function filterOperationsByMonth(operations: Operation[], selectedMonth: string): Operation[] {
  if (selectedMonth === "all") return operations;
  
  return operations.filter(op => operationBelongsToMonth(op, selectedMonth));
}

export function extractOperations(raw: RawRow[]): Operation[] {
  const ops: Operation[] = [];
  let currentExecutive = "";
  const rowHas = (row: RawRow, needle: string) => row.some((c) => (c || "").toUpperCase().includes(needle.toUpperCase()));

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const c2 = row[2]?.trim() || "";

    if (
      c2 &&
      !/^INV\d+/.test(c2) &&
      !/^\d{3,}$/.test(c2) &&
      i + 1 < raw.length &&
      rowHas(raw[i + 1], "SHIPMENT")
    ) {
      currentExecutive = c2;
      continue;
    }

    const isOp = /^INV\d+/.test(c2) || /^\d{3,}$/.test(c2);
    if (isOp && currentExecutive) {
      const date = parseUSDate(raw[i][5]);
      const client = (raw[i][17] || "").trim() || null;
      const income = toNum(raw[i][24]);
      const expense = toNum(raw[i][27]);
      const profit = toNum(raw[i][28]);
      const commission = toNum(raw[i][33]);

      // Debug: Log the parsed date to see what's happening
      if (date) {
        console.log(`Parsed date: ${raw[i][5]} -> ${date.toISOString()} -> Month key: ${monthKey(date)}`);
      }

      ops.push({ executive: currentExecutive, date, client, invoiceRef: c2, income, expense, profit, commission });
      continue;
    }
  }
  
  // Debug: Log all unique months found
  const uniqueMonths = new Set(ops.filter(op => op.date).map(op => monthKey(op.date!)));
  console.log("Unique months found:", Array.from(uniqueMonths).sort());
  
  return ops;
}

export function aggregateMonthly(ops: Operation[]): MonthlyAgg[] {
  const key = (ex: string, m: MonthKey) => `${ex}__${m}`;
  const map = new Map<string, MonthlyAgg & { clients: Set<string> }>();

  for (const op of ops) {
    if (!op.date) continue;
    const m = monthKey(op.date);
    const k = key(op.executive, m);
    if (!map.has(k)) {
      map.set(k, { month: m, executive: op.executive, income: 0, expense: 0, profit: 0, profitPct: null, ops: 0, activeClients: 0, quotes: 0, winrate: null, clients: new Set<string>() });
    }
    const agg = map.get(k)!;

    const isQuote = op.income === undefined && op.expense === undefined && op.profit === undefined;
    if (isQuote) {
      agg.quotes += 1;
    } else {
      agg.ops += 1;
      agg.income += op.income || 0;
      agg.expense += op.expense || 0;
      agg.profit += op.profit || 0;
      if (op.client) agg.clients.add(op.client);
    }
  }

  const out: MonthlyAgg[] = [];
  for (const agg of map.values()) {
    const denom = agg.income !== 0 ? agg.income : 0;
    agg.profitPct = denom ? (agg.profit / denom) * 100 : null;
    agg.activeClients = agg.clients.size;
    const attempts = agg.ops + agg.quotes;
    agg.winrate = attempts ? (agg.ops / attempts) * 100 : null;
    out.push(agg);
  }
  out.sort((a, b) => (a.executive === b.executive ? a.month.localeCompare(b.month) : a.executive.localeCompare(b.executive)));
  return out;
}

export type WeekKey = `${number}-W${number}`;

export type WeeklyAgg = {
  week: WeekKey;
  executive: string;
  income: number;
  expense: number;
  profit: number;
  profitPct: number | null;
  ops: number;
  activeClients: number;
  quotes: number;
  winrate: number | null;
  clients?: Set<string>;
};

function getWeekKey(d: Date): WeekKey {
  // CAMBIO: Usar métodos locales en lugar de UTC
  const year = d.getFullYear();
  
  // Obtener el número de semana del año usando fecha local
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  
  return `${year}-W${weekNumber}` as WeekKey;
}

export function aggregateWeekly(ops: Operation[]): WeeklyAgg[] {
  const key = (ex: string, w: WeekKey) => `${ex}__${w}`;
  const map = new Map<string, WeeklyAgg & { clients: Set<string> }>();

  for (const op of ops) {
    if (!op.date) continue;
    const w = getWeekKey(op.date);
    const k = key(op.executive, w);
    if (!map.has(k)) {
      map.set(k, { 
        week: w, 
        executive: op.executive, 
        income: 0, 
        expense: 0, 
        profit: 0, 
        profitPct: null, 
        ops: 0, 
        activeClients: 0, 
        quotes: 0, 
        winrate: null, 
        clients: new Set<string>() 
      });
    }
    const agg = map.get(k)!;

    const isQuote = op.income === undefined && op.expense === undefined && op.profit === undefined;
    if (isQuote) {
      agg.quotes += 1;
    } else {
      agg.ops += 1;
      agg.income += op.income || 0;
      agg.expense += op.expense || 0;
      agg.profit += op.profit || 0;
      if (op.client) agg.clients.add(op.client);
    }
  }

  const out: WeeklyAgg[] = [];
  for (const agg of map.values()) {
    const denom = agg.income !== 0 ? agg.income : 0;
    agg.profitPct = denom ? (agg.profit / denom) * 100 : null;
    agg.activeClients = agg.clients.size;
    const attempts = agg.ops + agg.quotes;
    agg.winrate = attempts ? (agg.ops / attempts) * 100 : null;
    out.push(agg);
  }
  
  // Ordenar por ejecutivo y luego por semana
  out.sort((a, b) => (a.executive === b.executive ? a.week.localeCompare(b.week) : a.executive.localeCompare(b.executive)));
  return out;
}

// Función para verificar si una operación pertenece a una semana específica
function operationBelongsToWeek(op: Operation, targetWeek: string): boolean {
  if (!op.date) return false;
  
  const opWeekKey = getWeekKey(op.date);
  return opWeekKey === targetWeek;
}

// Nueva función: Filtrar operaciones por período (mes o semana)
export function filterOperationsByPeriod(operations: Operation[], selectedPeriod: string): Operation[] {
  if (selectedPeriod === "all") return operations;
  
  // Detectar si es semana (contiene 'W') o mes
  if (selectedPeriod.includes('W')) {
    return operations.filter(op => operationBelongsToWeek(op, selectedPeriod));
  } else {
    return operations.filter(op => operationBelongsToMonth(op, selectedPeriod));
  }
}

// Función auxiliar para convertir semana a mes aproximado (para el modal)
export function weekToApproximateMonth(weekKey: string): string {
  const [year, weekPart] = weekKey.split('-W');
  const weekNum = parseInt(weekPart);
  
  // Convertir número de semana a mes aproximado
  const approximateMonth = Math.ceil(weekNum / 4.33);
  const clampedMonth = Math.min(Math.max(approximateMonth, 1), 12);
  
  return `${year}-${clampedMonth}`;
}