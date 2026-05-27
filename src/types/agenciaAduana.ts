// ============================================================================
// TIPOS Y UTILIDADES COMPARTIDAS — Agencia de Aduanas y Nacionalización
// Este archivo es frontend-safe (sin dependencias de Node.js/mongoose).
// Utilizado por useAgenciaAduanas.ts y AduanaSection.tsx.
// ============================================================================

export interface IExchangeRates {
  ufToCLP: number;    // 1 UF = X CLP
  usdToCLP: number;   // 1 USD = X CLP
  eurToCLP: number;   // 1 EUR = X CLP
  gbpToCLP: number;   // 1 GBP = X CLP
  cadToCLP: number;   // 1 CAD = X CLP
  chfToCLP: number;   // 1 CHF = X CLP
  sekToCLP: number;   // 1 SEK = X CLP
}

export interface IChargeValues {
  honorariosPct: number;       // Porcentaje de honorarios (ej: 0.28 = 0.28%)
  honorariosMinUF: number;     // Honorarios mínimos en UF (ej: 3.5)
  gastosDespachoUF: number;    // Gastos de despacho en UF (ej: 1.5)
  tramitacionUF: number;       // Tramitación CDA SAG/Seremi/ISP en UF (ej: 2)
  mensajeriaUF: number;        // Mensajería en UF (ej: 0.25)
  ivaAduaneroPct: number;      // IVA aduanero porcentaje (ej: 19 = 19%)
  derechosPct: number;         // Derechos porcentaje (ej: 6 = 6%)
}

export interface IAgenciaAduanaConfig {
  exchangeRates: IExchangeRates;
  charges: IChargeValues;
  updatedBy: string;
}

export type SupportedCurrency = "USD" | "EUR" | "GBP" | "CAD" | "CHF" | "CLP" | "SEK";

// ============================================================================
// VALORES POR DEFECTO
// ============================================================================

export const DEFAULT_EXCHANGE_RATES: IExchangeRates = {
  ufToCLP: 39841.72,
  usdToCLP: 857.58,
  eurToCLP: 1055.97,
  gbpToCLP: 1218.68,
  cadToCLP: 661.45,
  chfToCLP: 1150.60,
  sekToCLP: 96.71,
};

export const DEFAULT_CHARGE_VALUES: IChargeValues = {
  honorariosPct: 0.28,
  honorariosMinUF: 3.5,
  gastosDespachoUF: 1.5,
  tramitacionUF: 2,
  mensajeriaUF: 0.25,
  ivaAduaneroPct: 19,
  derechosPct: 6,
};

export const DEFAULT_CONFIG: IAgenciaAduanaConfig = {
  exchangeRates: DEFAULT_EXCHANGE_RATES,
  charges: DEFAULT_CHARGE_VALUES,
  updatedBy: "system",
};

// ============================================================================
// UTILIDADES DE CONVERSIÓN Y CÁLCULO
// ============================================================================

/**
 * Convierte UF a la moneda objetivo.
 * UF → CLP → moneda objetivo
 */
export function ufToCurrency(
  ufAmount: number,
  currency: SupportedCurrency,
  rates: IExchangeRates,
): number {
  const clpAmount = ufAmount * rates.ufToCLP;
  switch (currency) {
    case "CLP": return clpAmount;
    case "USD": return clpAmount / rates.usdToCLP;
    case "EUR": return clpAmount / rates.eurToCLP;
    case "GBP": return clpAmount / rates.gbpToCLP;
    case "CAD": return clpAmount / rates.cadToCLP;
    case "CHF": return clpAmount / rates.chfToCLP;
    case "SEK": return clpAmount / rates.sekToCLP;
    default:    return clpAmount / rates.usdToCLP;
  }
}

/**
 * Calcula todos los cobros de Agencia de Aduanas dado un CIF y la moneda.
 */
export function calculateAduanaCharges(
  valorProducto: number,
  costoTransporte: number,
  seguro: number,
  currency: SupportedCurrency,
  config: IAgenciaAduanaConfig,
) {
  const rates = config.exchangeRates;
  const ch = config.charges;

  const cif = valorProducto + costoTransporte + seguro;

  const honorariosCalc = cif * (ch.honorariosPct / 100);
  const honorariosMin = ufToCurrency(ch.honorariosMinUF, currency, rates);
  const honorarios = Math.max(honorariosCalc, honorariosMin);

  const gastosDespacho = ufToCurrency(ch.gastosDespachoUF, currency, rates);
  const tramitacion = ufToCurrency(ch.tramitacionUF, currency, rates);
  const mensajeria = ufToCurrency(ch.mensajeriaUF, currency, rates);
  const ivaAduanero = cif * (ch.ivaAduaneroPct / 100);
  const derechos = cif * (ch.derechosPct / 100);

  const total = honorarios + gastosDespacho + tramitacion + mensajeria + ivaAduanero + derechos;

  return {
    cif,
    honorarios,
    honorariosUsedMin: honorariosCalc < honorariosMin,
    gastosDespacho,
    tramitacion,
    mensajeria,
    ivaAduanero,
    derechos,
    total,
    currency,
  };
}
