// src/hooks/useAuditLog.ts
// Hook centralizado para registrar eventos de auditoría
import { useAuth } from '../auth/AuthContext';

export type AuditAction =
  // Cotizaciones (cliente)
  | 'COTIZACION_AIR_CREADA'
  | 'COTIZACION_FCL_CREADA'
  | 'COTIZACION_LCL_CREADA'
  | 'COTIZACION_LASTMILE_CREADA'
  // Cotizaciones (ejecutivo en nombre de cliente)
  | 'COTIZACION_AIR_EJECUTIVO'
  | 'COTIZACION_FCL_EJECUTIVO'
  | 'COTIZACION_LCL_EJECUTIVO'
  | 'COTIZACION_LASTMILE_EJECUTIVO'
  // Tracking
  | 'TRACKING_CREADO'
  | 'TRACKING_ELIMINADO'
  | 'TRACKING_FOLLOWER_AGREGADO'
  | 'TRACKING_FOLLOWER_ELIMINADO'
  // Pricing
  | 'PRICING_AIR_CREADO'
  | 'PRICING_AIR_ACTUALIZADO'
  | 'PRICING_AIR_ELIMINADO'
  | 'PRICING_FCL_CREADO'
  | 'PRICING_FCL_ACTUALIZADO'
  | 'PRICING_FCL_ELIMINADO'
  | 'PRICING_LCL_CREADO'
  | 'PRICING_LCL_ACTUALIZADO'
  | 'PRICING_LCL_ELIMINADO'
  // Gestión de usuarios
  | 'USUARIO_CREADO'
  | 'USUARIO_ACTUALIZADO'
  | 'USUARIO_ELIMINADO'
  // Gestión de ejecutivos
  | 'EJECUTIVO_CREADO'
  | 'EJECUTIVO_ACTUALIZADO'
  | 'EJECUTIVO_ELIMINADO';

export type AuditCategory =
  | 'COTIZACION'
  | 'TRACKING'
  | 'PRICING'
  | 'GESTION_USUARIOS'
  | 'GESTION_EJECUTIVOS';

export interface AuditPayload {
  accion: AuditAction;
  categoria: AuditCategory;
  descripcion: string;
  detalles?: Record<string, unknown>;
  // Para ejecutivos que actúan en nombre de clientes
  clienteAfectado?: string;
}

const API_BASE_URL =
  import.meta.env.MODE === 'development'
    ? 'http://localhost:4000'
    : '';

export function useAuditLog() {
  const { user, token } = useAuth();

  const registrarEvento = async (payload: AuditPayload): Promise<void> => {
    try {
      const body = {
        ...payload,
        usuario: user?.username || 'desconocido',
        email: user?.email || '',
        ejecutivo: user?.ejecutivo?.nombre || null,
        ejecutivoEmail: user?.ejecutivo?.email || null,
        rol: user?.username === 'Ejecutivo' ? 'ejecutivo' : 'cliente',
      };

      await fetch(`${API_BASE_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      // Silently fail - audit should never break the main flow
      console.warn('[Auditoría] Error al registrar evento:', error);
    }
  };

  return { registrarEvento };
}
