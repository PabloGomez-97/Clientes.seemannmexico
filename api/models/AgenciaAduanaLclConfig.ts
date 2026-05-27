import mongoose from "mongoose";

// ============================================================================
// MODELO: Configuración Agencia de Aduanas — LCL (colección separada)
// Montos en moneda de cotización. El 19% sobre despacho suelta es fijo (código).
// ============================================================================

/** IVA fijo sobre (tarifa × W/M cargable) en despacho de carga suelta — no es IVA aduanero del CIF */
export const DESPACHO_SUELTA_IVA_PCT = 19;

export interface ILclChargeValues {
  honorariosPct: number;
  honorariosMinCurrency: number;
  customsClearanceCurrency: number;
  despachoSueltaRatePerWM: number;
  separacionBLCurrency: number;
  apoyoTramitacionCurrency: number;
  apoyoServicioDocumentalCurrency: number;
  ivaAduaneroPct: number;
  derechosPct: number;
}

export interface IAgenciaAduanaLclConfig {
  charges: ILclChargeValues;
  updatedBy: string;
}

export interface IAgenciaAduanaLclConfigDoc
  extends IAgenciaAduanaLclConfig,
    mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

export type AgenciaAduanaLclConfigModel =
  mongoose.Model<IAgenciaAduanaLclConfigDoc>;

export const DEFAULT_LCL_CHARGE_VALUES: ILclChargeValues = {
  honorariosPct: 0.3,
  honorariosMinCurrency: 115,
  customsClearanceCurrency: 60,
  despachoSueltaRatePerWM: 38,
  separacionBLCurrency: 200,
  apoyoTramitacionCurrency: 31,
  apoyoServicioDocumentalCurrency: 220,
  ivaAduaneroPct: 19,
  derechosPct: 6,
};

export const DEFAULT_LCL_CONFIG: IAgenciaAduanaLclConfig = {
  charges: DEFAULT_LCL_CHARGE_VALUES,
  updatedBy: "system",
};

export const AgenciaAduanaLclConfigSchema =
  new mongoose.Schema<IAgenciaAduanaLclConfigDoc>(
    {
      charges: {
        honorariosPct: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.honorariosPct,
        },
        honorariosMinCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.honorariosMinCurrency,
        },
        customsClearanceCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.customsClearanceCurrency,
        },
        despachoSueltaRatePerWM: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.despachoSueltaRatePerWM,
        },
        separacionBLCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.separacionBLCurrency,
        },
        apoyoTramitacionCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.apoyoTramitacionCurrency,
        },
        apoyoServicioDocumentalCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.apoyoServicioDocumentalCurrency,
        },
        ivaAduaneroPct: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.ivaAduaneroPct,
        },
        derechosPct: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_CHARGE_VALUES.derechosPct,
        },
      },
      updatedBy: { type: String, required: true, default: "system" },
    },
    {
      timestamps: true,
      collection: "agencia_aduana_lcl_config",
    },
  );

function roundTotal(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Calcula cobros de agencia de aduanas LCL.
 * @param wmChargeable W/M cargable (getBillableWM), piso 1 cuando hay carga
 */
export function calculateAduanaChargesLcl(
  valorProducto: number,
  costoTransporte: number,
  seguro: number,
  wmChargeable: number,
  config: IAgenciaAduanaLclConfig,
) {
  const ch = config.charges;
  const wm = wmChargeable > 0 ? wmChargeable : 0;

  const cif = valorProducto + costoTransporte + seguro;

  const honorariosCalc = cif * (ch.honorariosPct / 100);
  const honorarios = Math.max(honorariosCalc, ch.honorariosMinCurrency);

  const customsClearance = ch.customsClearanceCurrency;

  const despachoSueltaBase = ch.despachoSueltaRatePerWM * wm;
  const despachoSuelta = despachoSueltaBase * (1 + DESPACHO_SUELTA_IVA_PCT / 100);

  const extraportCharges =
    despachoSuelta +
    ch.separacionBLCurrency +
    ch.apoyoTramitacionCurrency +
    ch.apoyoServicioDocumentalCurrency;

  const ivaAduanero = cif * (ch.ivaAduaneroPct / 100);
  const derechos = cif * (ch.derechosPct / 100);

  const total = roundTotal(
    honorarios +
      customsClearance +
      extraportCharges +
      ivaAduanero +
      derechos,
  );

  return {
    cif,
    honorarios,
    honorariosUsedMin: honorariosCalc < ch.honorariosMinCurrency,
    customsClearance,
    extraportCharges,
    wmChargeable: wm,
    ivaAduanero,
    derechos,
    total,
  };
}
