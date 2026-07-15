/**
 * Sistema de aduana / nacionalización exclusivo de Última Milla FCL DDP.
 * Independiente de Agencia de Aduanas y del módulo LCL.
 *
 * Cobros (orden Linbis/PDF):
 *  - CUSTOMS DUTIES 6%    → CIF × 6%
 *  - CUSTOMS TAX 19%      → CIF × 19%
 *  - CUSTOMS BROKER       → max(CIF × 0.30%, 175 USD)
 *  - CUSTOMS CLEARANCE    → 60 USD fijos
 *  - GATE IN              → 200 USD × total contenedores  (NO entra al CIF)
 *  - Doc. Process         → 55 USD fijos                  (NO entra al CIF)
 *
 * CIF = valorMercadería + costoTransporte + seguro
 * (costoTransporte = Handling + Bank + BL + TT + DTHC)
 */

export interface FclDdpAduanaLinbisServiceDef {
  id: number;
  code: string;
  description: string;
  reference: string;
}

export const FCL_DDP_ADUANA_SERVICES = {
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
  gateIn: {
    id: 149287,
    code: "GI",
    description: "GATE IN",
    reference: "Amount to Gate In",
  },
  docProcess: {
    id: 149288,
    code: "DP",
    description: "Doc. Process",
    reference: "Amount to Doc. Process",
  },
} as const satisfies Record<string, FclDdpAduanaLinbisServiceDef>;

export interface FclDdpAduanaBreakdown {
  customsDuties6: number;
  customsTax19: number;
  customsBroker: number;
  customsClearance: number;
  gateIn: number;
  docProcess: number;
}

export interface FclDdpAduanaResult {
  cif: number;
  costoTransporte: number;
  seguroParaCIF: number;
  breakdown: FclDdpAduanaBreakdown;
  total: number;
  totalContainers: number;
}

const CUSTOMS_TAX_PCT = 19;
const CUSTOMS_DUTIES_PCT = 6;
const CUSTOMS_BROKER_PCT = 0.3;
const CUSTOMS_BROKER_MIN_USD = 175;
const CUSTOMS_CLEARANCE_USD = 60;
const GATE_IN_PER_CONTAINER_USD = 200;
const DOC_PROCESS_USD = 55;

export const calculateFclDdpAduanaCharges = (params: {
  valorProducto: number;
  costoTransporte: number;
  seguro: number;
  totalContainers: number;
}): FclDdpAduanaResult => {
  const { valorProducto, costoTransporte, seguro, totalContainers } = params;

  const cif = valorProducto + costoTransporte + seguro;

  const customsDuties6 = Number(((cif * CUSTOMS_DUTIES_PCT) / 100).toFixed(2));
  const customsTax19 = Number(((cif * CUSTOMS_TAX_PCT) / 100).toFixed(2));
  const brokerCalc = (cif * CUSTOMS_BROKER_PCT) / 100;
  const customsBroker = Number(
    Math.max(brokerCalc, CUSTOMS_BROKER_MIN_USD).toFixed(2),
  );
  const customsClearance = CUSTOMS_CLEARANCE_USD;
  const gateIn = Number(
    (GATE_IN_PER_CONTAINER_USD * Math.max(0, totalContainers)).toFixed(2),
  );
  const docProcess = DOC_PROCESS_USD;

  const breakdown: FclDdpAduanaBreakdown = {
    customsDuties6,
    customsTax19,
    customsBroker,
    customsClearance,
    gateIn,
    docProcess,
  };

  const total = Number(
    (
      customsDuties6 +
      customsTax19 +
      customsBroker +
      customsClearance +
      gateIn +
      docProcess
    ).toFixed(2),
  );

  return {
    cif: Number(cif.toFixed(2)),
    costoTransporte: Number(costoTransporte.toFixed(2)),
    seguroParaCIF: Number(seguro.toFixed(2)),
    breakdown,
    total,
    totalContainers,
  };
};

const FCL_DDP_ADUANA_ORDER: Array<{
  key: keyof FclDdpAduanaBreakdown;
  service: FclDdpAduanaLinbisServiceDef;
}> = [
  { key: "customsDuties6", service: FCL_DDP_ADUANA_SERVICES.customsDuties6 },
  { key: "customsTax19", service: FCL_DDP_ADUANA_SERVICES.customsTax19 },
  { key: "customsBroker", service: FCL_DDP_ADUANA_SERVICES.customsBroker },
  {
    key: "customsClearance",
    service: FCL_DDP_ADUANA_SERVICES.customsClearance,
  },
  { key: "gateIn", service: FCL_DDP_ADUANA_SERVICES.gateIn },
  { key: "docProcess", service: FCL_DDP_ADUANA_SERVICES.docProcess },
];

export interface FclDdpAduanaPdfCharge {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export const buildFclDdpAduanaLinbisCharges = (
  breakdown: FclDdpAduanaBreakdown,
  billToName: string,
  contextNote: string,
  totalContainers: number,
) =>
  FCL_DDP_ADUANA_ORDER.flatMap(({ key, service }) => {
    const amount = breakdown[key];
    if (amount <= 0) return [];

    if (key === "gateIn") {
      const qty = Math.max(0, totalContainers);
      const rate = GATE_IN_PER_CONTAINER_USD;
      return [
        {
          service: { id: service.id, code: service.code },
          income: {
            quantity: qty,
            unit: "CONTENEDOR",
            rate,
            amount,
            showamount: amount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: { name: billToName },
            currency: { abbr: "USD" as const },
            reference: service.reference,
            showOnDocument: true,
            notes: `${service.description} - ${qty} contenedor${qty !== 1 ? "es" : ""} × ${rate} USD - ${contextNote}`,
          },
          expense: { currency: { abbr: "USD" as const } },
        },
      ];
    }

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

export const buildFclDdpAduanaPdfCharges = (
  breakdown: FclDdpAduanaBreakdown,
  totalContainers: number,
): FclDdpAduanaPdfCharge[] =>
  FCL_DDP_ADUANA_ORDER.flatMap(({ key, service }) => {
    const amount = breakdown[key];
    if (amount <= 0) return [];

    if (key === "gateIn") {
      const qty = Math.max(0, totalContainers);
      return [
        {
          code: service.code,
          description: service.description,
          quantity: qty,
          unit: "CONTENEDOR",
          rate: GATE_IN_PER_CONTAINER_USD,
          amount,
        },
      ];
    }

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
