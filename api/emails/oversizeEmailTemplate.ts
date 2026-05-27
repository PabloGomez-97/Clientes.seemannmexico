/**
 * Template HTML para el correo de notificación de carga especial (oversize).
 * Minimalista, compatible con clientes de email, con branding Seemann Group.
 */

export interface OversizeChargeItem {
  label: string;
  amount: number;
}

export interface OversizeEmailData {
  clienteNombre: string;
  clienteEmail: string;
  origen: string;
  destino: string;
  carrier: string;
  descripcion: string;
  incoterm: string;
  validUntil?: string;
  motivos: string[];
  piezas: Array<{
    pieza: number;
    largo: number;
    ancho: number;
    alto: number;
    peso: number;
    noApilable: boolean;
  }>;
  /** Resumen de cargos (opcional, se muestra si viene con items) */
  cargos?: {
    currency: string;
    items: OversizeChargeItem[];
    total: number;
  };
}

const MOTIVO_LABELS: Record<string, string> = {
  oversize: 'Carga Oversize (largo o ancho > 300 cm)',
  'no-apta-aereo': 'No apta para transporte aéreo (alto > 240 cm)',
  'vuelo-carguero': 'Requiere vuelo carguero (alto > 160 cm)',
  'oversize-maritimo': 'Carga Oversize Marítima (excede límites de contenedor: L 1203 / A 234 / H 259 cm)',
};

// ─── Colores corporativos ───
const C = {
  primary: '#ff6200',
  dark: '#1a1a1a',
  text: '#333333',
  muted: '#666666',
  border: '#e0e0e0',
  bgLight: '#f8f9fa',
  white: '#ffffff',
};

const LOGO_URL = 'https://portalclientes.seemanngroup.com/logocompleto.png';
const PORTAL_URL = 'https://portalclientes.seemanngroup.com';

/**
 * Genera el subject del email.
 */
export function getOversizeEmailSubject(data: OversizeEmailData): string {
  return `⚠️ Cotización especial solicitada por ${data.clienteNombre}`;
}

/**
 * Genera el HTML completo del email.
 */
export function buildOversizeEmailHTML(data: OversizeEmailData): string {
  const fecha = new Date().toLocaleString('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const motivosHTML = (data.motivos || [])
    .map((m) => {
      const label = MOTIVO_LABELS[m] || m;
      return `<li style="padding:4px 0;color:${C.text};font-size:14px;">${label}</li>`;
    })
    .join('');

  const piezasRows = (data.piezas || [])
    .map(
      (p, idx) => `
      <tr style="border-bottom:1px solid ${C.border};">
        <td style="padding:8px 12px;font-size:13px;color:${C.text};text-align:center;">${idx + 1}</td>
        <td style="padding:8px 12px;font-size:13px;color:${C.text};text-align:center;">${p.largo} × ${p.ancho} × ${p.alto}</td>
        <td style="padding:8px 12px;font-size:13px;color:${C.text};text-align:center;">${p.peso} kg</td>
        <td style="padding:8px 12px;font-size:13px;color:${C.text};text-align:center;">${p.noApilable ? 'Sí' : '—'}</td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cotización Especial - Seemann Group</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${C.white};border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:${C.dark};padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="${LOGO_URL}" alt="Seemann Group" width="140" style="display:block;" />
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="color:${C.primary};font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Cotización Especial</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent line -->
          <tr>
            <td style="height:3px;background-color:${C.primary};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Greeting -->
              <p style="margin:0 0 20px;font-size:15px;color:${C.text};line-height:1.6;">
                Estimado ejecutivo,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:${C.text};line-height:1.6;">
                El cliente <strong>${data.clienteNombre}</strong> (${data.clienteEmail}) ha solicitado una cotización aérea que requiere análisis especial.
              </p>

              <!-- Motivos -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#fff5f0;border-left:3px solid ${C.primary};padding:16px 20px;border-radius:0 4px 4px 0;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${C.primary};text-transform:uppercase;letter-spacing:0.5px;">Motivo(s)</p>
                    <ul style="margin:0;padding-left:18px;list-style:disc;">
                      ${motivosHTML}
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Shipment details -->
              <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.5px;">Detalles del envío</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;margin-bottom:24px;">
                <tr style="border-bottom:1px solid ${C.border};">
                  <td style="padding:10px 16px;font-size:13px;color:${C.muted};width:35%;background-color:${C.bgLight};">Origen</td>
                  <td style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;">${data.origen || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom:1px solid ${C.border};">
                  <td style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};">Destino</td>
                  <td style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;">${data.destino || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom:1px solid ${C.border};">
                  <td style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};">Carrier</td>
                  <td style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;">${data.carrier || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom:1px solid ${C.border};">
                  <td style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};">Descripción</td>
                  <td style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;">${data.descripcion || 'No especificada'}</td>
                </tr>
                <tr style="border-bottom:1px solid ${C.border};">
                  <td style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};">Incoterm</td>
                  <td style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;">${data.incoterm || 'No especificado'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};">Válido Hasta</td>
                  <td style="padding:10px 16px;font-size:13px;color:${C.primary};font-weight:700;">${data.validUntil || 'No especificado'}</td>
                </tr>
              </table>

              <!-- Pieces table -->
              ${
                data.piezas && data.piezas.length > 0
                  ? `
              <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.5px;">Detalle de piezas</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
                <thead>
                  <tr style="background-color:${C.dark};">
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:${C.white};text-transform:uppercase;letter-spacing:0.3px;text-align:center;">Pieza</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:${C.white};text-transform:uppercase;letter-spacing:0.3px;text-align:center;">Dimensiones (cm)</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:${C.white};text-transform:uppercase;letter-spacing:0.3px;text-align:center;">Peso</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:${C.white};text-transform:uppercase;letter-spacing:0.3px;text-align:center;">No Apilable</th>
                  </tr>
                </thead>
                <tbody>
                  ${piezasRows}
                </tbody>
              </table>
              `
                  : ''
              }

              <!-- Charges summary -->
              ${data.cargos && data.cargos.items.length > 0 ? `
              <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.5px;">Resumen de cargos</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
                <tbody>
                  ${data.cargos.items.map(item => `
                  <tr style="border-bottom:1px solid ${C.border};">
                    <td style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};width:55%;">${item.label}</td>
                    <td style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;text-align:right;">${data.cargos!.currency} ${item.amount.toFixed(2)}</td>
                  </tr>`).join('')}
                  <tr style="background-color:${C.dark};">
                    <td style="padding:12px 16px;font-size:14px;font-weight:600;color:${C.white};">TOTAL</td>
                    <td style="padding:12px 16px;font-size:14px;font-weight:700;color:${C.primary};text-align:right;">${data.cargos.currency} ${data.cargos.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              ` : ''}

              <!-- Date -->
              <p style="margin:0 0 24px;font-size:13px;color:${C.muted};">
                Fecha de solicitud: ${fecha}
              </p>

              <!-- CTA -->
              <p style="margin:0 0 4px;font-size:15px;color:${C.text};line-height:1.6;">
                Por favor, contacte al cliente para generar una cotización personalizada.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${C.bgLight};border-top:1px solid ${C.border};padding:20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:${C.muted};line-height:1.5;">
                    Seemann Cloud · <a href="${PORTAL_URL}" style="color:${C.primary};text-decoration:none;">portalclientes.seemanngroup.com</a>
                  </td>
                  <td align="right" style="font-size:11px;color:#999999;">
                    Correo generado automáticamente
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper -->

</body>
</html>`.trim();
}
