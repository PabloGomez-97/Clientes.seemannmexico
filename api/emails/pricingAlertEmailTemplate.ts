/**
 * Templates HTML para alertas de tarifas próximas a vencer.
 * Branding Seemann Group: #ff6200, Inter font, logo corporativo.
 */

const C = {
  primary: '#ff6200',
  dark: '#1a1a1a',
  text: '#333333',
  muted: '#666666',
  border: '#e0e0e0',
  bgLight: '#f8f9fa',
  white: '#ffffff',
  danger: '#ef4444',
  warning: '#f59e0b',
};

const LOGO_URL = 'https://portalclientes.seemanngroup.com/logocompleto.png';

export type AlertType = '48hrs' | '24hrs';

// ─── Data interfaces ─────────────────────────────────────────

export interface TarifaAereaExpiringData {
  origen: string;
  destino: string;
  kg45: string | null;
  kg100: string | null;
  kg300: string | null;
  kg500: string | null;
  kg1000: string | null;
  carrier: string | null;
  frequency: string | null;
  transitTime: string | null;
  routing: string | null;
  remark1: string | null;
  remark2: string | null;
  currency: string | null;
  validUntil: string;
  company: string | null;
  localCharges: string | null;
  gastosXKg: string | null;
  minGastosXKg: string | null;
  rowNumber: number;
  daysUntilExpiry?: number;
}

export interface TarifaFCLExpiringData {
  pol: string;
  pod: string;
  gp20: string | null;
  hq40: string | null;
  nor40: string | null;
  carrier: string | null;
  tt: string | null;
  remarks: string | null;
  freeTime: string | null;
  company: string | null;
  currency: string | null;
  validUntil: string;
  rowNumber: number;
  daysUntilExpiry?: number;
}

export interface TarifaLCLExpiringData {
  pol: string;
  servicio: string | null;
  pod: string;
  ofWM: string | null;
  currency: string | null;
  frecuencia: string | null;
  agente: string | null;
  ttAprox: string | null;
  operador: string | null;
  validUntil: string;
  rowNumber: number;
  daysUntilExpiry?: number;
}

// ─── Helpers ─────────────────────────────────────────────────

function val(v: string | null | undefined): string {
  if (!v) return '—';
  const s = String(v).trim();
  return s || '—';
}

function th(label: string, color: string): string {
  return `<th style="background-color:${color};color:#fff;padding:8px 10px;font-size:11px;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.4px;border-bottom:2px solid rgba(0,0,0,0.15);white-space:nowrap;">${label}</th>`;
}

function thDanger(label: string): string {
  return th(label, C.danger);
}

function td(content: string, extraStyle = ''): string {
  return `<td style="padding:8px 10px;font-size:12px;color:${C.text};border-bottom:1px solid ${C.border};vertical-align:top;${extraStyle}">${content}</td>`;
}

function tdDanger(content: string): string {
  return td(content, `color:${C.danger};font-weight:600;`);
}

// ─── Wrapper HTML ─────────────────────────────────────────────

function emailWrapper(title: string, alertType: AlertType, bodyHtml: string): string {
  const badge =
    alertType === '48hrs'
      ? `<span style="background-color:${C.warning};color:#fff;padding:3px 10px;border-radius:3px;font-size:11px;font-weight:700;">⚠ 48 HORAS</span>`
      : `<span style="background-color:${C.danger};color:#fff;padding:3px 10px;border-radius:3px;font-size:11px;font-weight:700;">🔴 24 HORAS</span>`;

  const urgencyMsg =
    alertType === '48hrs'
      ? 'vence en las próximas 48 horas'
      : 'vence mañana';

  const now = new Date();
  const fecha = now.toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santiago' });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <style>
    body{margin:0;padding:0;background-color:#f4f4f5;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;}
    table{border-collapse:collapse;}
    .wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
    .rt th,.rt td{white-space:nowrap;}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="700" cellpadding="0" cellspacing="0"
             style="max-width:700px;background-color:${C.white};border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background-color:${C.primary};padding:18px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><img src="${LOGO_URL}" alt="Seemann Group" height="34" style="height:34px;width:auto;display:block;"/></td>
                <td align="right" valign="middle">${badge}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:20px 28px 12px;border-bottom:1px solid ${C.border};">
            <h1 style="margin:0 0 6px;font-size:17px;font-weight:700;color:${C.dark};">${title}</h1>
            <p style="margin:0;font-size:13px;color:${C.muted};">La(s) siguiente(s) tarifa(s) <strong style="color:${C.danger};">${urgencyMsg}</strong>. Por favor toma las acciones necesarias.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:20px 28px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:${C.bgLight};padding:12px 28px;border-top:1px solid ${C.border};">
            <p style="margin:0;font-size:11px;color:${C.muted};">Generado automáticamente el ${fecha} · Seemann Group · Portal de Pricing</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── AIR ─────────────────────────────────────────────────────

const AIR_COLOR = '#3b82f6';

export function buildAirExpiryAlertSubject(alertType: AlertType, count: number): string {
  return `⚠ Alerta Pricing Aéreo — ${count} tarifa${count > 1 ? 's' : ''} ${alertType === '48hrs' ? 'vence en 48 horas' : 'vence mañana'}`;
}

export function buildAirExpiryAlertHTML(tarifas: TarifaAereaExpiringData[], alertType: AlertType): string {
  const rows = tarifas
    .map((t, i) => {
      const bg = i % 2 === 0 ? C.white : C.bgLight;
      return `<tr style="background-color:${bg};">
        ${td(val(t.origen))}
        ${td(val(t.destino))}
        ${td(val(t.kg45), 'text-align:right;')}
        ${td(val(t.kg100), 'text-align:right;')}
        ${td(val(t.kg300), 'text-align:right;')}
        ${td(val(t.kg500), 'text-align:right;')}
        ${td(val(t.kg1000), 'text-align:right;')}
        ${td(val(t.carrier))}
        ${td(val(t.frequency))}
        ${td(val(t.transitTime))}
        ${td(val(t.routing))}
        ${td(val(t.remark1))}
        ${td(val(t.remark2))}
        ${td(val(t.currency))}
        ${tdDanger(val(t.validUntil))}
        ${td(val(t.company))}
        ${td(val(t.localCharges), 'text-align:right;')}
        ${td(val(t.gastosXKg), 'text-align:right;')}
        ${td(val(t.minGastosXKg), 'text-align:right;')}
      </tr>`;
    })
    .join('');

  const tableHtml = `
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:${C.dark};">
      Tarifas Aéreas — ${tarifas.length} registro${tarifas.length > 1 ? 's' : ''}
    </p>
    <div class="wrap">
      <table role="presentation" class="rt" cellpadding="0" cellspacing="0"
             style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;">
        <thead>
          <tr>
            ${th('Origin', AIR_COLOR)}
            ${th('Destination', AIR_COLOR)}
            ${th('45kgs+', AIR_COLOR)}
            ${th('100kgs+', AIR_COLOR)}
            ${th('300kgs+', AIR_COLOR)}
            ${th('500kgs+', AIR_COLOR)}
            ${th('1000kgs+', AIR_COLOR)}
            ${th('Carrier', AIR_COLOR)}
            ${th('Frequency', AIR_COLOR)}
            ${th('Transit Time', AIR_COLOR)}
            ${th('Routing', AIR_COLOR)}
            ${th('Remark 1', AIR_COLOR)}
            ${th('Remark 2', AIR_COLOR)}
            ${th('Currency', AIR_COLOR)}
            ${thDanger('Válido Hasta')}
            ${th('Compañía', AIR_COLOR)}
            ${th('Local Charges', AIR_COLOR)}
            ${th('Gastos x kg', AIR_COLOR)}
            ${th('Mín. Gastos x kg', AIR_COLOR)}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  return emailWrapper('Alerta: Tarifas Aéreas por Vencer', alertType, tableHtml);
}

// ─── FCL ─────────────────────────────────────────────────────

const FCL_COLOR = '#0ea5e9';

export function buildFCLExpiryAlertSubject(alertType: AlertType, count: number): string {
  return `⚠ Alerta Pricing FCL — ${count} tarifa${count > 1 ? 's' : ''} ${alertType === '48hrs' ? 'vence en 48 horas' : 'vence mañana'}`;
}

export function buildFCLExpiryAlertHTML(tarifas: TarifaFCLExpiringData[], alertType: AlertType): string {
  const rows = tarifas
    .map((t, i) => {
      const bg = i % 2 === 0 ? C.white : C.bgLight;
      return `<tr style="background-color:${bg};">
        ${td(val(t.pol))}
        ${td(val(t.pod))}
        ${td(val(t.gp20), 'text-align:right;')}
        ${td(val(t.hq40), 'text-align:right;')}
        ${td(val(t.nor40), 'text-align:right;')}
        ${td(val(t.carrier))}
        ${td(val(t.tt))}
        ${td(val(t.remarks))}
        ${td(val(t.freeTime))}
        ${td(val(t.company))}
        ${td(val(t.currency))}
        ${tdDanger(val(t.validUntil))}
      </tr>`;
    })
    .join('');

  const tableHtml = `
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:${C.dark};">
      Tarifas FCL — ${tarifas.length} registro${tarifas.length > 1 ? 's' : ''}
    </p>
    <div class="wrap">
      <table role="presentation" class="rt" cellpadding="0" cellspacing="0"
             style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;">
        <thead>
          <tr>
            ${th('POL', FCL_COLOR)}
            ${th('POD', FCL_COLOR)}
            ${th('20GP', FCL_COLOR)}
            ${th('40HQ', FCL_COLOR)}
            ${th('40NOR', FCL_COLOR)}
            ${th('Carrier', FCL_COLOR)}
            ${th('Tiempo en Tránsito', FCL_COLOR)}
            ${th('Remarks', FCL_COLOR)}
            ${th('Free Time', FCL_COLOR)}
            ${th('Compañía', FCL_COLOR)}
            ${th('Currency', FCL_COLOR)}
            ${thDanger('Validez')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  return emailWrapper('Alerta: Tarifas FCL por Vencer', alertType, tableHtml);
}

// ─── LCL ─────────────────────────────────────────────────────

const LCL_COLOR = '#8b5cf6';

export function buildLCLExpiryAlertSubject(alertType: AlertType, count: number): string {
  return `⚠ Alerta Pricing LCL — ${count} tarifa${count > 1 ? 's' : ''} ${alertType === '48hrs' ? 'vence en 48 horas' : 'vence mañana'}`;
}

export function buildLCLExpiryAlertHTML(tarifas: TarifaLCLExpiringData[], alertType: AlertType): string {
  const rows = tarifas
    .map((t, i) => {
      const bg = i % 2 === 0 ? C.white : C.bgLight;
      return `<tr style="background-color:${bg};">
        ${td(val(t.pol))}
        ${td(val(t.servicio))}
        ${td(val(t.pod))}
        ${td(val(t.ofWM), 'text-align:right;')}
        ${td(val(t.currency))}
        ${td(val(t.frecuencia))}
        ${td(val(t.agente))}
        ${td(val(t.ttAprox))}
        ${td(val(t.operador))}
        ${tdDanger(val(t.validUntil))}
      </tr>`;
    })
    .join('');

  const tableHtml = `
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:${C.dark};">
      Tarifas LCL — ${tarifas.length} registro${tarifas.length > 1 ? 's' : ''}
    </p>
    <div class="wrap">
      <table role="presentation" class="rt" cellpadding="0" cellspacing="0"
             style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;">
        <thead>
          <tr>
            ${th('POL', LCL_COLOR)}
            ${th('Servicio - Vía', LCL_COLOR)}
            ${th('POD', LCL_COLOR)}
            ${th('OF W/M', LCL_COLOR)}
            ${th('Currency', LCL_COLOR)}
            ${th('Frecuencia', LCL_COLOR)}
            ${th('Agente', LCL_COLOR)}
            ${th('TT Aprox.', LCL_COLOR)}
            ${th('Operador', LCL_COLOR)}
            ${thDanger('Validez')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  return emailWrapper('Alerta: Tarifas LCL por Vencer', alertType, tableHtml);
}
