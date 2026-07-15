/**
 * Template HTML para reenvío de PDF de cotización a destinatarios externos.
 */

export interface QuotePdfResendEmailData {
  quoteNumber: string;
  customerReference?: string;
  origen?: string;
  destino?: string;
  tipoServicio?: string;
}

const LOGO_URL = 'https://portalclientes.seemanngroup.com/logocompleto.png';

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const C = {
  primary: '#ff6200',
  card: '#ffffff',
  border: '#e5e7eb',
  canvas: '#eceff3',
  text: '#111827',
  muted: '#6b7280',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRoute(data: QuotePdfResendEmailData): string | null {
  const origen = (data.origen || '').trim();
  const destino = (data.destino || '').trim();
  if (!origen && !destino) return null;
  if (origen && destino) return `${escapeHtml(origen)} → ${escapeHtml(destino)}`;
  return escapeHtml(origen || destino);
}

export function getQuotePdfResendEmailSubject(data: QuotePdfResendEmailData): string {
  const ref = (data.customerReference || '').trim();
  if (ref) {
    return `Cotización Seemann Group México — ${ref}`;
  }
  return `Cotización Seemann Group México — ${data.quoteNumber}`;
}

export function buildQuotePdfResendEmailHTML(data: QuotePdfResendEmailData): string {
  const fecha = new Date().toLocaleString('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const route = formatRoute(data);
  const ref = (data.customerReference || '').trim();
  const quoteLabel = ref || data.quoteNumber;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotización Seemann Group México</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};font-family:${FONT};color:${C.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.canvas};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${C.card};border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 20px;text-align:center;border-bottom:1px solid ${C.border};">
              <img src="${LOGO_URL}" alt="Seemann Group México" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.primary};">
                Cotización
              </p>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.3;color:${C.text};">
                Tu cotización de Seemann Group México
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${C.muted};">
                Hola,<br />
                adjuntamos el PDF de la cotización <strong style="color:${C.text};">${escapeHtml(quoteLabel)}</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f9fa;border:1px solid ${C.border};border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;">Número de cotización</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:${C.text};">${escapeHtml(data.quoteNumber)}</p>
                    ${route ? `<p style="margin:12px 0 0;font-size:14px;color:${C.muted};"><strong style="color:${C.text};">Ruta:</strong> ${route}</p>` : ''}
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:1.6;color:${C.muted};">
                El documento PDF va adjunto a este correo. Si tienes consultas, responde a tu ejecutivo comercial de Seemann Group México.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid ${C.border};background:#fafafa;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${C.muted};text-align:center;">
                Enviado desde Portal Clientes Seemann Group México · ${fecha}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
