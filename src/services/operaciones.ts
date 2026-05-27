/**
 * Cliente API para el módulo de operaciones.
 * - Listar proveedores guardados del cliente actual
 * - Crear una operación (subida atómica de docs + datos proveedor + email)
 */

export interface Proveedor {
  id?: string;
  nombreEmpresa: string;
  nombreContacto: string;
  email: string;
  telefono: string;
}

export interface DocumentoOperacionPayload {
  /** Tipo del documento (debe coincidir con el enum del backend) */
  tipo: 'Orden de compra' | 'Invoice' | 'Packing List';
  nombreArchivo: string;
  /** Base64 con prefijo data:<mime>;base64,... */
  contenidoBase64: string;
}

export interface CrearOperacionPayload {
  quoteNumber: string;
  quoteId?: string | null;
  tipoServicio: 'AIR' | 'FCL' | 'LCL';
  proveedor: Proveedor;
  /** Opcional: puede enviarse vacío o con uno o más documentos */
  documentos: DocumentoOperacionPayload[];
  emailContext?: {
    origen?: string;
    destino?: string;
    carrier?: string;
    containerType?: string;
    cantidadContenedores?: number;
    incoterm?: string;
    pickupFromAddress?: string;
    deliveryToAddress?: string;
    description?: string;
    chargeableWeight?: string | number;
    currency?: string;
    total?: string;
    agente?: string;
  };
  /** Cliente al que se asocia (si el ejecutivo opera por cuenta del cliente) */
  ownerUsername?: string;
}

export interface OperacionCreada {
  id: string;
  quoteNumber: string;
  tipoServicio: 'AIR' | 'FCL' | 'LCL';
  proveedor: Proveedor;
  documentosCount: number;
  createdAt: string;
}

const buildHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export async function listarProveedores(
  token: string,
  ownerUsername?: string,
): Promise<Proveedor[]> {
  const qs = ownerUsername ? `?ownerUsername=${encodeURIComponent(ownerUsername)}` : '';
  const res = await fetch(`/api/cliente-proveedores${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Error listando proveedores: ${res.status}`);
  }
  const json = await res.json();
  return Array.isArray(json?.proveedores) ? json.proveedores : [];
}

export async function crearOperacion(
  token: string,
  payload: CrearOperacionPayload,
): Promise<OperacionCreada> {
  const url = payload.ownerUsername
    ? `/api/operaciones?ownerUsername=${encodeURIComponent(payload.ownerUsername)}`
    : '/api/operaciones';

  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Error al crear operación (${res.status})`);
  }
  return data.operacion as OperacionCreada;
}

/**
 * Convierte un File a string base64 con prefijo data:<mime>;base64,...
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
