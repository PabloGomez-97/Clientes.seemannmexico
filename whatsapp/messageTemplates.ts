export type TrackingWhatsAppEvent =
  | {
      type: 'TRACKING_CREATED';
      reference: string;
      shipmentMode?: 'AIR' | 'OCEAN';
      awbNumber?: string;
      containerNumber?: string;
      newStatus?: string;
      shipmentId?: string;
    }
  | {
      type: 'TRACKING_STATUS_CHANGED';
      reference: string;
      shipmentMode?: 'AIR' | 'OCEAN';
      awbNumber?: string;
      containerNumber?: string;
      oldStatus?: string;
      newStatus?: string;
      shipmentId?: string;
    }
  | {
      type: 'TRACKING_DELAYED';
      reference: string;
      shipmentMode?: 'AIR' | 'OCEAN';
      awbNumber?: string;
      containerNumber?: string;
      newStatus?: string;
      shipmentId?: string;
    };

function compact(lines: Array<string | undefined | null>): string {
  return lines
    .map((l) => (l == null ? '' : String(l)).trim())
    .filter(Boolean)
    .join('\n');
}

export function buildTrackingWhatsAppMessage(
  evt: TrackingWhatsAppEvent,
  opts: { portalBaseUrl?: string },
): string {
  const portalBaseUrl = (opts.portalBaseUrl || '').replace(/\/+$/, '');
  const portalLink = portalBaseUrl ? `${portalBaseUrl}/trackings` : '';

  const ref = evt.reference;
  const mode =
    evt.shipmentMode === 'AIR' ? 'Aéreo' : evt.shipmentMode === 'OCEAN' ? 'Marítimo' : undefined;
  const ident =
    evt.shipmentMode === 'AIR'
      ? evt.awbNumber
        ? `AWB: ${evt.awbNumber}`
        : undefined
      : evt.shipmentMode === 'OCEAN'
        ? evt.containerNumber
          ? `Contenedor: ${evt.containerNumber}`
          : undefined
        : undefined;

  if (evt.type === 'TRACKING_CREATED') {
    return compact([
      'Seguimiento creado (Shipsgo)',
      `Referencia: ${ref}`,
      mode ? `Modo: ${mode}` : undefined,
      ident,
      evt.newStatus ? `Estado inicial: ${evt.newStatus}` : undefined,
      portalLink ? `Ver detalle en el portal: ${portalLink}` : undefined,
    ]);
  }

  if (evt.type === 'TRACKING_STATUS_CHANGED') {
    return compact([
      'Actualización de tu carga (Shipsgo)',
      `Referencia: ${ref}`,
      mode ? `Modo: ${mode}` : undefined,
      ident,
      evt.oldStatus && evt.newStatus ? `Estado: ${evt.oldStatus} → ${evt.newStatus}` : undefined,
      portalLink ? `Ver detalle en el portal: ${portalLink}` : undefined,
    ]);
  }

  return compact([
    'Alerta de atraso en tu carga (Shipsgo)',
    `Referencia: ${ref}`,
    mode ? `Modo: ${mode}` : undefined,
    ident,
    evt.newStatus ? `Estado actual: ${evt.newStatus}` : undefined,
    portalLink ? `Ver detalle en el portal: ${portalLink}` : undefined,
  ]);
}

