import mongoose from 'mongoose';

// ============================================================================
// MODELO: Operación generada por el cliente a partir de una cotización.
// Una cotización (quoteNumber) por usuario sólo puede convertirse en una
// operación (índice único por quoteNumber + usuarioId).
// ============================================================================

export type TipoServicioOperacion = 'AIR' | 'FCL' | 'LCL';

export interface IOperacionProveedor {
  nombreEmpresa: string;
  nombreContacto: string;
  email: string;
  telefono: string;
}

export interface IOperacion {
  /** Número de cotización original (string) */
  quoteNumber: string;
  /** ObjectId opcional de la cotización en colección QuotePDF */
  quoteId?: string | null;
  /** Username propietario (cliente) */
  usuarioId: string;
  /** Email del usuario que disparó la conversión a operación */
  generadoPor: string;
  /** Tipo de servicio asociado */
  tipoServicio: TipoServicioOperacion;
  /** Datos del proveedor adjuntos */
  proveedor: IOperacionProveedor;
  /** Documentos asociados (referencia a Documento._id) */
  documentos: mongoose.Types.ObjectId[];
  /** Datos resumen de la cotización para referencia */
  origen?: string;
  destino?: string;
  carrier?: string;
  containerType?: string;
  cantidadContenedores?: number;
  incoterm?: string;
  pickupFromAddress?: string;
  deliveryToAddress?: string;
  description?: string;
  chargeableWeight?: string;
  currency?: string;
  total?: string;
  agente?: string;
}

export interface IOperacionDoc extends IOperacion, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

export type OperacionModel = mongoose.Model<IOperacionDoc>;

const ProveedorSubSchema = new mongoose.Schema<IOperacionProveedor>(
  {
    nombreEmpresa: { type: String, required: true, trim: true },
    nombreContacto: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    telefono: { type: String, required: true, trim: true },
  },
  { _id: false }
);

export const OperacionSchema = new mongoose.Schema<IOperacionDoc>(
  {
    quoteNumber: { type: String, required: true, trim: true, index: true },
    quoteId: { type: String, default: null },
    usuarioId: { type: String, required: true, trim: true, index: true },
    generadoPor: { type: String, required: true, trim: true },
    tipoServicio: {
      type: String,
      required: true,
      enum: ['AIR', 'FCL', 'LCL'],
    },
    proveedor: { type: ProveedorSubSchema, required: true },
    documentos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Documento' }],
    origen: { type: String, default: '' },
    destino: { type: String, default: '' },
    carrier: { type: String, default: '' },
    containerType: { type: String, default: '' },
    cantidadContenedores: { type: Number },
    incoterm: { type: String, default: '' },
    pickupFromAddress: { type: String, default: '' },
    deliveryToAddress: { type: String, default: '' },
    description: { type: String, default: '' },
    chargeableWeight: { type: String, default: '' },
    currency: { type: String, default: '' },
    total: { type: String, default: '' },
    agente: { type: String, default: '' },
  },
  { timestamps: true }
);

OperacionSchema.index({ quoteNumber: 1, usuarioId: 1 }, { unique: true });
