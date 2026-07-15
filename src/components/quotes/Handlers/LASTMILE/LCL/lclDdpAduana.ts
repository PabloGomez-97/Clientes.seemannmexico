/**
 * Sistema de aduana / nacionalización exclusivo de Última Milla LCL DDP.
 * Independiente de Agencia de Aduanas (AIR / FCL / cotizador LCL).
 *
 * Cobros:
 *  - CUSTOMS TAX 19%      → CIF × 19%
 *  - CUSTOMS DUTIES 6%    → CIF × 6%
 *  - CUSTOMS BROKER       → max(CIF × 0.30%, 175 USD)
 *  - CUSTOMS CLEARANCE    → 75 USD fijos
 *  - Extraport expenses   → 38 × max(ton, m³) + 451  (NO entra al CIF)
 *
 * CIF = valorMercadería + costoTransporte + seguro
 * (costoTransporte = Handling + Bank + GL + DOC + DELV; igual que antes)
 */

export interface LclDdpAduanaLinbisServiceDef {
  id: number;
  code: string;
  description: string;
  reference: string;
}

export const LCL_DDP_ADUANA_SERVICES = {
  customsTax19: {
    id: 146101,
    code: "CT1",
    description: "CUSTOMS TAX 19%",
    reference: "Amount to Customs Tax 19%",
  },
  customsDuties6: {
    id: 149271,
    code: "CD/DA(t6",
    description: "CUSTOMS DUTIES / DERECHO ADUANERO (0% to 6%)",
    reference: "Amount to Customs Duties",
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
  extraportCharges: {
    id: 149269,
    code: "Ee",
    description: "Extraport expenses",
    reference: "Amount to Extraport expenses",
  },
} as const satisfies Record<string, LclDdpAduanaLinbisServiceDef>;

export interface LclDdpAduanaBreakdown {
  customsTax19: number;
  customsDuties6: number;
  customsBroker: number;
  customsClearance: number;
  extraportCharges: number;
}

export interface LclDdpAduanaResult {
  cif: number;
  costoTransporte: number;
  seguroParaCIF: number;
  breakdown: LclDdpAduanaBreakdown;
  total: number;
  /** Unidad W/M usada en Extraport: el mayor entre ton y m³ */
  extraportWm: number;
}

const CUSTOMS_TAX_PCT = 19;
const CUSTOMS_DUTIES_PCT = 6;
const CUSTOMS_BROKER_PCT = 0.3;
const CUSTOMS_BROKER_MIN_USD = 175;
const CUSTOMS_CLEARANCE_USD = 75;
const EXTRAPORT_RATE = 38;
const EXTRAPORT_BASE = 451;

/** ton métrica = kg / 1000; W/M = max(ton, m³) */
export const calcLclExtraportWm = (
  realWeightKg: number,
  volumeM3: number,
): number => Math.max(realWeightKg / 1000, volumeM3);

export const calcLclExtraportCharges = (
  realWeightKg: number,
  volumeM3: number,
): { wm: number; amount: number } => {
  const wm = calcLclExtraportWm(realWeightKg, volumeM3);
  const amount = Number((EXTRAPORT_RATE * wm + EXTRAPORT_BASE).toFixed(2));
  return { wm, amount };
};

export const calculateLclDdpAduanaCharges = (params: {
  valorProducto: number;
  costoTransporte: number;
  seguro: number;
  realWeightKg: number;
  volumeM3: number;
}): LclDdpAduanaResult => {
  const {
    valorProducto,
    costoTransporte,
    seguro,
    realWeightKg,
    volumeM3,
  } = params;

  const cif = valorProducto + costoTransporte + seguro;

  const customsTax19 = Number(((cif * CUSTOMS_TAX_PCT) / 100).toFixed(2));
  const customsDuties6 = Number(((cif * CUSTOMS_DUTIES_PCT) / 100).toFixed(2));
  const brokerCalc = (cif * CUSTOMS_BROKER_PCT) / 100;
  const customsBroker = Number(
    Math.max(brokerCalc, CUSTOMS_BROKER_MIN_USD).toFixed(2),
  );
  const customsClearance = CUSTOMS_CLEARANCE_USD;

  const { wm: extraportWm, amount: extraportCharges } = calcLclExtraportCharges(
    realWeightKg,
    volumeM3,
  );

  const breakdown: LclDdpAduanaBreakdown = {
    customsTax19,
    customsDuties6,
    customsBroker,
    customsClearance,
    extraportCharges,
  };

  const total = Number(
    (
      customsTax19 +
      customsDuties6 +
      customsBroker +
      customsClearance +
      extraportCharges
    ).toFixed(2),
  );

  return {
    cif: Number(cif.toFixed(2)),
    costoTransporte: Number(costoTransporte.toFixed(2)),
    seguroParaCIF: Number(seguro.toFixed(2)),
    breakdown,
    total,
    extraportWm: Number(extraportWm.toFixed(3)),
  };
};

const LCL_DDP_ADUANA_ORDER: Array<{
  key: keyof LclDdpAduanaBreakdown;
  service: LclDdpAduanaLinbisServiceDef;
}> = [
  { key: "customsTax19", service: LCL_DDP_ADUANA_SERVICES.customsTax19 },
  { key: "customsDuties6", service: LCL_DDP_ADUANA_SERVICES.customsDuties6 },
  { key: "customsBroker", service: LCL_DDP_ADUANA_SERVICES.customsBroker },
  {
    key: "customsClearance",
    service: LCL_DDP_ADUANA_SERVICES.customsClearance,
  },
  {
    key: "extraportCharges",
    service: LCL_DDP_ADUANA_SERVICES.extraportCharges,
  },
];

export interface LclDdpAduanaPdfCharge {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export const buildLclDdpAduanaLinbisCharges = (
  breakdown: LclDdpAduanaBreakdown,
  billToName: string,
  contextNote: string,
) =>
  LCL_DDP_ADUANA_ORDER.flatMap(({ key, service }) => {
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

export const buildLclDdpAduanaPdfCharges = (
  breakdown: LclDdpAduanaBreakdown,
): LclDdpAduanaPdfCharge[] =>
  LCL_DDP_ADUANA_ORDER.flatMap(({ key, service }) => {
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
