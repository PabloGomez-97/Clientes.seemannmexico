import mongoose from "mongoose";

// ============================================================================
// MODELO: Configuración EXW — FCL (singleton)
// Valores numéricos por contenedor (sin divisa; la cotización define moneda)
// ============================================================================

export interface IFclExwConfig {
  /** EXW por contenedor 20GP */
  exwRate20GP: number;
  /** EXW por contenedor 40HQ / 40NOR */
  exwRate40: number;
  updatedBy: string;
}

export interface IFclExwConfigDoc extends IFclExwConfig, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

export type FclExwConfigModel = mongoose.Model<IFclExwConfigDoc>;

export const DEFAULT_FCL_EXW_CONFIG: IFclExwConfig = {
  exwRate20GP: 900,
  exwRate40: 1090,
  updatedBy: "system",
};

export const FclExwConfigSchema = new mongoose.Schema<IFclExwConfigDoc>(
  {
    exwRate20GP: {
      type: Number,
      required: true,
      default: DEFAULT_FCL_EXW_CONFIG.exwRate20GP,
    },
    exwRate40: {
      type: Number,
      required: true,
      default: DEFAULT_FCL_EXW_CONFIG.exwRate40,
    },
    updatedBy: {
      type: String,
      required: true,
      default: DEFAULT_FCL_EXW_CONFIG.updatedBy,
    },
  },
  { timestamps: true, collection: "fcl_exw_config" },
);

