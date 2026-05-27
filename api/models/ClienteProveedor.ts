import mongoose from 'mongoose';

// ============================================================================
// MODELO: Proveedor guardado por cliente (autocompletado al generar operación)
// Indexado por (usuarioId + nombreEmpresaNormalizado) para evitar duplicados.
// ============================================================================

export interface IClienteProveedor {
  /** Username (cliente) propietario del registro */
  usuarioId: string;
  /** Nombre de la empresa proveedora */
  nombreEmpresa: string;
  /** Versión normalizada (lowercase, sin tildes ni espacios extra) para deduplicación */
  nombreEmpresaNormalizado: string;
  /** Nombre del contacto del proveedor */
  nombreContacto: string;
  /** Email del contacto */
  email: string;
  /** Teléfono del contacto */
  telefono: string;
  /** Última vez que el cliente lo usó al generar una operación */
  ultimoUso?: Date;
}

export interface IClienteProveedorDoc extends IClienteProveedor, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

export type ClienteProveedorModel = mongoose.Model<IClienteProveedorDoc>;

export const ClienteProveedorSchema = new mongoose.Schema<IClienteProveedorDoc>(
  {
    usuarioId: { type: String, required: true, trim: true, index: true },
    nombreEmpresa: { type: String, required: true, trim: true },
    nombreEmpresaNormalizado: { type: String, required: true, trim: true },
    nombreContacto: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    telefono: { type: String, required: true, trim: true },
    ultimoUso: { type: Date },
  },
  { timestamps: true }
);

ClienteProveedorSchema.index(
  { usuarioId: 1, nombreEmpresaNormalizado: 1 },
  { unique: true }
);

export function normalizeEmpresaName(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
