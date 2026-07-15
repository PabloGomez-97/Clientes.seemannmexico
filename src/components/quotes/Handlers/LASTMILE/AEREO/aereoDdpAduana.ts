/**
 * Sistema de aduana / nacionalización exclusivo de Última Milla AÉREO DDP.
 * Independiente de Agencia de Aduanas y de los módulos LCL / FCL.
 *
 * Cobros (orden Linbis/PDF):
 *  - CUSTOMS DUTIES 6%    → CIF × 6%
 *  - CUSTOMS TAX 19%      → CIF × 19%
 *  - CUSTOMS BROKER       → max(CIF × 0.30%, 175 USD)
 *  - CUSTOMS CLEARANCE    → 60 USD fijos
 *  - LAC                  → 90 USD fijos  (NO entra al CIF)
 *
 * CIF = valorMercadería + costoTransporte + seguro
 * (costoTransporte = Desconsolidación + Handling + Banking + TT; sin LAC)
 */

export interface AereoDdpAduanaLinbisServiceDef {
  id: number;
  code: string;
  description: string;
  reference: string;
}

export const AEREO_DDP_ADUANA_SERVICES = {
  customsDuties6: {
    id: 149271,
    code: "CD/DA(t6",
    description: "CUSTOMS DUTIES / DERECHO ADUANERO (0% to 6%)",
    reference: "Amount to Customs Duties",
  },
  customsTax19: {
    id: 146101,
    code: "CT1",
    description: "CUSTOMS TAX 19%",
    reference: "Amount to Customs Tax 19%",
  },
  customsBroker: {
    id: 146102,
    code: "CB",
    description: "CUSTOMS BROKER",
    reference: "Amount to Customs Broker",
  },
  customsClearance: {
    id: 146100,
    code: "CUST",
    description: "CUSTOMS CLEARANCE",
    reference: "Amount to Customs Clearance",
  },
  lac: {
    id: 149289,
    code: "LAC",
    description: "LOCAL AIRPORT CHARGES",
    reference: "Amount to Local Airport Charges",
  },
} as const satisfies Record<string, AereoDdpAduanaLinbisServiceDef>;

export interface AereoDdpAduanaBreakdown {
  customsDuties6: number;
  customsTax19: number;
  customsBroker: number;
  customsClearance: number;
  lac: number;
}

export interface AereoDdpAduanaResult {
  cif: number;
  costoTransporte: number;
  seguroParaCIF: number;
  breakdown: AereoDdpAduanaBreakdown;
  total: number;
}

const CUSTOMS_TAX_PCT = 19;
const CUSTOMS_DUTIES_PCT = 6;
const CUSTOMS_BROKER_PCT = 0.3;
const CUSTOMS_BROKER_MIN_USD = 175;
const CUSTOMS_CLEARANCE_USD = 60;
const LAC_USD = 90;

export const calculateAereoDdpAduanaCharges = (params: {
  valorProducto: number;
  costoTransporte: number;
  seguro: number;
}): AereoDdpAduanaResult => {
  const { valorProducto, costoTransporte, seguro } = params;

  const cif = valorProducto + costoTransporte + seguro;

  const customsDuties6 = Number(((cif * CUSTOMS_DUTIES_PCT) / 100).toFixed(2));
  const customsTax19 = Number(((cif * CUSTOMS_TAX_PCT) / 100).toFixed(2));
  const brokerCalc = (cif * CUSTOMS_BROKER_PCT) / 100;
  const customsBroker = Number(
    Math.max(brokerCalc, CUSTOMS_BROKER_MIN_USD).toFixed(2),
  );
  const customsClearance = CUSTOMS_CLEARANCE_USD;
  const lac = LAC_USD;

  const breakdown: AereoDdpAduanaBreakdown = {
    customsDuties6,
    customsTax19,
    customsBroker,
    customsClearance,
    lac,
  };

  const total = Number(
    (
      customsDuties6 +
      customsTax19 +
      customsBroker +
      customsClearance +
      lac
    ).toFixed(2),
  );

  return {
    cif: Number(cif.toFixed(2)),
    costoTransporte: Number(costoTransporte.toFixed(2)),
    seguroParaCIF: Number(seguro.toFixed(2)),
    breakdown,
    total,
  };
};

const AEREO_DDP_ADUANA_ORDER: Array<{
  key: keyof AereoDdpAduanaBreakdown;
  service: AereoDdpAduanaLinbisServiceDef;
}> = [
  { key: "customsDuties6", service: AEREO_DDP_ADUANA_SERVICES.customsDuties6 },
  { key: "customsTax19", service: AEREO_DDP_ADUANA_SERVICES.customsTax19 },
  { key: "customsBroker", service: AEREO_DDP_ADUANA_SERVICES.customsBroker },
  {
    key: "customsClearance",
    service: AEREO_DDP_ADUANA_SERVICES.customsClearance,
  },
  { key: "lac", service: AEREO_DDP_ADUANA_SERVICES.lac },
];

export interface AereoDdpAduanaPdfCharge {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export const buildAereoDdpAduanaLinbisCharges = (
  breakdown: AereoDdpAduanaBreakdown,
  billToName: string,
  contextNote: string,
) =>
  AEREO_DDP_ADUANA_ORDER.flatMap(({ key, service }) => {
    const amount = breakdown[key];
    if (amount <= 0) return [];

    return [
      {
        service: { id: service.id, code: service.code },
        income: {
          quantity: 1,
          unit: "Each",
          rate: amount,
          amount,
          showamount: amount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: { name: billToName },
          currency: { abbr: "USD" as const },
          reference: service.reference,
          showOnDocument: true,
          notes: `${service.description} - ${contextNote}`,
        },
        expense: { currency: { abbr: "USD" as const } },
      },
    ];
  });

export const buildAereoDdpAduanaPdfCharges = (
  breakdown: AereoDdpAduanaBreakdown,
): AereoDdpAduanaPdfCharge[] =>
  AEREO_DDP_ADUANA_ORDER.flatMap(({ key, service }) => {
    const amount = breakdown[key];
    if (amount <= 0) return [];

    return [
      {
        code: service.code,
        description: service.description,
        quantity: 1,
        unit: "Each",
        rate: amount,
        amount,
      },
    ];
  });
