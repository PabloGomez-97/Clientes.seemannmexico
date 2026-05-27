import mongoose from "mongoose";

// ============================================================================
// MODELO: Gestión Cotizador (singleton en colección gestioncotizador)
// Tarifas configurables por tipo de servicio (FCL, LCL, AÉREO, ÚLTIMA MILLA)
// ============================================================================

export interface IFclCotizadorConfig {
  /** Transporte terrestre por contenedor 20GP */
  ttRate20GP: number;
  /** Transporte terrestre por contenedor 40HQ / 40NOR */
  ttRate40: number;
  /** Recargo % adicional en zona extendida (entre anillo Vespucio y polígono exterior) */
  vespucioExtendedSurchargePct: number;
}

export interface ILclDeliveryBracket {
  maxKg: number;
  maxM3: number;
  /** Monto INCOME (USD o moneda de ruta en cotizador) */
  amount: number;
}

export interface ILclCotizadorConfig {
  brackets: ILclDeliveryBracket[];
  /** Límite superior peso real (kg) para tabla DELV */
  maxKg: number;
  /** Límite superior volumen (m³) para tabla DELV */
  maxM3: number;
  vespucioExtendedSurchargePct: number;
}

export interface IAereoTtBracket {
  maxKg: number;
  amount: number;
}

export interface IAereoCotizadorConfig {
  brackets: IAereoTtBracket[];
  maxKg: number;
  vespucioExtendedSurchargePct: number;
}

export interface IGestionCotizadorConfig {
  fcl: IFclCotizadorConfig;
  lcl: ILclCotizadorConfig;
  aereo: IAereoCotizadorConfig;
  updatedBy: string;
}

export interface IGestionCotizadorConfigDoc
  extends IGestionCotizadorConfig,
    mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

export type GestionCotizadorConfigModel =
  mongoose.Model<IGestionCotizadorConfigDoc>;

export const DEFAULT_FCL_COTIZADOR: IFclCotizadorConfig = {
  ttRate20GP: 690.2,
  ttRate40: 547.4,
  vespucioExtendedSurchargePct: 45,
};

export const DEFAULT_LCL_DELIVERY_BRACKETS: ILclDeliveryBracket[] = [
  { maxKg: 500, maxM3: 2.5, amount: 183.26 },
  { maxKg: 1000, maxM3: 5, amount: 202.9 },
  { maxKg: 2000, maxM3: 8, amount: 248.71 },
  { maxKg: 3000, maxM3: 11, amount: 274.89 },
  { maxKg: 4000, maxM3: 15, amount: 294.53 },
  { maxKg: 5000, maxM3: 20, amount: 314.16 },
  { maxKg: 6000, maxM3: 25, amount: 353.43 },
  { maxKg: 7000, maxM3: 30, amount: 392.7 },
];

export const DEFAULT_LCL_COTIZADOR: ILclCotizadorConfig = {
  brackets: DEFAULT_LCL_DELIVERY_BRACKETS,
  maxKg: 7000,
  maxM3: 30,
  vespucioExtendedSurchargePct: 45,
};

export const DEFAULT_AEREO_TT_BRACKETS: IAereoTtBracket[] = [
  { maxKg: 300, amount: 85.09 },
  { maxKg: 500, amount: 91.63 },
  { maxKg: 1000, amount: 104.72 },
  { maxKg: 1500, amount: 117.81 },
  { maxKg: 2000, amount: 163.63 },
];

export const DEFAULT_AEREO_COTIZADOR: IAereoCotizadorConfig = {
  brackets: DEFAULT_AEREO_TT_BRACKETS,
  maxKg: 2000,
  vespucioExtendedSurchargePct: 45,
};

export const DEFAULT_GESTION_COTIZADOR_CONFIG: IGestionCotizadorConfig = {
  fcl: DEFAULT_FCL_COTIZADOR,
  lcl: DEFAULT_LCL_COTIZADOR,
  aereo: DEFAULT_AEREO_COTIZADOR,
  updatedBy: "system",
};

/** EXPENSE = INCOME / divisor (markup 10 % → divisor 1.10) */
export const LCL_DELIVERY_EXPENSE_DIVISOR = 1.1;

const LclDeliveryBracketSchema = new mongoose.Schema<ILclDeliveryBracket>(
  {
    maxKg: { type: Number, required: true },
    maxM3: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const AereoTtBracketSchema = new mongoose.Schema<IAereoTtBracket>(
  {
    maxKg: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

export const GestionCotizadorConfigSchema =
  new mongoose.Schema<IGestionCotizadorConfigDoc>(
    {
      fcl: {
        ttRate20GP: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_COTIZADOR.ttRate20GP,
        },
        ttRate40: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_COTIZADOR.ttRate40,
        },
        vespucioExtendedSurchargePct: {
          type: Number,
          required: true,
          default: DEFAULT_FCL_COTIZADOR.vespucioExtendedSurchargePct,
        },
      },
      lcl: {
        brackets: {
          type: [LclDeliveryBracketSchema],
          default: DEFAULT_LCL_DELIVERY_BRACKETS,
        },
        maxKg: { type: Number, required: true, default: 7000 },
        maxM3: { type: Number, required: true, default: 30 },
        vespucioExtendedSurchargePct: {
          type: Number,
          required: true,
          default: DEFAULT_LCL_COTIZADOR.vespucioExtendedSurchargePct,
        },
      },
      aereo: {
        brackets: {
          type: [AereoTtBracketSchema],
          default: DEFAULT_AEREO_TT_BRACKETS,
        },
        maxKg: { type: Number, required: true, default: 2000 },
        vespucioExtendedSurchargePct: {
          type: Number,
          required: true,
          default: DEFAULT_AEREO_COTIZADOR.vespucioExtendedSurchargePct,
        },
      },
      updatedBy: { type: String, required: true, default: "system" },
    },
    { timestamps: true, collection: "gestioncotizador" },
  );
