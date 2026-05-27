// api/agent/knowledgeBase.ts
// Base de conocimiento estática del portal Seemann Group.
// El agente consulta esto ANTES de hacer llamadas costosas a APIs externas.

export interface PortalSection {
  path: string;
  name: string;
  description: string;
  keywords: string[];
}

// ============================================================================
// NAVEGACIÓN COMPLETA DEL PORTAL (cliente)
// ============================================================================

export const CLIENT_NAVIGATION: PortalSection[] = [
  {
    path: '/',
    name: 'Inicio',
    description: 'Página principal. Muestra un carrusel de accesos rápidos, buscador de itinerarios e información general de Seemann Group.',
    keywords: ['inicio', 'home', 'principal', 'panel'],
  },
  {
    path: '/newquotes',
    name: 'Cotizar aquí',
    description: 'Crea una nueva cotización. Puedes elegir entre envío Aéreo, Marítimo FCL (Full Container) o LCL (Consolidado). Seleccionas origen, destino, detalles de carga y obtienes una cotización en línea.',
    keywords: ['cotizar', 'nueva cotización', 'crear cotización', 'presupuesto', 'quote', 'cotizador'],
  },
  {
    path: '/quotes',
    name: 'Cotizaciones',
    description: 'Historial de todas tus cotizaciones. Puedes ver el detalle, estado (válida/vencida), descargar PDF y repetir cotizaciones anteriores.',
    keywords: ['cotizaciones', 'historial cotizaciones', 'mis cotizaciones', 'quotes'],
  },
  {
    path: '/QuoteAIR',
    name: 'Cotización Aérea',
    description: 'Formulario para crear una cotización de envío aéreo. Requiere origen, destino, detalle de carga (peso, dimensiones, piezas).',
    keywords: ['cotización aérea', 'envío aéreo', 'air quote'],
  },
  {
    path: '/QuoteFCL',
    name: 'Cotización FCL',
    description: 'Formulario para crear una cotización marítima FCL (Full Container Load). Selecciona tipo de contenedor, origen y destino.',
    keywords: ['cotización fcl', 'full container', 'contenedor completo', 'marítimo fcl'],
  },
  {
    path: '/QuoteLCL',
    name: 'Cotización LCL',
    description: 'Formulario para crear una cotización marítima LCL (Less than Container Load / Consolidado). Para cargas que no llenan un contenedor completo.',
    keywords: ['cotización lcl', 'consolidado', 'less container', 'marítimo lcl', 'carga parcial'],
  },
  {
    path: '/air-shipments',
    name: 'Operaciones Aéreas',
    description: 'Lista de todas tus operaciones/envíos aéreos de Linbis. Puedes ver detalles, documentos adjuntos y datos de cada envío aéreo.',
    keywords: ['operaciones aéreas', 'envíos aéreos', 'air shipments', 'operaciones air'],
  },
  {
    path: '/ocean-shipments',
    name: 'Operaciones Marítimas',
    description: 'Lista de tus operaciones/envíos marítimos de Linbis. Muestra origen, destino, buque, contenedores y estado de cada operación.',
    keywords: ['operaciones marítimas', 'envíos marítimos', 'ocean shipments'],
  },
  {
    path: '/ground-shipments',
    name: 'Operaciones Terrestres',
    description: 'Lista de tus operaciones/envíos terrestres. Muestra datos de transporte terrestre/SFI.',
    keywords: ['operaciones terrestres', 'envíos terrestres', 'ground shipments', 'transporte terrestre'],
  },
  {
    path: '/new-tracking',
    name: 'Rastrear Envío Aéreo',
    description: 'Crea un seguimiento de envío aéreo con ShipsGo. Ingresa tu número AWB (11 dígitos) para rastrear tu envío en tiempo real.',
    keywords: ['rastrear', 'tracking', 'seguimiento', 'awb', 'aéreo', 'nuevo tracking', 'rastreo aéreo', 'track air'],
  },
  {
    path: '/new-ocean-tracking',
    name: 'Rastrear Envío Marítimo / Contenedor',
    description: 'Crea un seguimiento de envío marítimo/contenedor con ShipsGo. Ingresa tu número de contenedor o número de booking para rastrear.',
    keywords: ['rastrear contenedor', 'tracking contenedor', 'seguimiento marítimo', 'ocean tracking', 'container', 'booking', 'rastreo marítimo', 'rastrear envío marítimo'],
  },
  {
    path: '/trackings',
    name: 'Mis Seguimientos (Shipments)',
    description: 'Panel completo de seguimiento ShipsGo. Muestra todos tus rastreos activos, tanto aéreos como marítimos, con estado en tiempo real, porcentaje de tránsito, alertas de retraso y detalle de cada envío.',
    keywords: ['mis envíos', 'mis seguimientos', 'mis trackings', 'shipments', 'rastreos', 'estado envíos', 'shipsgo'],
  },
  {
    path: '/financiera',
    name: 'Reporte Financiero',
    description: 'Reportería financiera. Muestra facturas, pagos y el estado de cuenta del cliente.',
    keywords: ['financiero', 'facturas', 'pagos', 'balance', 'estado de cuenta', 'financiera'],
  },
  {
    path: '/operacional',
    name: 'Reporte Operacional',
    description: 'Reportería operacional. Resumen de operaciones por período, tipo de servicio y métricas.',
    keywords: ['operacional', 'reporte operacional', 'resumen operaciones'],
  },
  {
    path: '/novedades',
    name: 'Novedades',
    description: 'Noticias y publicaciones del blog de Seemann Group sobre logística internacional.',
    keywords: ['novedades', 'noticias', 'blog', 'publicaciones'],
  },
  {
    path: '/settings',
    name: 'Configuración',
    description: 'Configuración de la cuenta de usuario.',
    keywords: ['configuración', 'settings', 'cuenta', 'perfil'],
  },
];

// ============================================================================
// INFORMACIÓN ESTÁTICA DE SEEMANN GROUP
// ============================================================================

export const COMPANY_INFO = {
  name: 'Seemann Group',
  description: 'Freight forwarder con más de 35 años de experiencia en logística internacional.',
  services: [
    'Transporte marítimo FCL (Full Container Load)',
    'Transporte marítimo LCL (Less than Container Load / Consolidado)',
    'Transporte aéreo de carga',
    'Transporte terrestre',
    'Multimodal',
    'Warehouse / Almacenamiento',
    'Servicios aduaneros',
    'Seguros de carga',
    'Servicios 4PL',
  ],
  offices: {
    'Casa Matriz (USA)': {
      city: 'Miami, Florida',
      email: 'usasale@seemanngroup.com',
    },
    'Chile - Santiago': {
      city: 'Santiago de Chile',
      email: 'contacto@seemanngroup.com',
    },
    'Chile - Viña del Mar': {
      city: 'Viña del Mar',
      email: 'contacto@seemanngroup.com',
    },
    'Perú - Lima': {
      city: 'Lima',
      email: 'sales.lim@seemanngroup.com',
    },
    'Colombia - Bogotá': {
      city: 'Bogotá',
      email: 'asilva@seemanngroup.com',
    },
  },
  contactGeneral: 'contacto@seemanngroup.com',
  networks: ['Atlas Logistic Network', 'Globalink Network', 'WineCargo Alliance'],
};

// ============================================================================
// GLOSARIO DE TÉRMINOS LOGÍSTICOS COMUNES
// ============================================================================

export const GLOSSARY: Record<string, string> = {
  'IMO': 'Las cargas IMO son mercancías peligrosas reguladas por la Organización Marítima Internacional (IMO). Incluyen explosivos, gases, líquidos inflamables, sustancias tóxicas y radiactivas, entre otros. Requieren manejo y documentación especial.',
  'FCL': 'Full Container Load. Envío marítimo con contenedor completo dedicado a un solo cliente.',
  'LCL': 'Less than Container Load. Envío marítimo consolidado donde la carga comparte contenedor con otros clientes.',
  'AWB': 'Air Waybill. Documento de transporte aéreo que sirve como recibo de carga y contrato de transporte.',
  'BL': 'Bill of Lading. Documento de transporte marítimo que acredita la recepción de la mercancía.',
  'Incoterm': 'Términos de comercio internacional que definen las responsabilidades del comprador y vendedor (FOB, CIF, EXW, DDP, etc.).',
  'FOB': 'Free on Board. El vendedor entrega la mercancía a bordo del buque. El comprador asume costos y riesgos desde ese punto.',
  'CIF': 'Cost, Insurance and Freight. El vendedor paga costo, seguro y flete hasta el puerto de destino.',
  'EXW': 'Ex Works. El comprador asume todos los costos y riesgos desde la fábrica/almacén del vendedor.',
  'DDP': 'Delivered Duty Paid. El vendedor asume todos los costos incluyendo aduanas hasta el destino final.',
  'TEU': 'Twenty-foot Equivalent Unit. Unidad de medida de capacidad de contenedores (contenedor de 20 pies).',
  'FEU': 'Forty-foot Equivalent Unit. Contenedor de 40 pies.',
  'ETA': 'Estimated Time of Arrival. Fecha estimada de llegada.',
  'ETD': 'Estimated Time of Departure. Fecha estimada de salida.',
  'SCAC': 'Standard Carrier Alpha Code. Código único de 2-4 letras que identifica a una naviera.',
  'Consolidado': 'Envío donde la carga se agrupa con la de otros clientes en un mismo contenedor (LCL).',
  'Freight Forwarder': 'Agente de carga internacional que organiza y coordina el transporte de mercancías entre países, gestionando documentación, aduanas y logística.',
  'Despacho aduanero': 'Proceso de declarar y liberar mercancías ante la autoridad aduanera para su importación o exportación.',
  'Demurrage': 'Cargo extra por no retirar el contenedor del puerto dentro del plazo libre.',
  'Detention': 'Cargo extra por no devolver el contenedor vacío al depósito dentro del plazo libre.',
  'Sobredimensionada': 'Carga que excede las dimensiones estándar de un contenedor y requiere manejo especial (Open Top, Flat Rack, etc.).',
};

// ============================================================================
// MATCH HELPER — busca la sección adecuada del portal por keywords
// ============================================================================

export function findPortalSection(query: string): PortalSection | null {
  const q = query.toLowerCase();

  // Búsqueda exacta primero
  for (const section of CLIENT_NAVIGATION) {
    for (const kw of section.keywords) {
      if (q.includes(kw)) return section;
    }
  }

  // Búsqueda parcial
  for (const section of CLIENT_NAVIGATION) {
    const nameMatch = section.name.toLowerCase();
    if (q.includes(nameMatch) || nameMatch.includes(q)) return section;
  }

  return null;
}

// Buscar término en glosario
export function findGlossaryTerm(query: string): string | null {
  const q = query.toLowerCase();
  for (const [term, definition] of Object.entries(GLOSSARY)) {
    if (q.includes(term.toLowerCase())) return `**${term}**: ${definition}`;
  }
  return null;
}
