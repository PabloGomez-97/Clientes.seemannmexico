/**
 * handlerFechas.ts
 * Módulo centralizado para el manejo de fechas de validez ("Válido Hasta")
 * utilizado por los 3 cotizadores: QuoteFCL, QuoteLCL, QuoteAIR.
 *
 * Soporta los siguientes formatos de entrada:
 *   - Serial numérico de Google Sheets   (ej: 46072)
 *   - ISO 8601                            (ej: 2026-03-10)
 *   - DD/MM/YYYY, DD/M/YYYY, DD-MM-YYYY  (ej: 28/02/2026 o 28-2-2026)
 *   - Texto español con o sin año        (ej: "28 febrero 2026" o "31 mayo")
 *
 * Salida de display: siempre DD-MM-AAAA (ej: 28-02-2026)
 */

export type ValidityState = "valid" | "expiring-soon" | "expired";

const SPANISH_MONTH_MAP: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

/**
 * Parsea cualquier formato de validUntil a un objeto Date usando hora LOCAL
 * (medianoche 23:59:59 del día indicado en la zona horaria del usuario).
 *
 * IMPORTANTE: se usa tiempo local (NO UTC) para que una tarifa con fecha
 * "17 mayo" expire a las 23:59:59 hora local del usuario, no a las 23:59:59
 * UTC (lo que causaría expiración prematura en zonas UTC-N como Chile UTC-3).
 *
 * Retorna null si no se puede parsear.
 */
export function parseValidUntilToDate(
  validUntil?: string | null,
): Date | null {
  if (!validUntil) return null;

  const txt = String(validUntil).trim();
  if (!txt) return null;

  // 1) Serial numérico de Google Sheets (5 dígitos, ej: 46072)
  if (/^\d{5}$/.test(txt)) {
    const serial = parseInt(txt, 10);
    // Epoch local de Google Sheets: 30/12/1899 en hora local
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + serial * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }

  // 2) Formato ISO YYYY-MM-DD (ej: 2026-03-10)
  const isoMatch = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const date = new Date(year, month - 1, day, 23, 59, 59, 999);
    return isNaN(date.getTime()) ? null : date;
  }

  // 3) Formato DD/MM/YYYY, DD/M/YYYY o DD-MM-YYYY (con guiones o barras)
  const numericMatch = txt.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numericMatch) {
    const part1 = parseInt(numericMatch[1], 10);
    const part2 = parseInt(numericMatch[2], 10);
    const year = parseInt(numericMatch[3], 10);

    let day: number;
    let month: number;
    if (part1 > 12) {
      // part1 es definitivamente el día (DD/M/YYYY)
      day = part1;
      month = part2;
    } else if (part2 > 12) {
      // part2 es definitivamente el día (M/D/YYYY - inglés)
      day = part2;
      month = part1;
    } else {
      // Ambos ≤ 12: asumimos formato latino DD/MM/YYYY
      day = part1;
      month = part2;
    }

    const date = new Date(year, month - 1, day, 23, 59, 59, 999);
    return isNaN(date.getTime()) ? null : date;
  }

  // 4) Texto español con o sin año (ej: "28 febrero 2026" o "31 mayo")
  const textMatch = txt.match(
    /(\d{1,2})\s+([a-zñáéíóú]+)(?:\s+(\d{4}))?/i,
  );
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2].toLowerCase();
    const year = textMatch[3]
      ? parseInt(textMatch[3], 10)
      : new Date().getFullYear();

    const monthIndex = SPANISH_MONTH_MAP[monthName];
    if (monthIndex !== undefined) {
      const date = new Date(year, monthIndex, day, 23, 59, 59, 999);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

/**
 * Formatea una fecha Date a cadena DD-MM-AAAA para mostrar en la columna
 * "Válido Hasta". Retorna "—" si la fecha es nula o inválida.
 */
export function formatDateDDMMYYYY(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Convierte cualquier formato de validUntil a cadena de display DD-MM-AAAA.
 * Si el valor no puede parsearse, retorna "—".
 */
export function formatValidUntilDisplay(
  validUntil?: string | null,
): string {
  return formatDateDDMMYYYY(parseValidUntilToDate(validUntil));
}

/**
 * Determina el estado de vigencia de una tarifa según su fecha de vencimiento.
 * Retorna null si no hay fecha o no puede parsearse.
 * "expiring-soon" = vence en los próximos 4 días.
 */
export function getValidityClass(
  validUntil?: string | null,
): ValidityState | null {
  const expiry = parseValidUntilToDate(validUntil);
  if (!expiry) return null;

  const now = new Date();
  if (expiry < now) return "expired";
    // Vence en los próximos 4 días (96 horas)
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
  if (expiry.getTime() - now.getTime() <= fourDaysMs) return "expiring-soon";

  return "valid";
}

/**
 * Convierte cualquier formato de validUntil a una cadena ISO 8601.
 * Se usa para ordenamiento y para enviar al backend.
 * Retorna una fecha fallback (+7 días desde hoy) si no puede parsearse.
 */
export function parseValidUntilToISO(
  validUntil?: string | null,
): string {
  const fallback = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const date = parseValidUntilToDate(validUntil);
  return date ? date.toISOString() : fallback;
}
