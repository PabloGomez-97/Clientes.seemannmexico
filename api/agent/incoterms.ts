// api/agent/incoterms.ts
// Incoterms 2020 con explicación detallada de responsabilidades.

export interface Incoterm {
  code: string;
  name: string;
  spanish: string;
  modes: string[];               // 'sea' | 'air' | 'road' | 'rail' | 'all'
  riskTransfer: string;
  costsBy: { seller: string[]; buyer: string[] };
  insurance: 'seller' | 'buyer' | 'optional';
  customs: { export: 'seller' | 'buyer'; import: 'seller' | 'buyer' };
  bestFor: string;
  warning?: string;
}

export const INCOTERMS_2020: Incoterm[] = [
  {
    code: 'EXW',
    name: 'Ex Works',
    spanish: 'En Fábrica',
    modes: ['all'],
    riskTransfer: 'En las instalaciones del vendedor (fábrica/almacén). El comprador asume el riesgo desde la recogida.',
    costsBy: {
      seller: ['Embalaje y disponibilidad de mercancía en sus instalaciones'],
      buyer: ['Recogida', 'Carga al transporte', 'Flete principal', 'Aduanas exportación e importación', 'Seguros', 'Última milla'],
    },
    insurance: 'buyer',
    customs: { export: 'buyer', import: 'buyer' },
    bestFor: 'Compradores con experiencia logística y agentes en el país de origen.',
    warning: 'El comprador asume el riesgo más alto. EXW es el incoterm con mayor responsabilidad para el comprador.',
  },
  {
    code: 'FCA',
    name: 'Free Carrier',
    spanish: 'Franco Transportista',
    modes: ['all'],
    riskTransfer: 'Cuando la mercancía se entrega al transportista designado por el comprador, en el lugar acordado.',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Carga al transportista (si entrega en sus instalaciones)'],
      buyer: ['Flete principal', 'Aduanas importación', 'Seguros', 'Última milla'],
    },
    insurance: 'buyer',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'Operaciones aéreas o multimodales donde el comprador organiza el flete.',
  },
  {
    code: 'CPT',
    name: 'Carriage Paid To',
    spanish: 'Transporte Pagado Hasta',
    modes: ['all'],
    riskTransfer: 'Cuando el vendedor entrega al primer transportista (riesgo se transfiere ANTES que los costos).',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Flete principal hasta destino acordado'],
      buyer: ['Aduanas importación', 'Seguros', 'Última milla'],
    },
    insurance: 'buyer',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'Cuando el vendedor consigue mejor flete pero no quiere asumir el riesgo en tránsito.',
  },
  {
    code: 'CIP',
    name: 'Carriage and Insurance Paid To',
    spanish: 'Transporte y Seguro Pagados Hasta',
    modes: ['all'],
    riskTransfer: 'Cuando el vendedor entrega al primer transportista. El vendedor paga seguro hasta destino.',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Flete principal', 'Seguro (cobertura amplia ICC A)'],
      buyer: ['Aduanas importación', 'Última milla'],
    },
    insurance: 'seller',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'Compradores que quieren protección de seguro sin gestionarlo.',
  },
  {
    code: 'DAP',
    name: 'Delivered at Place',
    spanish: 'Entregado en Lugar',
    modes: ['all'],
    riskTransfer: 'Cuando la mercancía está disponible para descarga en el lugar de destino acordado.',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Flete principal', 'Transporte hasta destino (sin descargar)'],
      buyer: ['Descarga en destino', 'Aduanas importación', 'Última milla local'],
    },
    insurance: 'optional',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'Importadores que quieren recibir la carga sin preocuparse del flete.',
  },
  {
    code: 'DPU',
    name: 'Delivered at Place Unloaded',
    spanish: 'Entregado en Lugar Descargado',
    modes: ['all'],
    riskTransfer: 'Una vez descargada la mercancía en el lugar de destino. Único incoterm donde el vendedor descarga.',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Flete principal', 'Descarga en destino'],
      buyer: ['Aduanas importación', 'Última milla'],
    },
    insurance: 'optional',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'Cuando el vendedor tiene capacidad de descargar (ej: carga proyecto, contenedores con grúa).',
  },
  {
    code: 'DDP',
    name: 'Delivered Duty Paid',
    spanish: 'Entregado con Derechos Pagados',
    modes: ['all'],
    riskTransfer: 'Hasta el destino final acordado, con todos los derechos pagados.',
    costsBy: {
      seller: ['TODO incluido: embalaje, aduanas (export e import), flete, derechos, IVA, transporte hasta destino'],
      buyer: ['Solo recibir la mercancía'],
    },
    insurance: 'optional',
    customs: { export: 'seller', import: 'seller' },
    bestFor: 'Compradores sin equipo logístico. El vendedor asume TODO.',
    warning: 'El vendedor asume el riesgo más alto. Requiere conocer aduanas del país de destino.',
  },
  {
    code: 'FAS',
    name: 'Free Alongside Ship',
    spanish: 'Franco al Costado del Buque',
    modes: ['sea'],
    riskTransfer: 'Cuando la mercancía está colocada al costado del buque en el puerto de carga.',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Transporte al costado del buque'],
      buyer: ['Carga al buque', 'Flete marítimo', 'Aduanas importación', 'Seguros', 'Última milla'],
    },
    insurance: 'buyer',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'Cargas pesadas o de gran volumen que se cargan con grúas del puerto.',
  },
  {
    code: 'FOB',
    name: 'Free on Board',
    spanish: 'Franco a Bordo',
    modes: ['sea'],
    riskTransfer: 'Cuando la mercancía está cargada a bordo del buque en el puerto de origen.',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Carga al buque'],
      buyer: ['Flete marítimo', 'Aduanas importación', 'Seguros', 'Última milla'],
    },
    insurance: 'buyer',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'Operaciones marítimas donde el comprador tiene su propio agente de fletes.',
    warning: 'Solo aplica para transporte marítimo. NO usar para contenedores LCL — usa FCA.',
  },
  {
    code: 'CFR',
    name: 'Cost and Freight',
    spanish: 'Costo y Flete',
    modes: ['sea'],
    riskTransfer: 'Cuando la mercancía está cargada a bordo del buque (igual que FOB), pero el vendedor paga el flete.',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Carga al buque', 'Flete marítimo hasta destino'],
      buyer: ['Aduanas importación', 'Seguros', 'Descarga', 'Última milla'],
    },
    insurance: 'buyer',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'El vendedor consigue mejor tarifa de flete pero no quiere asumir el riesgo de tránsito.',
  },
  {
    code: 'CIF',
    name: 'Cost, Insurance and Freight',
    spanish: 'Costo, Seguro y Flete',
    modes: ['sea'],
    riskTransfer: 'Cuando la mercancía está cargada a bordo del buque. El seguro corre por cuenta del vendedor.',
    costsBy: {
      seller: ['Embalaje', 'Aduanas exportación', 'Carga', 'Flete marítimo', 'Seguro (cobertura mínima ICC C)'],
      buyer: ['Aduanas importación', 'Descarga', 'Última milla'],
    },
    insurance: 'seller',
    customs: { export: 'seller', import: 'buyer' },
    bestFor: 'Importaciones marítimas donde el comprador quiere flete + seguro incluidos.',
    warning: 'El seguro CIF es cobertura mínima (ICC C). Si necesitas todo riesgo, usa CIP o contrata seguro adicional.',
  },
];

export function findIncoterm(query: string): Incoterm | null {
  const q = query.toLowerCase().trim();
  for (const i of INCOTERMS_2020) {
    if (i.code.toLowerCase() === q) return i;
  }
  for (const i of INCOTERMS_2020) {
    if (q.includes(i.code.toLowerCase()) || i.spanish.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)) return i;
  }
  return null;
}
