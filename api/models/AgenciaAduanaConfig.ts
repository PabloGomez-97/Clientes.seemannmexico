import mongoose from "mongoose";

// ============================================================================
// MODELO: Configuración de Agencia de Aduanas y Nacionalización
// Almacena tasas de cambio y porcentajes/valores de cobros configurables
// Solo debe existir un documento (singleton pattern)
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

export interface IAgenciaAduanaConfigDoc extends IAgenciaAduanaConfig, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

export type AgenciaAduanaConfigModel = mongoose.Model<IAgenciaAduanaConfigDoc>;

export const AgenciaAduanaConfigSchema = new mongoose.Schema<IAgenciaAduanaConfigDoc>(
  {
    exchangeRates: {
      ufToCLP:  { type: Number, required: true, default: 39841.72 },
      usdToCLP: { type: Number, required: true, default: 857.58 },
      eurToCLP: { type: Number, required: true, default: 1055.97 },
      gbpToCLP: { type: Number, required: true, default: 1218.68 },
      cadToCLP: { type: Number, required: true, default: 661.45 },
      chfToCLP: { type: Number, required: true, default: 1150.60 },
      sekToCLP: { type: Number, required: true, default: 96.71 },
    },
    charges: {
      honorariosPct:   { type: Number, required: true, default: 0.28 },
      honorariosMinUF: { type: Number, required: true, default: 3.5 },
      gastosDespachoUF:{ type: Number, required: true, default: 1.5 },
      tramitacionUF:   { type: Number, required: true, default: 2 },
      mensajeriaUF:    { type: Number, required: true, default: 0.25 },
      ivaAduaneroPct:  { type: Number, required: true, default: 19 },
      derechosPct:     { type: Number, required: true, default: 6 },
    },
    updatedBy: { type: String, required: true, default: "system" },
  },
  { timestamps: true }
);

// ============================================================================
// VALORES POR DEFECTO (usados cuando no hay config en DB)
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
// UTILIDADES DE CONVERSIÓN DE MONEDA
// ============================================================================

export type SupportedCurrency = "USD" | "EUR" | "GBP" | "CAD" | "CHF" | "CLP" | "SEK";

/**
 * Convierte UF a la moneda objetivo usando las tasas de cambio.
 * UF → CLP → moneda objetivo
 */
export function ufToCurrency(ufAmount: number, currency: SupportedCurrency, rates: IExchangeRates): number {
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
 * Retorna el desglose y el total en la moneda de la tarifa.
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

  // Honorarios: porcentaje del CIF
  const honorariosCalc = cif * (ch.honorariosPct / 100);
  // Honorarios mínimos en la moneda de la tarifa
  const honorariosMin = ufToCurrency(ch.honorariosMinUF, currency, rates);
  const honorarios = Math.max(honorariosCalc, honorariosMin);

  // Gastos Despacho (UF a moneda)
  const gastosDespacho = ufToCurrency(ch.gastosDespachoUF, currency, rates);

  // Tramitación CDA SAG/Seremi/ISP (UF a moneda)
  const tramitacion = ufToCurrency(ch.tramitacionUF, currency, rates);

  // Mensajería (UF a moneda)
  const mensajeria = ufToCurrency(ch.mensajeriaUF, currency, rates);

  // IVA aduanero: porcentaje del CIF
  const ivaAduanero = cif * (ch.ivaAduaneroPct / 100);

  // Derechos: porcentaje del CIF
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
