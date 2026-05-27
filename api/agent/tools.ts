// api/agent/tools.ts
// Herramientas robustas para el AI Agent de Seemann Group.
// Cada tool retorna datos MÍNIMOS y concretos para evitar gastar tokens.

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { CLIENT_NAVIGATION, COMPANY_INFO, findPortalSection, findGlossaryTerm } from './knowledgeBase.js';
import { EXTRA_TOOLS } from './toolsExtra.js';
import { getToolContext, setToolContext, type ToolContext } from './toolsContext.js';

// Re-export para compatibilidad con graph.ts
export { setToolContext };
export type { ToolContext };

// Helper local para acceder al contexto en este archivo.
const _ctx: ToolContext = new Proxy({} as ToolContext, {
  get(_t, prop) { return (getToolContext() as unknown as Record<string, unknown>)[prop as string]; },
});

// ============================================================================
// HELPERS
// ============================================================================

const LINBIS_API = 'https://api.linbis.com';

async function linbisFetch(path: string): Promise<unknown> {
  const res = await fetch(`${LINBIS_API}${path}`, {
    headers: {
      Authorization: `Bearer ${_ctx.linbisAccessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Linbis ${res.status}`);
  return res.json();
}

async function shipsgoFetch(path: string): Promise<unknown> {
  const res = await fetch(`${_ctx.baseUrl}/api/shipsgo${path}`, {
    headers: {
      Authorization: `Bearer ${_ctx.userToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`ShipsGo ${res.status}`);
  return res.json();
}

function extractItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

// ============================================================================
// GOOGLE SHEETS URLs (rutas para cotizar)
// ============================================================================

const SHEET_URLS: Record<string, string> = {
  AEREO: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWBXW_l3kB2V0A9D732Le0AjyGnXDjgV8nasTz1Z3gWUbCklXKICxTE4kEMjYMoaTG4v78XB2aVrHe/pub?output=csv',
  FCL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?output=csv',
  LCL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT5T29WmDAI_z4RxlPtY3GoB3pm7NyBBiWZGc06cYRR1hg5fdFx7VEr3-i2geKxgw/pub?output=csv',
};

function parseCSV(csvText: string): string[][] {
  const lines = csvText.split('\n');
  const result: string[][] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const row: string[] = [];
    let field = '';
    let inQ = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (inQ && line[j + 1] === '"') { field += '"'; j++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { row.push(field.trim()); field = ''; }
      else field += c;
    }
    row.push(field.trim());
    result.push(row);
  }
  return result;
}

// ============================================================================
// TOOLS — cada tool es una función LangChain con schema Zod
// ============================================================================

// 1. Buscar cotizaciones (Linbis) — MÁXIMO 3 resultados
export const searchQuotes = tool(
  async ({ quoteNumber }): Promise<string> => {
    // La API de Linbis no soporta filtro por número — siempre traemos todos
    // y filtramos en el cliente. Traemos hasta 100 para cubrir historiales largos.
    const itemsPerPage = quoteNumber ? '100' : '5';
    const params = new URLSearchParams({
      ConsigneeName: _ctx.activeUsername,
      Page: '1',
      ItemsPerPage: itemsPerPage,
      SortBy: 'newest',
    });

    const data = await linbisFetch(`/Quotes?${params}`);
    let items = extractItems(data);
    if (items.length === 0) return JSON.stringify({ found: false, message: 'No se encontraron cotizaciones.' });

    // Filtro client-side por número si se proporcionó
    if (quoteNumber) {
      const q = quoteNumber.trim().toLowerCase();
      const match = items.find((item) => String(item.number || '').toLowerCase() === q);
      if (match) {
        return JSON.stringify({
          found: true,
          count: 1,
          quotes: [{
            number: match.number || 'N/A',
            date: match.date || 'N/A',
            origin: match.origin || 'N/A',
            destination: match.destination || 'N/A',
            mode: match.modeOfTransportation || 'N/A',
            status: match.currentFlow || 'N/A',
            total: match.totalCharge_IncomeDisplayValue || 'N/A',
          }],
        });
      }
      // Si no se encontró en las últimas 100, avisar
      return JSON.stringify({
        found: false,
        message: `No se encontró la cotización "${quoteNumber}" entre las 100 más recientes. Verifica el número o búscala en /quotes.`,
      });
    }

    // Sin filtro: devolver las 3 más recientes
    const top = items.slice(0, 3).map((q) => ({
      number: q.number || 'N/A',
      date: q.date || 'N/A',
      origin: q.origin || 'N/A',
      destination: q.destination || 'N/A',
      mode: q.modeOfTransportation || 'N/A',
      status: q.currentFlow || 'N/A',
      total: q.totalCharge_IncomeDisplayValue || 'N/A',
    }));

    return JSON.stringify({ found: true, count: items.length, showing: top.length, quotes: top, hint: items.length > 3 ? `Hay ${items.length} cotizaciones en total. Ver todas en /quotes.` : undefined });
  },
  {
    name: 'search_quotes',
    description: 'Busca cotizaciones del cliente en Linbis. Si se da un quoteNumber específico, lo busca entre las 100 más recientes. Sin número, muestra las 3 más recientes.',
    schema: z.object({
      quoteNumber: z.string().optional().describe('Número de cotización específica a buscar (ej: "QUO0019716")'),
    }),
  },
);

// 2. Buscar envíos aéreos Linbis
export const searchAirShipments = tool(
  async (): Promise<string> => {
    const params = new URLSearchParams({
      ConsigneeName: _ctx.activeUsername,
      Page: '1',
      ItemsPerPage: '5',
      SortBy: 'newest',
    });
    const data = await linbisFetch(`/air-shipments?${params}`);
    const items = extractItems(data);
    if (items.length === 0) return JSON.stringify({ found: false, message: 'No se encontraron operaciones aéreas.' });

    const top = items.slice(0, 3).map((s) => ({
      number: s.number || 'N/A',
      awb: s.waybillNumber || 'N/A',
      origin: s.origin || s.departure || 'N/A',
      destination: s.destination || s.arrival || 'N/A',
      status: s.currentFlow || 'N/A',
      carrier: s.carrierBroker || 'N/A',
    }));

    return JSON.stringify({ found: true, count: items.length, showing: top.length, shipments: top, hint: items.length > 3 ? `Hay ${items.length} operaciones aéreas. Ver todas en /air-shipments.` : undefined });
  },
  {
    name: 'search_air_shipments',
    description: 'Busca operaciones/envíos aéreos del cliente en Linbis (datos de la operación, NO tracking en tiempo real). Máximo 3 resultados.',
    schema: z.object({}),
  },
);

// 3. Buscar envíos marítimos Linbis
export const searchOceanShipments = tool(
  async (): Promise<string> => {
    const data = await linbisFetch('/ocean-shipments/all');
    const all = extractItems(data);
    const items = all.filter((s) => {
      const c = s.consignee as Record<string, unknown> | string | undefined;
      const name = (typeof c === 'object' && c !== null ? String(c.name || '') : String(c || '')).toLowerCase();
      return name.includes(_ctx.activeUsername.toLowerCase());
    });
    if (items.length === 0) return JSON.stringify({ found: false, message: 'No se encontraron operaciones marítimas.' });

    const top = items.slice(0, 3).map((s) => ({
      number: s.number || 'N/A',
      origin: s.origin || s.departure || 'N/A',
      destination: s.destination || s.arrival || 'N/A',
      status: s.currentFlow || 'N/A',
      vessel: s.vessel || 'N/A',
      carrier: s.carrierBroker || 'N/A',
    }));

    return JSON.stringify({ found: true, count: items.length, showing: top.length, shipments: top, hint: items.length > 3 ? `Hay ${items.length} operaciones marítimas. Ver todas en /ocean-shipments.` : undefined });
  },
  {
    name: 'search_ocean_shipments',
    description: 'Busca operaciones/envíos marítimos del cliente en Linbis. Máximo 3 resultados.',
    schema: z.object({}),
  },
);

// 4. Buscar envíos terrestres Linbis
export const searchGroundShipments = tool(
  async (): Promise<string> => {
    const data = await linbisFetch('/ground-shipments/all');
    const all = extractItems(data);
    const items = all.filter((s) => {
      const c = s.consignee as Record<string, unknown> | string | undefined;
      const name = (typeof c === 'object' && c !== null ? String(c.name || '') : String(c || '')).toLowerCase();
      return name.includes(_ctx.activeUsername.toLowerCase());
    });
    if (items.length === 0) return JSON.stringify({ found: false, message: 'No se encontraron operaciones terrestres.' });

    const top = items.slice(0, 3).map((s) => ({
      number: s.number || 'N/A',
      origin: s.origin || s.departure || 'N/A',
      destination: s.destination || s.arrival || 'N/A',
      status: s.currentFlow || 'N/A',
      carrier: s.carrierBroker || 'N/A',
    }));

    return JSON.stringify({ found: true, count: items.length, showing: top.length, shipments: top, hint: items.length > 3 ? `Hay ${items.length} operaciones terrestres. Ver todas en /ground-shipments.` : undefined });
  },
  {
    name: 'search_ground_shipments',
    description: 'Busca operaciones/envíos terrestres del cliente en Linbis. Máximo 3 resultados.',
    schema: z.object({}),
  },
);

// 5. Buscar facturas Linbis
export const searchInvoices = tool(
  async ({ invoiceNumber }): Promise<string> => {
    const params = new URLSearchParams({
      ConsigneeName: _ctx.activeUsername,
      Page: '1',
      ItemsPerPage: '5',
      SortBy: 'newest',
    });
    if (invoiceNumber) params.set('Number', invoiceNumber);

    const data = await linbisFetch(`/invoices?${params}`);
    const items = extractItems(data);
    if (items.length === 0) return JSON.stringify({ found: false, message: 'No se encontraron facturas.' });

    const top = items.slice(0, 3).map((inv) => {
      const cur = inv.currency as Record<string, unknown> | undefined;
      const amt = inv.totalAmount as Record<string, unknown> | undefined;
      const bal = inv.balanceDue as Record<string, unknown> | undefined;
      return {
        number: inv.number || 'N/A',
        date: inv.date || 'N/A',
        dueDate: inv.dueDate || 'N/A',
        status: inv.status || 'N/A',
        currency: cur?.abbr || 'N/A',
        amount: amt?.userString || amt?.value || 'N/A',
        balance: bal?.userString || bal?.value || 'N/A',
      };
    });

    return JSON.stringify({ found: true, count: items.length, showing: top.length, invoices: top, hint: items.length > 3 ? `Hay ${items.length} facturas. Ver reporte completo en /financiera.` : undefined });
  },
  {
    name: 'search_invoices',
    description: 'Busca facturas del cliente en Linbis. Máximo 3 resultados.',
    schema: z.object({
      invoiceNumber: z.string().optional().describe('Número de factura específica'),
    }),
  },
);

// 6. Rastreos ShipsGo — rastreos REALES en tiempo real (aéreos y marítimos)
export const getShipsgoTrackings = tool(
  async ({ type }): Promise<string> => {
    interface ShipsGoItem {
      id?: string | number;
      awb_number?: string;
      container_number?: string;
      booking_number?: string;
      reference?: string;
      status?: string;
      airline?: string;
      carrier?: string | { name?: string };
      route?: {
        origin?: string;
        destination?: string;
        port_of_loading?: string;
        port_of_discharge?: string;
        transit_percentage?: number;
      };
      tags?: string[];
    }

    const results: { air: ShipsGoItem[]; ocean: ShipsGoItem[] } = { air: [], ocean: [] };

    if (type === 'air' || type === 'all') {
      try {
        const data = await shipsgoFetch('/shipments') as ShipsGoItem[];
        const filtered = (Array.isArray(data) ? data : []).filter((s) =>
          String(s.reference || '').toLowerCase() === _ctx.activeUsername.toLowerCase()
        );
        results.air = filtered;
      } catch { /* ShipsGo unavailable */ }
    }

    if (type === 'ocean' || type === 'all') {
      try {
        const data = await shipsgoFetch('/ocean/shipments') as ShipsGoItem[];
        const filtered = (Array.isArray(data) ? data : []).filter((s) =>
          String(s.reference || '').toLowerCase() === _ctx.activeUsername.toLowerCase()
        );
        results.ocean = filtered;
      } catch { /* ShipsGo unavailable */ }
    }

    const airSummary = results.air.slice(0, 3).map((s) => ({
      awb: s.awb_number || 'N/A',
      status: s.status || 'N/A',
      airline: s.airline || 'N/A',
      origin: s.route?.origin || 'N/A',
      destination: s.route?.destination || 'N/A',
      progress: s.route?.transit_percentage != null ? `${s.route.transit_percentage}%` : 'N/A',
    }));

    const oceanSummary = results.ocean.slice(0, 3).map((s) => ({
      container: s.container_number || s.booking_number || 'N/A',
      status: s.status || 'N/A',
      carrier: typeof s.carrier === 'object' ? s.carrier?.name || 'N/A' : s.carrier || 'N/A',
      origin: s.route?.port_of_loading || 'N/A',
      destination: s.route?.port_of_discharge || 'N/A',
      progress: s.route?.transit_percentage != null ? `${s.route.transit_percentage}%` : 'N/A',
    }));

    const totalAir = results.air.length;
    const totalOcean = results.ocean.length;

    if (totalAir === 0 && totalOcean === 0) {
      return JSON.stringify({ found: false, message: 'No se encontraron rastreos activos. Puedes crear uno en /new-tracking (aéreo) o /new-ocean-tracking (marítimo).' });
    }

    return JSON.stringify({
      found: true,
      air: { total: totalAir, showing: airSummary.length, trackings: airSummary },
      ocean: { total: totalOcean, showing: oceanSummary.length, trackings: oceanSummary },
      hint: 'Ver todos los rastreos en detalle en /trackings.',
    });
  },
  {
    name: 'get_shipsgo_trackings',
    description: 'Obtiene los rastreos/seguimientos REALES en tiempo real del cliente desde ShipsGo. Estos son los envíos que el cliente está rastreando activamente. Incluye estado, progreso de tránsito y ruta. Usa ESTA herramienta cuando pregunten por "mis envíos", "estado de envíos", "rastreos", "trackings".',
    schema: z.object({
      type: z.enum(['air', 'ocean', 'all']).describe('Tipo de rastreo: air (aéreo), ocean (marítimo/contenedor), all (ambos)'),
    }),
  },
);

// 7. Buscar rutas disponibles — solo responde con stats y búsqueda específica
export const searchAvailableRoutes = tool(
  async ({ type, origin, destination }): Promise<string> => {
    const url = SHEET_URLS[type];
    if (!url) return JSON.stringify({ error: 'Tipo inválido' });

    const res = await fetch(url);
    if (!res.ok) return JSON.stringify({ error: 'No se pudo obtener rutas.' });

    const csv = await res.text();
    const parsed = parseCSV(csv);
    const destCol = type === 'LCL' ? 3 : 2;

    interface Route { origin: string; destination: string }
    const routes: Route[] = [];
    for (let i = 2; i < parsed.length; i++) {
      const row = parsed[i];
      if (!row) continue;
      const o = (row[1] || '').trim();
      const d = (row[destCol] || '').trim();
      if (o && d) routes.push({ origin: o, destination: d });
    }

    // Si NO hay filtro, solo dar estadísticas
    if (!origin && !destination) {
      const origins = [...new Set(routes.map((r) => r.origin))].sort();
      const destinations = [...new Set(routes.map((r) => r.destination))].sort();
      return JSON.stringify({
        type,
        totalRoutes: routes.length,
        totalOrigins: origins.length,
        totalDestinations: destinations.length,
        sampleOrigins: origins.slice(0, 8),
        sampleDestinations: destinations.slice(0, 8),
        hint: `Hay ${routes.length} rutas ${type}. Pregúntame por un origen o destino específico para ver las opciones.`,
      });
    }

    // Filtrar
    let filtered = routes;
    if (origin) filtered = filtered.filter((r) => r.origin.toLowerCase().includes(origin.toLowerCase()));
    if (destination) filtered = filtered.filter((r) => r.destination.toLowerCase().includes(destination.toLowerCase()));

    if (filtered.length === 0) {
      return JSON.stringify({ found: false, message: `No se encontraron rutas ${type} con esos criterios.` });
    }

    return JSON.stringify({
      found: true,
      type,
      count: filtered.length,
      routes: filtered.slice(0, 10),
      hint: filtered.length > 10 ? `Mostrando 10 de ${filtered.length} rutas.` : undefined,
    });
  },
  {
    name: 'search_available_routes',
    description: 'Busca rutas disponibles para cotizar. SIEMPRE pregunta al usuario por un origen o destino específico antes de buscar, porque hay miles de rutas. Solo si el usuario da un origen/destino, úsalos como filtro.',
    schema: z.object({
      type: z.enum(['AEREO', 'FCL', 'LCL']).describe('Tipo: AEREO (aéreo), FCL (marítimo full container), LCL (marítimo consolidado)'),
      origin: z.string().optional().describe('Filtrar por origen (ej: "Santiago", "Miami")'),
      destination: z.string().optional().describe('Filtrar por destino (ej: "Shanghai", "Los Angeles")'),
    }),
  },
);

// 8. Navegación del portal
export const navigatePortal = tool(
  async ({ query }): Promise<string> => {
    const section = findPortalSection(query);
    if (section) {
      return JSON.stringify({
        found: true,
        name: section.name,
        path: section.path,
        description: section.description,
      });
    }

    // No encontrada — devolver suggestions
    const suggestions = CLIENT_NAVIGATION.slice(0, 5).map((s) => ({ name: s.name, path: s.path }));
    return JSON.stringify({ found: false, message: 'No encontré esa sección exacta.', suggestions });
  },
  {
    name: 'navigate_portal',
    description: 'Busca cómo navegar a una sección del portal. Usa cuando el usuario quiera ir a algún lado, crear algo, o pregunte dónde encontrar una función.',
    schema: z.object({
      query: z.string().describe('Descripción de lo que busca el usuario (ej: "rastrear contenedor", "cotizar", "facturas")'),
    }),
  },
);

// 9. Info del ejecutivo asignado
export const getEjecutivoInfo = tool(
  async (): Promise<string> => {
    if (!_ctx.ejecutivo) {
      return JSON.stringify({ found: false, message: 'No tienes un ejecutivo comercial asignado actualmente.' });
    }
    return JSON.stringify({
      found: true,
      nombre: _ctx.ejecutivo.nombre,
      email: _ctx.ejecutivo.email,
      telefono: _ctx.ejecutivo.telefono,
      role: 'Ejecutivo Comercial',
    });
  },
  {
    name: 'get_ejecutivo_info',
    description: 'Obtiene la información del ejecutivo comercial asignado al cliente (nombre, email, teléfono). Usa cuando pregunten "quién es mi ejecutivo", "cómo contacto a mi ejecutivo", "teléfono del ejecutivo", etc.',
    schema: z.object({}),
  },
);

// 10. Info de Seemann Group
export const getCompanyInfo = tool(
  async ({ topic }): Promise<string> => {
    if (topic === 'offices') {
      return JSON.stringify({ offices: COMPANY_INFO.offices });
    }
    if (topic === 'services') {
      return JSON.stringify({ services: COMPANY_INFO.services });
    }
    if (topic === 'contact') {
      return JSON.stringify({
        general: COMPANY_INFO.contactGeneral,
        offices: COMPANY_INFO.offices,
      });
    }
    return JSON.stringify({
      name: COMPANY_INFO.name,
      description: COMPANY_INFO.description,
      services: COMPANY_INFO.services,
      networks: COMPANY_INFO.networks,
    });
  },
  {
    name: 'get_company_info',
    description: 'Obtiene información de Seemann Group: oficinas, servicios, contacto.',
    schema: z.object({
      topic: z.enum(['offices', 'services', 'contact', 'general']).describe('Tema: offices (oficinas), services (servicios), contact (contacto), general'),
    }),
  },
);

// 11. Glosario logístico
export const lookupGlossary = tool(
  async ({ term }): Promise<string> => {
    const result = findGlossaryTerm(term);
    if (result) return JSON.stringify({ found: true, definition: result });
    return JSON.stringify({ found: false, message: `No tengo una definición exacta para "${term}". Puedo responder preguntas generales de logística.` });
  },
  {
    name: 'lookup_glossary',
    description: 'Busca definiciones de términos logísticos comunes (IMO, FCL, LCL, AWB, BL, Incoterms, FOB, CIF, etc.). Usa cuando pregunten "¿qué es...?" sobre un término logístico.',
    schema: z.object({
      term: z.string().describe('Término a buscar (ej: "IMO", "FCL", "AWB", "incoterm")'),
    }),
  },
);

// ============================================================================
// EXPORTAR TODAS LAS TOOLS
// ============================================================================

export const ALL_TOOLS = [
  searchQuotes,
  searchAirShipments,
  searchOceanShipments,
  searchGroundShipments,
  searchInvoices,
  getShipsgoTrackings,
  searchAvailableRoutes,
  navigatePortal,
  getEjecutivoInfo,
  getCompanyInfo,
  lookupGlossary,
  ...EXTRA_TOOLS,
];
