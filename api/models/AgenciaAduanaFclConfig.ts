import mongoose from "mongoose";

// ============================================================================
// MODELO: Configuración Agencia de Aduanas — FCL (colección separada del aéreo)
// Montos en la moneda de la cotización (sin conversión UF)
// ============================================================================

export interface IFclChargeValues {
  honorariosPct: number;
  honorariosMinCurrency: number;
  customsClearanceCurrency: number;
  gateInPerContainerCurrency: number;
  docProcessCurrency: number;
  ivaAduaneroPct: number;
  derechosPct: number;
}

export interface IAgenciaAduanaFclConfig {
  charges: IFclChargeValues;
  updatedBy: string;
}

export interface IAgenciaAduanaFclConfigDoc
  extends IAgenciaAduanaFclConfig,
    mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

export type AgenciaAduanaFclConfigModel =
  mongoose.Model<IAgenciaAduanaFclConfigDoc>;

export const DEFAULT_FCL_CHARGE_VALUES: IFclChargeValues = {
  honorariosPct: 0.3,
  honorariosMinCurrency: 115,
  customsClearanceCurrency: 60,
  gateInPerContainerCurrency: 200,
  docProcessCurrency: 55,
  ivaAduaneroPct: 19,
  derechosPct: 6,
};

export const DEFAULT_FCL_CONFIG: IAgenciaAduanaFclConfig = {
  charges: DEFAULT_FCL_CHARGE_VALUES,
  updatedBy: "system",
};

export const AgenciaAduanaFclConfigSchema =
  new mongoose.Schema<IAgenciaAduanaFclConfigDoc>(
    {
      charges: {
        honorariosPct: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_CHARGE_VALUES.honorariosPct,
        },
        honorariosMinCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_CHARGE_VALUES.honorariosMinCurrency,
        },
        customsClearanceCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_CHARGE_VALUES.customsClearanceCurrency,
        },
        gateInPerContainerCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_CHARGE_VALUES.gateInPerContainerCurrency,
        },
        docProcessCurrency: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_CHARGE_VALUES.docProcessCurrency,
        },
        ivaAduaneroPct: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_CHARGE_VALUES.ivaAduaneroPct,
        },
        derechosPct: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_CHARGE_VALUES.derechosPct,
        },
      },
      updatedBy: { type: String, required: true, default: "system" },
    },
    {
      timestamps: true,
      collection: "agencia_aduana_fcl_config",
    },
  );

/**
 * Calcula cobros de agencia de aduanas FCL.
 * Montos fijos y mínimos se aplican en la moneda de la cotización.
 */
export function calculateAduanaChargesFcl(
  valorProducto: number,
  costoTransporte: number,
  seguro: number,
  cantidadContenedores: number,
  config: IAgenciaAduanaFclConfig,
) {
  const ch = config.charges;
  const qty = Math.max(1, cantidadContenedores);

  const cif = valorProducto + costoTransporte + seguro;

  const honorariosCalc = cif * (ch.honorariosPct / 100);
  const honorarios = Math.max(honorariosCalc, ch.honorariosMinCurrency);

  const customsClearance = ch.customsClearanceCurrency;
  const gateIn = ch.gateInPerContainerCurrency * qty;
  const docProcess = ch.docProcessCurrency;
  const ivaAduanero = cif * (ch.ivaAduaneroPct / 100);
  const derechos = cif * (ch.derechosPct / 100);

  const total =
    honorarios +
    customsClearance +
    gateIn +
    docProcess +
    ivaAduanero +
    derechos;

  return {
    cif,
    honorarios,
    honorariosUsedMin: honorariosCalc < ch.honorariosMinCurrency,
    customsClearance,
    gateIn,
    gateInQuantity: qty,
    docProcess,
    ivaAduanero,
    derechos,
    total,
  };
}
