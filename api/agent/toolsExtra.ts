// api/agent/toolsExtra.ts
// 10 nuevas herramientas para el AI Agent: tarifas, calculadoras, lookups y dashboard.

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getAirRates,
  getFclRates,
  getLclRates,
  LASTMILE_PRICING,
  parseValidUntil,
  daysUntil,
} from './sheets.js';
import { findIncoterm, INCOTERMS_2020 } from './incoterms.js';
import { findLocation, findPort, findAirport } from './locations.js';
import { getToolContext } from './toolsContext.js';

// ============================================================================
// CONFIG
// ============================================================================

// Markup estándar aplicado a tarifas mostradas al cliente.
// Aire/FCL = 15% sobre flete; LCL = 15% sobre W/M (espejo de Quote*.tsx).
const MARKUP_AIR_FCL = 1.15;
const MARKUP_LCL = 1.15;

const PRICE_DISCLAIMER =
  'Estimación referencial con margen estándar — no reemplaza una cotización formal en /newquotes.';

// ============================================================================
// HELPERS
// ============================================================================

function fmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return 'N/D';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function norm(s: string): string {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchRoute(field: string, query: string): boolean {
  if (!query) return true;
  return norm(field).includes(norm(query));
}

async function linbisFetch(path: string): Promise<unknown> {
  const ctx = getToolContext();
  const res = await fetch(`https://api.linbis.com${path}`, {
    headers: {
      Authorization: `Bearer ${ctx.linbisAccessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Linbis ${res.status}`);
  return res.json();
}

async function shipsgoFetch(path: string): Promise<unknown> {
  const ctx = getToolContext();
  const res = await fetch(`${ctx.baseUrl}/api/shipsgo${path}`, {
    headers: { Authorization: `Bearer ${ctx.userToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`ShipsGo ${res.status}`);
  return res.json();
}

function extractItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.results)) return o.results as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  }
  return [];
}

// ============================================================================
// TOOL 1: get_rate_estimate
// Cotizador rápido AIR/FCL/LCL/LASTMILE con precio estimado
// ============================================================================

export const getRateEstimate = tool(
  async ({ mode, origin, destination, weightKg, volumeCbm, container, pieces }): Promise<string> => {
    try {
      // ---------- AEREO ----------
      if (mode === 'AEREO') {
        const rates = await getAirRates();
        const filtered = rates.filter(
          (r) => matchRoute(r.origin, origin) && matchRoute(r.destination, destination),
        );
        if (filtered.length === 0) {
          return JSON.stringify({
            found: false,
            message: `No encontré tarifas aéreas ${origin} → ${destination}.`,
            suggestion: 'Verifica códigos IATA o pide cotización formal en /QuoteAIR.',
          });
        }
        const w = Math.max(weightKg || 0, (volumeCbm || 0) * 167);
        const showPrices = w > 0;

        const top = filtered.slice(0, 3).map((r) => {
          let perKg = 0;
          let bracket = '';
          if (w >= 1000) { perKg = r.kg1000; bracket = '+1000kg'; }
          else if (w >= 500) { perKg = r.kg500; bracket = '+500kg'; }
          else if (w >= 300) { perKg = r.kg300; bracket = '+300kg'; }
          else if (w >= 100) { perKg = r.kg100; bracket = '+100kg'; }
          else if (w > 0) { perKg = r.kg45; bracket = '+45kg'; }

          const freightWithMarkup = perKg * MARKUP_AIR_FCL;
          const totalFreight = w > 0 ? freightWithMarkup * w : 0;
          const localCharges = r.localCharges * 1.20;
          const gastosKg = Math.max(r.gastosXKg * w * 1.20, r.minGastosXKg * 1.20);
          const total = totalFreight + localCharges + gastosKg;

          return {
            carrier: r.carrier || 'N/D',
            ratesPerKg: showPrices ? {
              bracket,
              base: `${r.currency} ${fmt(perKg)}/kg`,
              estimated: `${r.currency} ${fmt(freightWithMarkup)}/kg`,
            } : {
              ranges: `+45kg: ${fmt(r.kg45 * MARKUP_AIR_FCL)} | +100kg: ${fmt(r.kg100 * MARKUP_AIR_FCL)} | +300kg: ${fmt(r.kg300 * MARKUP_AIR_FCL)} | +500kg: ${fmt(r.kg500 * MARKUP_AIR_FCL)} | +1000kg: ${fmt(r.kg1000 * MARKUP_AIR_FCL)} (${r.currency}/kg)`,
            },
            estimatedTotal: showPrices ? `${r.currency} ${fmt(total)} (peso facturable: ${fmt(w)} kg)` : null,
            transitTime: r.transitTime || 'N/D',
            frequency: r.frequency || 'N/D',
            validUntil: r.validUntil || 'N/D',
          };
        });

        return JSON.stringify({
          found: true,
          mode: 'AEREO',
          origin,
          destination,
          chargeable_weight_kg: w || null,
          totalRoutes: filtered.length,
          showing: top.length,
          rates: top,
          disclaimer: PRICE_DISCLAIMER,
        });
      }

      // ---------- FCL ----------
      if (mode === 'FCL') {
        const rates = await getFclRates();
        const filtered = rates.filter(
          (r) => matchRoute(r.pol, origin) && matchRoute(r.pod, destination),
        );
        if (filtered.length === 0) {
          return JSON.stringify({
            found: false,
            message: `No encontré tarifas FCL ${origin} → ${destination}.`,
            suggestion: 'Verifica nombre del puerto o pide cotización en /QuoteFCL.',
          });
        }
        const top = filtered.slice(0, 3).map((r) => {
          const gp20 = r.gp20 * MARKUP_AIR_FCL;
          const hq40 = r.hq40 * MARKUP_AIR_FCL;
          const nor40 = r.nor40 * MARKUP_AIR_FCL;
          const result: Record<string, unknown> = {
            carrier: r.carrier || 'N/D',
            currency: r.currency,
            transitTime: r.transitTime || 'N/D',
            freeTime: r.freeTime || 'N/D',
            validUntil: r.validUntil || 'N/D',
            estimatedRates: {
              '20GP': r.gp20 > 0 ? `${r.currency} ${fmt(gp20)}` : 'N/D',
              '40HQ': r.hq40 > 0 ? `${r.currency} ${fmt(hq40)}` : 'N/D',
              '40NOR (refer)': r.nor40 > 0 ? `${r.currency} ${fmt(nor40)}` : 'N/D',
            },
          };
          if (container && pieces) {
            let unit = 0;
            if (container === '20GP') unit = gp20;
            else if (container === '40HQ') unit = hq40;
            else if (container === '40NOR') unit = nor40;
            if (unit > 0) result.totalEstimated = `${r.currency} ${fmt(unit * pieces)} (${pieces} × ${container})`;
          }
          return result;
        });

        return JSON.stringify({
          found: true,
          mode: 'FCL',
          origin,
          destination,
          totalRoutes: filtered.length,
          showing: top.length,
          rates: top,
          disclaimer: PRICE_DISCLAIMER,
        });
      }

      // ---------- LCL ----------
      if (mode === 'LCL') {
        const rates = await getLclRates();
        const filtered = rates.filter(
          (r) => matchRoute(r.pol, origin) && matchRoute(r.pod, destination),
        );
        if (filtered.length === 0) {
          return JSON.stringify({
            found: false,
            message: `No encontré tarifas LCL ${origin} → ${destination}.`,
            suggestion: 'Pide cotización formal en /QuoteLCL.',
          });
        }
        const wm = Math.max((weightKg || 0) / 1000, volumeCbm || 0, 1);
        const showTotal = (weightKg || volumeCbm) ? true : false;

        const top = filtered.slice(0, 3).map((r) => {
          const ratePerWM = r.ofWM * MARKUP_LCL;
          const total = ratePerWM * wm;
          return {
            carrier: r.operador || r.agente || 'N/D',
            servicio: r.servicio || 'N/D',
            ratePerWM: `${r.currency} ${fmt(ratePerWM)}/W/M (CBM o ton, lo mayor; min 1)`,
            estimatedTotal: showTotal ? `${r.currency} ${fmt(total)} (W/M facturable: ${fmt(wm)})` : null,
            transitTime: r.transitTime || 'N/D',
            frequency: r.frecuencia || 'N/D',
            validUntil: r.validUntil || 'N/D',
          };
        });

        return JSON.stringify({
          found: true,
          mode: 'LCL',
          origin,
          destination,
          billable_wm: showTotal ? wm : null,
          totalRoutes: filtered.length,
          showing: top.length,
          rates: top,
          disclaimer: PRICE_DISCLAIMER,
        });
      }

      // ---------- LASTMILE ----------
      if (mode === 'LASTMILE') {
        const w = weightKg || 0;
        const v = volumeCbm || 0;
        if (w === 0 && v === 0) {
          return JSON.stringify({
            mode: 'LASTMILE',
            message: 'Para cotizar última milla necesito al menos peso (kg) o volumen (m³).',
            note: 'La tarifa es fija según rangos de peso/volumen para entregas en Chile (LCL_DAP) y aérea local (AEREO_DAP).',
          });
        }
        // Delivery (LCL_DAP)
        const delivery = LASTMILE_PRICING.delivery.find((b) => w <= b.maxKg && v <= b.maxCbm);
        const terrestrial = LASTMILE_PRICING.terrestrial.find((b) => w <= b.maxKg);
        return JSON.stringify({
          found: true,
          mode: 'LASTMILE',
          input: { weightKg: w, volumeCbm: v },
          delivery_LCL_DAP: delivery ? `USD ${fmt(delivery.usd)} (rango hasta ${delivery.maxKg}kg / ${delivery.maxCbm}m³)` : 'Excede rangos publicados — solicita cotización',
          terrestrial_AEREO_DAP: terrestrial ? `USD ${fmt(terrestrial.usd)} (rango hasta ${terrestrial.maxKg}kg)` : 'Excede rangos publicados',
          note: 'Tarifas para última milla en Chile. Consulta cobertura por ciudad en /QuoteLASTMILE.',
        });
      }

      return JSON.stringify({ error: 'Modo inválido' });
    } catch (e) {
      return JSON.stringify({ error: 'Error consultando tarifas', details: (e as Error).message });
    }
  },
  {
    name: 'get_rate_estimate',
    description:
      'Estima el precio de un envío para una ruta específica (origen → destino). Usa esto cuando el cliente pregunte por tarifas/precios/cuánto cuesta. Soporta AEREO, FCL, LCL y LASTMILE. Si tiene peso/volumen, calcula total estimado. SIEMPRE menciona que es referencial.',
    schema: z.object({
      mode: z.enum(['AEREO', 'FCL', 'LCL', 'LASTMILE']).describe('Modo de transporte'),
      origin: z.string().describe('Origen (ciudad, puerto o aeropuerto). Ej: "Miami", "MIA", "Shanghai", "SHA"'),
      destination: z.string().describe('Destino. Ej: "Santiago", "SCL", "Valparaíso"'),
      weightKg: z.number().optional().describe('Peso real en kg (opcional, para calcular total)'),
      volumeCbm: z.number().optional().describe('Volumen en m³ (opcional)'),
      container: z.enum(['20GP', '40HQ', '40NOR']).optional().describe('Solo FCL: tipo de contenedor'),
      pieces: z.number().optional().describe('Solo FCL: cantidad de contenedores'),
    }),
  },
);

// ============================================================================
// TOOL 2: calculate_chargeable_weight
// ============================================================================

export const calculateChargeableWeight = tool(
  async ({ mode, weightKg, lengthCm, widthCm, heightCm, pieces }): Promise<string> => {
    const qty = pieces && pieces > 0 ? pieces : 1;
    const totalActualWeight = weightKg * qty;

    if (mode === 'AEREO') {
      // Volumétrico aéreo: L*A*A (cm)/6000 = kg, equivalente a 167 kg/m³
      const volPerPiece = (lengthCm * widthCm * heightCm) / 6000;
      const totalVol = volPerPiece * qty;
      const cbmPerPiece = (lengthCm * widthCm * heightCm) / 1_000_000;
      const totalCbm = cbmPerPiece * qty;
      const chargeable = Math.max(totalActualWeight, totalVol);
      const isVolumetric = totalVol > totalActualWeight;
      return JSON.stringify({
        mode: 'AEREO',
        formula: 'Volumétrico = (L × A × A en cm) / 6000 (equivalente a 167 kg/m³)',
        per_piece: {
          dimensions_cm: `${lengthCm} × ${widthCm} × ${heightCm}`,
          actual_weight_kg: weightKg,
          volumetric_weight_kg: +volPerPiece.toFixed(2),
          volume_cbm: +cbmPerPiece.toFixed(4),
        },
        totals: {
          pieces: qty,
          actual_weight_kg: +totalActualWeight.toFixed(2),
          volumetric_weight_kg: +totalVol.toFixed(2),
          volume_cbm: +totalCbm.toFixed(4),
          chargeable_weight_kg: +chargeable.toFixed(2),
          billed_by: isVolumetric ? 'volumen' : 'peso real',
        },
        recommendation: isVolumetric
          ? 'Carga voluminosa: el precio se calcula por peso volumétrico.'
          : 'Carga densa: el precio se calcula por peso real.',
      });
    }

    if (mode === 'OCEAN_LCL') {
      // Marítimo LCL: W/M = max(toneladas, m³); 1 ton = 1 CBM
      const cbmPerPiece = (lengthCm * widthCm * heightCm) / 1_000_000;
      const totalCbm = cbmPerPiece * qty;
      const totalTons = totalActualWeight / 1000;
      const wm = Math.max(totalTons, totalCbm, 1);
      const isVolumetric = totalCbm > totalTons;
      return JSON.stringify({
        mode: 'OCEAN_LCL',
        formula: 'W/M = max(toneladas, m³); mínimo facturable 1 W/M',
        per_piece: {
          dimensions_cm: `${lengthCm} × ${widthCm} × ${heightCm}`,
          weight_kg: weightKg,
          volume_cbm: +cbmPerPiece.toFixed(4),
        },
        totals: {
          pieces: qty,
          weight_kg: +totalActualWeight.toFixed(2),
          weight_tons: +totalTons.toFixed(3),
          volume_cbm: +totalCbm.toFixed(4),
          billable_wm: +wm.toFixed(3),
          billed_by: isVolumetric ? 'volumen (m³)' : (totalTons > totalCbm ? 'peso (toneladas)' : 'mínimo 1 W/M'),
        },
      });
    }

    return JSON.stringify({ error: 'Modo inválido. Usa AEREO o OCEAN_LCL.' });
  },
  {
    name: 'calculate_chargeable_weight',
    description:
      'Calcula el peso facturable (chargeable weight) de una carga. Para aéreo usa factor 167 kg/m³ (L×A×A/6000). Para LCL marítimo usa W/M = max(toneladas, m³) con mínimo 1.',
    schema: z.object({
      mode: z.enum(['AEREO', 'OCEAN_LCL']).describe('Tipo de transporte'),
      weightKg: z.number().describe('Peso real por pieza en kg'),
      lengthCm: z.number().describe('Largo en cm por pieza'),
      widthCm: z.number().describe('Ancho en cm por pieza'),
      heightCm: z.number().describe('Alto en cm por pieza'),
      pieces: z.number().optional().describe('Cantidad de piezas (default 1)'),
    }),
  },
);

// ============================================================================
// TOOL 3: calculate_customs_fees
// ============================================================================

interface ChargeValues {
  honorariosPct: number;
  honorariosMinUF: number;
  gastosDespachoUF: number;
  tramitacionUF: number;
  mensajeriaUF: number;
  ivaAduaneroPct: number;
  derechosPct: number;
}
interface ExchangeRates {
  ufToCLP: number;
  usdToCLP: number;
  eurToCLP: number;
  gbpToCLP: number;
  cadToCLP: number;
  chfToCLP: number;
  sekToCLP: number;
}
interface AduanaConfig { exchangeRates: ExchangeRates; charges: ChargeValues }

async function fetchAduanaConfig(): Promise<AduanaConfig> {
  const ctx = getToolContext();
  const res = await fetch(`${ctx.baseUrl}/api/agencia-aduana/config`);
  if (!res.ok) throw new Error('Aduana config unavailable');
  return res.json() as Promise<AduanaConfig>;
}

function toCLP(amount: number, currency: string, rates: ExchangeRates): number {
  const c = currency.toUpperCase();
  if (c === 'CLP') return amount;
  if (c === 'USD') return amount * rates.usdToCLP;
  if (c === 'EUR') return amount * rates.eurToCLP;
  if (c === 'GBP') return amount * rates.gbpToCLP;
  if (c === 'CAD') return amount * rates.cadToCLP;
  if (c === 'CHF') return amount * rates.chfToCLP;
  if (c === 'SEK') return amount * rates.sekToCLP;
  return amount * rates.usdToCLP; // fallback
}

export const calculateCustomsFees = tool(
  async ({ cifValue, currency, includeIvaAndDerechos }): Promise<string> => {
    try {
      const cfg = await fetchAduanaConfig();
      const cifCLP = toCLP(cifValue, currency, cfg.exchangeRates);

      // Honorarios = max(CIF * pct%, mínimo en UF)
      const honorariosPct = (cifCLP * cfg.charges.honorariosPct) / 100;
      const honorariosMin = cfg.charges.honorariosMinUF * cfg.exchangeRates.ufToCLP;
      const honorarios = Math.max(honorariosPct, honorariosMin);

      const gastosDespacho = cfg.charges.gastosDespachoUF * cfg.exchangeRates.ufToCLP;
      const tramitacion = cfg.charges.tramitacionUF * cfg.exchangeRates.ufToCLP;
      const mensajeria = cfg.charges.mensajeriaUF * cfg.exchangeRates.ufToCLP;

      const subtotalAgencia = honorarios + gastosDespacho + tramitacion + mensajeria;

      const result: Record<string, unknown> = {
        cif_input: { amount: cifValue, currency, equivalent_clp: Math.round(cifCLP) },
        agencia_aduana: {
          honorarios_clp: Math.round(honorarios),
          gastos_despacho_clp: Math.round(gastosDespacho),
          tramitacion_clp: Math.round(tramitacion),
          mensajeria_clp: Math.round(mensajeria),
          subtotal_clp: Math.round(subtotalAgencia),
        },
        exchange_rates: {
          uf_to_clp: cfg.exchangeRates.ufToCLP,
          [`${currency.toLowerCase()}_to_clp`]: currency.toUpperCase() === 'CLP' ? 1 : (cifCLP / cifValue),
        },
      };

      if (includeIvaAndDerechos) {
        const derechos = (cifCLP * cfg.charges.derechosPct) / 100;
        const baseIva = cifCLP + derechos;
        const iva = (baseIva * cfg.charges.ivaAduaneroPct) / 100;
        const totalImpuestos = derechos + iva;
        result.impuestos_aduaneros = {
          derechos_clp: Math.round(derechos),
          iva_aduanero_clp: Math.round(iva),
          subtotal_impuestos_clp: Math.round(totalImpuestos),
          note: `Derechos ${cfg.charges.derechosPct}% sobre CIF; IVA ${cfg.charges.ivaAduaneroPct}% sobre (CIF + Derechos). NO aplica si el producto está exento o tiene tratado de libre comercio.`,
        };
        result.total_estimado_clp = Math.round(subtotalAgencia + totalImpuestos);
      }

      result.disclaimer = 'Estimación basada en tasas de cambio del portal. Productos con TLC, exenciones o regímenes especiales pueden tener tratamiento distinto.';
      return JSON.stringify(result);
    } catch (e) {
      return JSON.stringify({ error: 'No pude obtener la configuración', details: (e as Error).message });
    }
  },
  {
    name: 'calculate_customs_fees',
    description:
      'Calcula los gastos de agencia de aduanas en Chile (honorarios, despacho, tramitación, mensajería) y opcionalmente impuestos (Derechos 6%, IVA aduanero 19%). Requiere valor CIF y moneda.',
    schema: z.object({
      cifValue: z.number().describe('Valor CIF de la mercancía'),
      currency: z.string().describe('Moneda del CIF: USD, EUR, CLP, GBP, CAD, CHF, SEK'),
      includeIvaAndDerechos: z.boolean().optional().describe('Si true, agrega Derechos 6% e IVA aduanero 19% (default true)'),
    }),
  },
);

// ============================================================================
// TOOL 4: compare_transport_modes
// ============================================================================

export const compareTransportModes = tool(
  async ({ origin, destination, weightKg, volumeCbm }): Promise<string> => {
    try {
      const w = Math.max(weightKg || 0, 0);
      const v = Math.max(volumeCbm || 0, 0);

      const [air, fcl, lcl] = await Promise.all([
        getAirRates().catch(() => []),
        getFclRates().catch(() => []),
        getLclRates().catch(() => []),
      ]);

      const airMatch = air.find((r) => matchRoute(r.origin, origin) && matchRoute(r.destination, destination));
      const fclMatch = fcl.find((r) => matchRoute(r.pol, origin) && matchRoute(r.pod, destination));
      const lclMatch = lcl.find((r) => matchRoute(r.pol, origin) && matchRoute(r.pod, destination));

      const options: Record<string, unknown>[] = [];

      if (airMatch) {
        const chargeable = Math.max(w, v * 167);
        let perKg = 0;
        if (chargeable >= 1000) perKg = airMatch.kg1000;
        else if (chargeable >= 500) perKg = airMatch.kg500;
        else if (chargeable >= 300) perKg = airMatch.kg300;
        else if (chargeable >= 100) perKg = airMatch.kg100;
        else perKg = airMatch.kg45;
        const total = perKg * MARKUP_AIR_FCL * chargeable;
        options.push({
          mode: 'AEREO',
          carrier: airMatch.carrier,
          transit: airMatch.transitTime,
          chargeable_weight: `${fmt(chargeable)} kg`,
          estimated_total: `${airMatch.currency} ${fmt(total)}`,
          best_for: 'Cargas urgentes, alto valor, < 500 kg',
        });
      }

      if (lclMatch && (w > 0 || v > 0)) {
        const wm = Math.max(w / 1000, v, 1);
        const total = lclMatch.ofWM * MARKUP_LCL * wm;
        options.push({
          mode: 'LCL',
          carrier: lclMatch.operador || lclMatch.agente,
          transit: lclMatch.transitTime,
          billable_wm: `${fmt(wm)} W/M`,
          estimated_total: `${lclMatch.currency} ${fmt(total)}`,
          best_for: 'Cargas medianas (1-15 m³), no urgentes',
        });
      }

      if (fclMatch) {
        const opt: Record<string, unknown> = {
          mode: 'FCL',
          carrier: fclMatch.carrier,
          transit: fclMatch.transitTime,
          best_for: 'Cargas grandes (>15 m³ o >10 ton), mejor costo por unidad',
        };
        if (fclMatch.gp20 > 0) opt['20GP'] = `${fclMatch.currency} ${fmt(fclMatch.gp20 * MARKUP_AIR_FCL)}`;
        if (fclMatch.hq40 > 0) opt['40HQ'] = `${fclMatch.currency} ${fmt(fclMatch.hq40 * MARKUP_AIR_FCL)}`;
        options.push(opt);
      }

      if (options.length === 0) {
        return JSON.stringify({
          found: false,
          message: `No encontré rutas ${origin} → ${destination} en ningún modo. Verifica nombres o pide cotización en /newquotes.`,
        });
      }

      // Recomendación heurística simple
      let recommendation = '';
      if (w > 0 || v > 0) {
        const cbm = v || (w / 167);
        if (cbm < 2 && w < 500) recommendation = 'AEREO recomendado por tránsito y costo total competitivo a bajo volumen.';
        else if (cbm >= 15 || w >= 10000) recommendation = 'FCL recomendado: mejor costo unitario para cargas grandes.';
        else recommendation = 'LCL recomendado: balance costo/tránsito para cargas medianas.';
      }

      return JSON.stringify({
        found: true,
        origin,
        destination,
        cargo: { weightKg: w || null, volumeCbm: v || null },
        options,
        recommendation,
        disclaimer: PRICE_DISCLAIMER,
      });
    } catch (e) {
      return JSON.stringify({ error: 'Error en comparación', details: (e as Error).message });
    }
  },
  {
    name: 'compare_transport_modes',
    description:
      'Compara opciones AÉREO vs LCL vs FCL para una misma ruta. Útil cuando el cliente no sabe qué modo usar. Requiere origen, destino y al menos peso o volumen.',
    schema: z.object({
      origin: z.string().describe('Origen'),
      destination: z.string().describe('Destino'),
      weightKg: z.number().optional().describe('Peso total en kg'),
      volumeCbm: z.number().optional().describe('Volumen total en m³'),
    }),
  },
);

// ============================================================================
// TOOL 5: find_shipment_by_number
// ============================================================================

export const findShipmentByNumber = tool(
  async ({ number }): Promise<string> => {
    const q = number.trim();
    const results: Record<string, unknown>[] = [];

    // ShipsGo air
    try {
      const air = await shipsgoFetch('/shipments') as Record<string, unknown>[];
      for (const s of (Array.isArray(air) ? air : [])) {
        const ref = String(s.reference || '').toLowerCase();
        const ctxName = getToolContext().activeUsername.toLowerCase();
        if (ref !== ctxName) continue;
        const awb = String(s.awb_number || '');
        if (awb.includes(q) || awb.replace(/\D/g, '').includes(q.replace(/\D/g, ''))) {
          const route = s.route as Record<string, unknown> | undefined;
          results.push({
            source: 'ShipsGo (aéreo en tiempo real)',
            type: 'AIR',
            awb,
            airline: s.airline || 'N/D',
            status: s.status || 'N/D',
            origin: route?.origin || 'N/D',
            destination: route?.destination || 'N/D',
            progress: route?.transit_percentage != null ? `${route.transit_percentage}%` : 'N/D',
          });
        }
      }
    } catch { /* ignore */ }

    // ShipsGo ocean
    try {
      const ocean = await shipsgoFetch('/ocean/shipments') as Record<string, unknown>[];
      for (const s of (Array.isArray(ocean) ? ocean : [])) {
        const ref = String(s.reference || '').toLowerCase();
        const ctxName = getToolContext().activeUsername.toLowerCase();
        if (ref !== ctxName) continue;
        const cn = String(s.container_number || '');
        const bk = String(s.booking_number || '');
        if (cn.includes(q) || bk.includes(q)) {
          const route = s.route as Record<string, unknown> | undefined;
          const carrier = s.carrier as Record<string, unknown> | string | undefined;
          results.push({
            source: 'ShipsGo (marítimo en tiempo real)',
            type: 'OCEAN',
            container: cn || 'N/D',
            booking: bk || 'N/D',
            carrier: typeof carrier === 'object' ? carrier?.name || 'N/D' : carrier || 'N/D',
            status: s.status || 'N/D',
            origin: route?.port_of_loading || 'N/D',
            destination: route?.port_of_discharge || 'N/D',
            progress: route?.transit_percentage != null ? `${route.transit_percentage}%` : 'N/D',
          });
        }
      }
    } catch { /* ignore */ }

    if (results.length === 0) {
      return JSON.stringify({
        found: false,
        message: `No encontré envíos asociados a "${q}".`,
        suggestion: 'Verifica el número o crea un nuevo tracking en /new-tracking (aéreo) o /new-ocean-tracking (marítimo).',
      });
    }

    return JSON.stringify({ found: true, count: results.length, shipments: results.slice(0, 5) });
  },
  {
    name: 'find_shipment_by_number',
    description:
      'Busca un envío por su número (AWB, contenedor, booking o referencia). Útil cuando el cliente da un número específico.',
    schema: z.object({
      number: z.string().describe('Número de AWB, contenedor o booking. Ej: "176-12345678" o "MSCU1234567"'),
    }),
  },
);

// ============================================================================
// TOOL 6: get_finance_summary
// ============================================================================

export const getFinanceSummary = tool(
  async (): Promise<string> => {
    try {
      const ctx = getToolContext();
      const params = new URLSearchParams({
        ConsigneeName: ctx.activeUsername,
        Page: '1',
        ItemsPerPage: '50',
        SortBy: 'newest',
      });
      const data = await linbisFetch(`/invoices?${params}`);
      const invoices = extractItems(data);

      if (invoices.length === 0) {
        return JSON.stringify({ found: false, message: 'No hay facturas registradas.' });
      }

      const today = new Date();
      const totalsByCurrency: Record<string, { total: number; pending: number; overdue: number; count: number }> = {};
      let totalCount = 0, pendingCount = 0, overdueCount = 0;
      let nextDue: { number: string; dueDate: string; balance: string; currency: string } | null = null;
      let nextDueTime = Infinity;

      for (const inv of invoices) {
        totalCount++;
        const cur = ((inv.currency as Record<string, unknown> | undefined)?.abbr as string) || 'USD';
        const amt = inv.totalAmount as Record<string, unknown> | undefined;
        const bal = inv.balanceDue as Record<string, unknown> | undefined;
        const totalNum = +(amt?.value || 0);
        const balNum = +(bal?.value || 0);
        const dueRaw = String(inv.dueDate || '');
        const dueDate = dueRaw ? new Date(dueRaw) : null;
        const status = String(inv.status || '').toLowerCase();

        if (!totalsByCurrency[cur]) totalsByCurrency[cur] = { total: 0, pending: 0, overdue: 0, count: 0 };
        totalsByCurrency[cur].total += totalNum;
        totalsByCurrency[cur].count++;

        const isPaid = status.includes('paid') || balNum === 0;
        if (!isPaid) {
          pendingCount++;
          totalsByCurrency[cur].pending += balNum;
          if (dueDate && dueDate < today) {
            overdueCount++;
            totalsByCurrency[cur].overdue += balNum;
          } else if (dueDate && dueDate.getTime() < nextDueTime) {
            nextDueTime = dueDate.getTime();
            nextDue = {
              number: String(inv.number || 'N/D'),
              dueDate: dueRaw,
              balance: `${cur} ${fmt(balNum)}`,
              currency: cur,
            };
          }
        }
      }

      return JSON.stringify({
        found: true,
        summary: {
          total_invoices: totalCount,
          pending_count: pendingCount,
          overdue_count: overdueCount,
        },
        balances_by_currency: Object.entries(totalsByCurrency).map(([cur, t]) => ({
          currency: cur,
          total_invoiced: fmt(t.total),
          pending_balance: fmt(t.pending),
          overdue_balance: fmt(t.overdue),
        })),
        next_due: nextDue,
        link: 'Detalle completo en /financiera',
      });
    } catch (e) {
      return JSON.stringify({ error: 'No pude obtener facturas', details: (e as Error).message });
    }
  },
  {
    name: 'get_finance_summary',
    description:
      'Resumen financiero del cliente: total facturado, balance pendiente, facturas vencidas y próxima a vencer. Agrupado por moneda.',
    schema: z.object({}),
  },
);

// ============================================================================
// TOOL 7: get_documents_for_shipment
// ============================================================================

export const getDocumentsForShipment = tool(
  async ({ shipmentNumber }): Promise<string> => {
    try {
      const ctx = getToolContext();
      const res = await fetch(`${ctx.baseUrl}/api/documents/all`, {
        headers: { Authorization: `Bearer ${ctx.userToken}` },
      });
      if (!res.ok) return JSON.stringify({ error: `Documents endpoint ${res.status}` });
      const data = await res.json();
      const docs = extractItems(data);
      const filtered = docs.filter((d) => {
        const parent = String(d.parentNumber || d.shipmentNumber || d.reference || '').toLowerCase();
        return parent.includes(shipmentNumber.toLowerCase());
      });
      if (filtered.length === 0) {
        return JSON.stringify({ found: false, message: `No hay documentos asociados a "${shipmentNumber}".` });
      }
      const top = filtered.slice(0, 10).map((d) => ({
        type: d.type || d.documentType || 'documento',
        name: d.fileName || d.name || 'N/D',
        uploadedAt: d.createdAt || d.uploadedAt || 'N/D',
      }));
      return JSON.stringify({
        found: true,
        shipment: shipmentNumber,
        count: filtered.length,
        documents: top,
        link: `Ver y descargar en /air-shipments, /ocean-shipments o /ground-shipments según corresponda.`,
      });
    } catch (e) {
      return JSON.stringify({ error: 'Error consultando documentos', details: (e as Error).message });
    }
  },
  {
    name: 'get_documents_for_shipment',
    description:
      'Lista los documentos (BL, factura comercial, packing list, etc.) asociados a una operación o envío específico.',
    schema: z.object({
      shipmentNumber: z.string().describe('Número de operación, AWB, contenedor o booking'),
    }),
  },
);

// ============================================================================
// TOOL 8: explain_incoterm
// ============================================================================

export const explainIncoterm = tool(
  async ({ code }): Promise<string> => {
    if (!code) {
      const list = INCOTERMS_2020.map((i) => `${i.code} (${i.spanish})`).join(', ');
      return JSON.stringify({
        message: 'Incoterms 2020 disponibles. Pregúntame por uno específico.',
        list,
      });
    }
    const inc = findIncoterm(code);
    if (!inc) {
      return JSON.stringify({ found: false, message: `No reconozco "${code}" como un Incoterm 2020.` });
    }
    return JSON.stringify({
      found: true,
      code: inc.code,
      name: `${inc.name} / ${inc.spanish}`,
      modes: inc.modes,
      risk_transfer: inc.riskTransfer,
      seller_pays: inc.costsBy.seller,
      buyer_pays: inc.costsBy.buyer,
      insurance: inc.insurance === 'seller' ? 'Vendedor (obligatorio)' : inc.insurance === 'buyer' ? 'Comprador' : 'Opcional',
      customs_export: inc.customs.export === 'seller' ? 'Vendedor' : 'Comprador',
      customs_import: inc.customs.import === 'seller' ? 'Vendedor' : 'Comprador',
      best_for: inc.bestFor,
      warning: inc.warning,
    });
  },
  {
    name: 'explain_incoterm',
    description:
      'Explica un Incoterm 2020 en detalle: responsabilidades, riesgos, costos por etapa, seguro y aduanas. Si el código está vacío, lista todos los disponibles.',
    schema: z.object({
      code: z.string().optional().describe('Código del incoterm (EXW, FCA, CPT, CIP, DAP, DPU, DDP, FAS, FOB, CFR, CIF). Vacío para listar todos.'),
    }),
  },
);

// ============================================================================
// TOOL 9: get_location_info
// ============================================================================

export const getLocationInfo = tool(
  async ({ query, type }): Promise<string> => {
    if (type === 'port') {
      const p = findPort(query);
      if (!p) return JSON.stringify({ found: false, message: `No encontré el puerto "${query}".` });
      return JSON.stringify({ found: true, type: 'port', ...p });
    }
    if (type === 'airport') {
      const a = findAirport(query);
      if (!a) return JSON.stringify({ found: false, message: `No encontré el aeropuerto "${query}".` });
      return JSON.stringify({ found: true, type: 'airport', ...a });
    }
    const loc = findLocation(query);
    if (!loc) {
      return JSON.stringify({ found: false, message: `No tengo "${query}" en mi base. Cubro principalmente Américas, Europa y Asia.` });
    }
    return JSON.stringify({ found: true, type: loc.type, ...loc.data });
  },
  {
    name: 'get_location_info',
    description:
      'Obtiene info de un puerto o aeropuerto: código (UNLOCODE/IATA), nombre completo, ciudad, país, coordenadas. Acepta código o nombre de ciudad.',
    schema: z.object({
      query: z.string().describe('Código o nombre. Ej: "MIA", "Miami", "CNSHA", "Shanghai"'),
      type: z.enum(['port', 'airport', 'auto']).optional().describe('Tipo (default auto detecta)'),
    }),
  },
);

// ============================================================================
// TOOL 10: get_my_dashboard
// ============================================================================

export const getMyDashboard = tool(
  async (): Promise<string> => {
    const ctx = getToolContext();
    const out: Record<string, unknown> = { customer: ctx.activeUsername };

    // Cotizaciones recientes
    try {
      const params = new URLSearchParams({
        ConsigneeName: ctx.activeUsername,
        Page: '1',
        ItemsPerPage: '3',
        SortBy: 'newest',
      });
      const data = await linbisFetch(`/Quotes?${params}`);
      const items = extractItems(data);
      out.recent_quotes = {
        count: items.length,
        items: items.slice(0, 3).map((q) => ({
          number: q.number || 'N/D',
          date: q.date || 'N/D',
          route: `${q.origin || '?'} → ${q.destination || '?'}`,
          status: q.currentFlow || 'N/D',
        })),
      };
    } catch { out.recent_quotes = { error: 'no disponible' }; }

    // Trackings activos (resumen)
    try {
      const air = await shipsgoFetch('/shipments') as Record<string, unknown>[];
      const ocean = await shipsgoFetch('/ocean/shipments') as Record<string, unknown>[];
      const ctxName = ctx.activeUsername.toLowerCase();
      const airFiltered = (Array.isArray(air) ? air : []).filter((s) => String(s.reference || '').toLowerCase() === ctxName);
      const oceanFiltered = (Array.isArray(ocean) ? ocean : []).filter((s) => String(s.reference || '').toLowerCase() === ctxName);
      out.active_trackings = {
        air_count: airFiltered.length,
        ocean_count: oceanFiltered.length,
        total: airFiltered.length + oceanFiltered.length,
      };
    } catch { out.active_trackings = { error: 'no disponible' }; }

    // Facturas pendientes (resumen)
    try {
      const params = new URLSearchParams({
        ConsigneeName: ctx.activeUsername,
        Page: '1',
        ItemsPerPage: '50',
      });
      const data = await linbisFetch(`/invoices?${params}`);
      const invs = extractItems(data);
      let pending = 0;
      let overdue = 0;
      const today = new Date();
      for (const inv of invs) {
        const bal = inv.balanceDue as Record<string, unknown> | undefined;
        const balNum = +(bal?.value || 0);
        if (balNum > 0) {
          pending++;
          const due = inv.dueDate ? new Date(String(inv.dueDate)) : null;
          if (due && due < today) overdue++;
        }
      }
      out.invoices = { pending, overdue };
    } catch { out.invoices = { error: 'no disponible' }; }

    out.ejecutivo = ctx.ejecutivo
      ? { nombre: ctx.ejecutivo.nombre, email: ctx.ejecutivo.email, telefono: ctx.ejecutivo.telefono }
      : null;

    out.tip = 'Pregúntame por cualquier sección para más detalle.';
    return JSON.stringify(out);
  },
  {
    name: 'get_my_dashboard',
    description:
      'Resumen tipo dashboard: cotizaciones recientes, trackings activos, facturas pendientes y ejecutivo. Útil cuando el cliente saluda o pregunta "dame un resumen", "cómo estoy", "qué tengo pendiente".',
    schema: z.object({}),
  },
);

// ============================================================================
// TOOL 11: get_rates_expiring_soon
// ============================================================================

export const getRatesExpiringSoon = tool(
  async ({ daysWindow, mode, origin, destination }): Promise<string> => {
    const window = daysWindow ?? 7;
    const out: { mode: string; route: string; carrier: string; validUntil: string; daysLeft: number }[] = [];

    async function scan(rates: { origin?: string; destination?: string; pol?: string; pod?: string; carrier?: string; operador?: string; agente?: string; validUntil: string }[], modeName: string) {
      for (const r of rates) {
        const o = r.origin || r.pol || '';
        const d = r.destination || r.pod || '';
        if (origin && !matchRoute(o, origin)) continue;
        if (destination && !matchRoute(d, destination)) continue;
        const dt = parseValidUntil(r.validUntil);
        if (!dt) continue;
        const left = daysUntil(dt);
        if (left >= 0 && left <= window) {
          out.push({
            mode: modeName,
            route: `${o} → ${d}`,
            carrier: r.carrier || r.operador || r.agente || 'N/D',
            validUntil: r.validUntil,
            daysLeft: left,
          });
        }
      }
    }

    try {
      if (!mode || mode === 'AEREO') await scan(await getAirRates(), 'AEREO');
      if (!mode || mode === 'FCL') await scan(await getFclRates(), 'FCL');
      if (!mode || mode === 'LCL') await scan(await getLclRates(), 'LCL');
    } catch { /* ignore */ }

    out.sort((a, b) => a.daysLeft - b.daysLeft);

    if (out.length === 0) {
      return JSON.stringify({
        found: false,
        message: `No hay tarifas que venzan en los próximos ${window} días${origin || destination ? ' para esa ruta' : ''}.`,
      });
    }

    return JSON.stringify({
      found: true,
      window_days: window,
      total: out.length,
      showing: Math.min(out.length, 10),
      expiring: out.slice(0, 10),
      tip: 'Aprovecha de cotizar antes que venzan: /newquotes',
    });
  },
  {
    name: 'get_rates_expiring_soon',
    description:
      'Muestra tarifas próximas a vencer dentro de un rango de días (default 7). Útil para el cliente que cotiza frecuentemente una ruta. Puede filtrarse por modo o ruta.',
    schema: z.object({
      daysWindow: z.number().optional().describe('Ventana en días (default 7)'),
      mode: z.enum(['AEREO', 'FCL', 'LCL']).optional().describe('Filtrar por modo'),
      origin: z.string().optional().describe('Filtrar por origen'),
      destination: z.string().optional().describe('Filtrar por destino'),
    }),
  },
);

// ============================================================================
// EXPORT
// ============================================================================

export const EXTRA_TOOLS = [
  getRateEstimate,
  calculateChargeableWeight,
  calculateCustomsFees,
  compareTransportModes,
  findShipmentByNumber,
  getFinanceSummary,
  getDocumentsForShipment,
  explainIncoterm,
  getLocationInfo,
  getMyDashboard,
  getRatesExpiringSoon,
];
