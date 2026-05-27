/**
 * Template HTML para notificación de solicitud de cotización especial por cliente.
 * Minimalista, responsive, con branding Seemann Group.
 */

export interface SpecialQuoteEmailData {
  ejecutivoNombre: string;
  clienteUsername: string;
  clienteEmail?: string;
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
  special: '#f59e0b',
};

export function getSpecialQuoteEmailSubject(data: SpecialQuoteEmailData): string {
  return `Solicitud de cotización especial — ${data.clienteUsername}`;
}

export function buildSpecialQuoteEmailHTML(data: SpecialQuoteEmailData): string {
  const fecha = new Date().toLocaleString('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Solicitud de Cotización Especial - Seemann Group</title>
  <style>
    @media only screen and (max-width: 620px) {
      .card { width: 100% !important; min-width: 0 !important; }
      .card-body { padding: 24px 16px !important; }
      .card-header { padding: 20px 16px !important; }
      .card-footer { padding: 16px !important; }
      .cta-btn { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 12px;">

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
                    <span style="color:${C.special};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Cotización Especial</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background-color:${C.special};height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="card-body" style="padding:28px 32px;">

              <p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.5;">
                Estimado/a <strong>${data.ejecutivoNombre}</strong>,
              </p>

              <p style="margin:0 0 20px;font-size:14px;color:${C.text};line-height:1.6;">
                Tu cliente <strong style="color:${C.primary};">${data.clienteUsername}</strong>${data.clienteEmail ? ` (${data.clienteEmail})` : ''} necesita una <strong>cotización de carácter especial</strong> y ha solicitado que lo contactes a la brevedad posible.
              </p>

              <!-- Special badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:${C.special};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:5px 14px;border-radius:3px;">
                    Requiere atención personalizada
                  </td>
                </tr>
              </table>

              <!-- Info card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;margin-bottom:20px;">
                <tr>
                  <td style="padding:8px 12px;font-size:13px;color:${C.muted};white-space:nowrap;width:190px;border-bottom:1px solid ${C.border};">Cliente</td>
                  <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${C.text};border-bottom:1px solid ${C.border};">${data.clienteUsername}</td>
                </tr>
                ${data.clienteEmail ? `<tr>
                  <td style="padding:8px 12px;font-size:13px;color:${C.muted};white-space:nowrap;width:190px;border-bottom:1px solid ${C.border};">Correo</td>
                  <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${C.text};border-bottom:1px solid ${C.border};">${data.clienteEmail}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:8px 12px;font-size:13px;color:${C.muted};white-space:nowrap;width:190px;">Fecha de solicitud</td>
                  <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${C.text};">${fecha}</td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;color:${C.text};line-height:1.6;">
                Por favor, comunícate con él/ella a la brevedad para asistirle con su requerimiento.
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
