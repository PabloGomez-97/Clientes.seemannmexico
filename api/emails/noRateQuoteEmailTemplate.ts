/**
 * Template HTML para notificación de cotización sin tarifa (ruta no recurrente).
 * Minimalista, responsive, con branding Seemann Group.
 */

export interface NoRateQuoteEmailData {
  ejecutivoNombre: string;
  clienteUsername: string;
  quoteType: 'AIR' | 'FCL' | 'LCL' | 'LASTMILE';
  cargoDetails: Record<string, unknown>;
  quoteNumber?: string;
}

const LOGO_URL = 'https://portalclientes.seemanngroup.com/logocompleto.png';
const PORTAL_URL = 'https://portalclientes.seemanngroup.com';

const C = {
  primary: '#ff6200',
  dark: '#1a1a1a',
  text: '#333333',
  muted: '#666666',
  border: '#e0e0e0',
  bgLight: '#f8f9fa',
  white: '#ffffff',
};

function getServiceLabel(quoteType: string): string {
  if (quoteType === 'AIR') return 'Aéreo (AIR)';
  if (quoteType === 'FCL') return 'Marítimo FCL';
  if (quoteType === 'LASTMILE') return 'Última Milla';
  return 'Marítimo LCL';
}

function getServiceColor(quoteType: string): string {
  if (quoteType === 'AIR') return '#3b82f6';
  if (quoteType === 'FCL') return '#8b5cf6';
  if (quoteType === 'LASTMILE') return '#0d9488';
  return '#06b6d4';
}

function buildDetailRows(quoteType: string, d: any): string {
  const row = (label: string, value: string) => `
    <tr>
      <td class="detail-label" style="padding:8px 12px;font-size:13px;color:${C.muted};white-space:nowrap;width:180px;border-bottom:1px solid ${C.border};">${label}</td>
      <td class="detail-value" style="padding:8px 12px;font-size:13px;font-weight:600;color:${C.text};border-bottom:1px solid ${C.border};">${value || '—'}</td>
    </tr>`;

  if (quoteType === 'AIR') {
    const rows = [
      row('Origen', d.origen),
      row('Destino', d.destino),
      row('Carrier', d.carrier),
      row('Incoterm', d.incoterm),
      row('Tipo de bulto', d.packageType),
    ];
    if (d.isOverall) {
      rows.push(row('Modo de ingreso', 'OVERALL (datos globales)'));
      rows.push(row('Peso total (kg)', d.pesoTotal));
      rows.push(row('Volumen total (m³)', d.volumenTotal));
    } else {
      rows.push(row('Piezas / carga', d.piezasDesc));
      rows.push(row('Peso total (kg)', d.pesoTotal));
      rows.push(row('Volumen total (m³)', d.volumenTotal));
    }
    if (d.incoterm === 'EXW') {
      if (d.pickupFromAddress) rows.push(row('Dirección de recogida', d.pickupFromAddress as string));
      if (d.deliveryToAddress) rows.push(row('Dirección de entrega', d.deliveryToAddress as string));
    }
    return rows.join('');
  }
  if (quoteType === 'FCL') {
    const rows = [
      row('POL (Origen)', d.pol),
      row('POD (Destino)', d.pod),
      row('Carrier', d.carrier),
      row('Tipo de contenedor', d.containerType),
      row('Cantidad de contenedores', d.cantidadContenedores),
      row('Incoterm', d.incoterm),
    ];
    if (d.incoterm === 'EXW') {
      if (d.pickupFromAddress) rows.push(row('Dirección de recogida', d.pickupFromAddress as string));
      if (d.deliveryToAddress) rows.push(row('Dirección de entrega', d.deliveryToAddress as string));
    }
    return rows.join('');
  }
  // LCL
  const rows = [
    row('POL (Origen)', d.pol),
    row('POD (Destino)', d.pod),
    row('Operador', d.operador),
    row('Incoterm', d.incoterm),
    row('Piezas / carga', d.piezasDesc),
    row('Peso total (kg)', d.pesoTotal),
    row('Volumen total (m³)', d.volumenTotal),
  ];
  if (d.incoterm === 'EXW') {
    if (d.pickupFromAddress) rows.push(row('Dirección de recogida', d.pickupFromAddress as string));
    if (d.deliveryToAddress) rows.push(row('Dirección de entrega', d.deliveryToAddress as string));
  }
  return rows.join('');
}

function buildLastMileDetailRows(d: any, row: (l: string, v: string) => string): string {
  const rows = [
    row('Origen', d.pol),
    row('Destino', d.pod),
    row('Dirección de recogida', d.pickupFromAddress),
    row('Dirección de entrega', d.deliveryToAddress),
  ];
  if (d.piezasCount) rows.push(row('Cantidad de piezas', String(d.piezasCount)));
  if (d.piezasDesc) rows.push(row('Detalle de piezas', d.piezasDesc));
  if (d.pesoTotal) rows.push(row('Peso total (kg)', d.pesoTotal));
  if (d.volumenTotal) rows.push(row('Volumen total (m³)', d.volumenTotal));
  if (d.pesoVolumetrico) rows.push(row('Peso volumétrico (kg)', d.pesoVolumetrico));
  if (d.pesoChargeable) rows.push(row('Peso chargeable (kg)', d.pesoChargeable));
  return rows.join('');
}

export function getNoRateQuoteEmailSubject(data: NoRateQuoteEmailData): string {
  return `Cotización sin tarifa — ${data.clienteUsername} (${data.quoteType})`;
}

export function buildNoRateQuoteEmailHTML(data: NoRateQuoteEmailData): string {
  const fecha = new Date().toLocaleString('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const serviceLabel = getServiceLabel(data.quoteType);
  const serviceColor = getServiceColor(data.quoteType);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cotización sin tarifa - Seemann Group</title>
  <style>
    @media only screen and (max-width: 620px) {
      .card { width: 100% !important; min-width: 0 !important; }
      .card-body { padding: 24px 16px !important; }
      .card-header { padding: 20px 16px !important; }
      .card-footer { padding: 16px !important; }
      .detail-label { display: block !important; width: 100% !important; padding-bottom: 2px !important; }
      .detail-value { display: block !important; width: 100% !important; padding-top: 0 !important; padding-bottom: 12px !important; }
      .cta-btn { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <!-- Card -->
        <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" style="background-color:${C.white};border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);max-width:600px;min-width:320px;">

          <!-- Header -->
          <tr>
            <td class="card-header" style="background-color:${C.dark};padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="${LOGO_URL}" alt="Seemann Group" width="130" style="display:block;max-width:130px;height:auto;" />
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="color:${C.primary};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Tarificación Manual</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Orange accent bar -->
          <tr>
            <td style="background-color:${C.primary};height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="card-body" style="padding:28px 32px;">

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.5;">
                Estimado/a <strong>${data.ejecutivoNombre}</strong>,
              </p>

              <p style="margin:0 0 20px;font-size:14px;color:${C.text};line-height:1.6;">
                Tu cliente <strong style="color:${C.primary};">${data.clienteUsername}</strong> ha generado una cotización en una ruta sin tarifa configurada y requiere tarificación manual.
              </p>

              <!-- Service type badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:${serviceColor};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:5px 14px;border-radius:3px;">
                    ${serviceLabel}
                  </td>
                </tr>
              </table>

              <!-- Details table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;margin-bottom:20px;">
                ${data.quoteNumber ? `
                <tr>
                  <td class="detail-label" style="padding:8px 12px;font-size:13px;color:${C.muted};white-space:nowrap;width:180px;border-bottom:1px solid ${C.border};">N° de cotización</td>
                  <td class="detail-value" style="padding:8px 12px;font-size:13px;font-weight:600;color:${C.primary};border-bottom:1px solid ${C.border};">${data.quoteNumber}</td>
                </tr>` : ''}
                ${data.quoteType === 'LASTMILE' ? buildLastMileDetailRows(data.cargoDetails, (l, v) => `
                <tr>
                  <td class="detail-label" style="padding:8px 12px;font-size:13px;color:${C.muted};white-space:nowrap;width:180px;border-bottom:1px solid ${C.border};">${l}</td>
                  <td class="detail-value" style="padding:8px 12px;font-size:13px;font-weight:600;color:${C.text};border-bottom:1px solid ${C.border};">${v || '—'}</td>
                </tr>`) : buildDetailRows(data.quoteType, data.cargoDetails)}
                <tr>
                  <td class="detail-label" style="padding:8px 12px;font-size:13px;color:${C.muted};white-space:nowrap;width:180px;">Fecha de cotización</td>
                  <td class="detail-value" style="padding:8px 12px;font-size:13px;font-weight:600;color:${C.text};">${fecha}</td>
                </tr>
              </table>

              <!-- CTA -->
              <p style="margin:0 0 24px;font-size:14px;color:${C.text};line-height:1.6;">
                Por favor, revisa esta solicitud a la brevedad para asistirle.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td class="cta-btn" style="background-color:${C.primary};border-radius:4px;">
                    <a href="${PORTAL_URL}" target="_blank" style="display:inline-block;padding:10px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
                      Abrir Portal de Clientes
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="card-footer" style="background-color:${C.bgLight};padding:16px 32px;border-top:1px solid ${C.border};">
              <p style="margin:0;font-size:11px;color:${C.muted};text-align:center;line-height:1.5;">
                Este correo fue generado automáticamente por el
                <a href="${PORTAL_URL}" style="color:${C.primary};text-decoration:none;font-weight:600;">Portal de Clientes — Seemann Group</a>.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`.trim();
}
