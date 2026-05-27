/**
 * Template HTML para notificación de subida de documento.
 * Minimalista, compatible con clientes de email, con branding Seemann Group.
 * Responsive para móvil.
 */

export interface DocumentUploadEmailData {
  /** Número de la cotización u operación */
  numero: string;
  /** 'Cotización' | 'Operación Aérea' | 'Operación Marítima' | 'Operación Terrestre' */
  tipoOperacion: string;
  /** Tipo/categoría del documento (e.g. 'Invoice', 'Bill of Lading') */
  tipoDocumento: string;
  /** Nombre del archivo subido */
  nombreArchivo: string;
  /** Nombre del usuario que subió el documento */
  subidoPor: string;
}

// ─── Colores corporativos ───
const C = {
  primary: '#ff6200',
  dark: '#1a1a1a',
  text: '#333333',
  muted: '#666666',
  border: '#e0e0e0',
  bgLight: '#f8f9fa',
  white: '#ffffff',
  accent: '#0d6efd',
};

const LOGO_URL = 'https://portalclientes.seemanngroup.com/logocompleto.png';
const PORTAL_URL = 'https://portalclientes.seemanngroup.com';

/**
 * Color de acento según tipo de operación.
 */
function getAccentColor(tipoOperacion: string): string {
  if (tipoOperacion.toLowerCase().includes('aérea')) return C.primary;
  if (tipoOperacion.toLowerCase().includes('marítima')) return C.accent;
  if (tipoOperacion.toLowerCase().includes('terrestre')) return '#198754';
  return C.primary;
}

/**
 * Genera el subject del email.
 */
export function getDocumentUploadEmailSubject(data: DocumentUploadEmailData): string {
  return `Nuevo documento en ${data.tipoOperacion} #${data.numero}`;
}

/**
 * Genera el HTML completo del email de notificación de documento.
 */
export function buildDocumentUploadEmailHTML(data: DocumentUploadEmailData): string {
  const fecha = new Date().toLocaleString('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const accent = getAccentColor(data.tipoOperacion);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Nuevo Documento - Seemann Group</title>
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

  <!-- Wrapper -->
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
                    <span style="color:${accent};font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Nuevo Documento</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent line -->
          <tr>
            <td style="height:3px;background-color:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="card-body" style="padding:32px;">

              <!-- Title -->
              <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:${C.dark};letter-spacing:-0.02em;">
                Documento subido
              </p>
              <p style="margin:0 0 24px;font-size:13px;color:${C.muted};">
                ${data.tipoOperacion} #${data.numero}
              </p>

              <!-- Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
                <tr style="border-bottom:1px solid ${C.border};">
                  <td class="detail-label" style="padding:10px 16px;font-size:13px;color:${C.muted};width:40%;background-color:${C.bgLight};font-weight:500;">N&uacute;mero</td>
                  <td class="detail-value" style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:600;">${data.numero}</td>
                </tr>
                <tr style="border-bottom:1px solid ${C.border};">
                  <td class="detail-label" style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};font-weight:500;">Tipo de documento</td>
                  <td class="detail-value" style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;">${data.tipoDocumento}</td>
                </tr>
                <tr style="border-bottom:1px solid ${C.border};">
                  <td class="detail-label" style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};font-weight:500;">Archivo</td>
                  <td class="detail-value" style="padding:10px 16px;font-size:13px;color:${accent};font-weight:500;word-break:break-all;">${data.nombreArchivo}</td>
                </tr>
                <tr style="border-bottom:1px solid ${C.border};">
                  <td class="detail-label" style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};font-weight:500;">Subido por</td>
                  <td class="detail-value" style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;">${data.subidoPor}</td>
                </tr>
                <tr>
                  <td class="detail-label" style="padding:10px 16px;font-size:13px;color:${C.muted};background-color:${C.bgLight};font-weight:500;">Fecha y hora</td>
                  <td class="detail-value" style="padding:10px 16px;font-size:13px;color:${C.text};font-weight:500;">${fecha}</td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${PORTAL_URL}" class="cta-btn" style="display:inline-block;padding:12px 32px;background-color:${accent};color:${C.white};font-size:14px;font-weight:600;text-decoration:none;border-radius:4px;letter-spacing:0.3px;">
                      Ver en el portal
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Note -->
              <p style="margin:0;font-size:12px;color:${C.muted};text-align:center;line-height:1.5;">
                Ingresa al portal para descargar o revisar el documento.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="card-footer" style="background-color:${C.bgLight};border-top:1px solid ${C.border};padding:20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:${C.muted};line-height:1.5;">
                    Seemann Cloud &middot; <a href="${PORTAL_URL}" style="color:${accent};text-decoration:none;">portalclientes.seemanngroup.com</a>
                  </td>
                  <td align="right" style="font-size:11px;color:#999999;">
                    Correo generado autom&aacute;ticamente
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
