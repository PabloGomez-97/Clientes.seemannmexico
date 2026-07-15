/**
 * Cobros operativos compartidos FCL DAP / FCL DDP (Última Milla):
 * Handling, Banking, BL, TT, DTHC.
 * La aduana DDP vive en fclDdpAduana.ts.
 */

export const FCL_HANDLING_USD = 75;
export const FCL_BANK_USD = 50;
export const FCL_BL_USD = 60;

export const FCL_DTHC_RATE_20GP = 390.915;
export const FCL_DTHC_RATE_40 = 427.805;

export type FclContainerCode = "20GP" | "40HQ" | "40NOR";

export interface FclContainerQty {
  qty20GP: number;
  qty40HQ: number;
  qty40NOR: number;
}

export interface FclTtRates {
  ttRate20GP: number;
  ttRate40: number;
}

export interface FclContainerLine {
  code: FclContainerCode;
  qty: number;
  ttRate: number;
  dthcRate: number;
}

export const buildFclContainerLines = (
  qty: FclContainerQty,
  ttRates: FclTtRates,
): FclContainerLine[] => [
  {
    code: "20GP",
    qty: qty.qty20GP,
    ttRate: ttRates.ttRate20GP,
    dthcRate: FCL_DTHC_RATE_20GP,
  },
  {
    code: "40HQ",
    qty: qty.qty40HQ,
    ttRate: ttRates.ttRate40,
    dthcRate: FCL_DTHC_RATE_40,
  },
  {
    code: "40NOR",
    qty: qty.qty40NOR,
    ttRate: ttRates.ttRate40,
    dthcRate: FCL_DTHC_RATE_40,
  },
];

export const totalFclContainers = (qty: FclContainerQty): number =>
  qty.qty20GP + qty.qty40HQ + qty.qty40NOR;

/** Costo de transporte usado en el CIF de FCL DDP (sin aduana, GATE IN ni DOC PROCESS). */
export const calcFclCostoTransporte = (params: {
  qty: FclContainerQty;
  ttRates: FclTtRates;
  /** TT total ya con recargo Vespucio aplicado. */
  ttIncomeUsd: number;
}): number => {
  const { qty, ttIncomeUsd } = params;
  const dthcTotal =
    qty.qty20GP * FCL_DTHC_RATE_20GP +
    qty.qty40HQ * FCL_DTHC_RATE_40 +
    qty.qty40NOR * FCL_DTHC_RATE_40;
  return (
    FCL_HANDLING_USD +
    FCL_BANK_USD +
    FCL_BL_USD +
    ttIncomeUsd +
    dthcTotal
  );
};

export interface FclPdfCharge {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export const buildFclOperationalPdfCharges = (params: {
  lines: FclContainerLine[];
  /** Mapa code → TT income ya con Vespucio (solo tipos con qty > 0). */
  ttIncomeByCode: Partial<Record<FclContainerCode, number>>;
}): FclPdfCharge[] => {
  const charges: FclPdfCharge[] = [
    {
      code: "H",
      description: "Handling",
      quantity: 1,
      unit: "MIN",
      rate: FCL_HANDLING_USD,
      amount: FCL_HANDLING_USD,
    },
    {
      code: "BANK",
      description: "Banking Charge",
      quantity: 1,
      unit: "MIN",
      rate: FCL_BANK_USD,
      amount: FCL_BANK_USD,
    },
    {
      code: "B",
      description: "BL",
      quantity: 1,
      unit: "MIN",
      rate: FCL_BL_USD,
      amount: FCL_BL_USD,
    },
  ];

  for (const c of params.lines) {
    if (c.qty <= 0) continue;
    const amount = params.ttIncomeByCode[c.code] ?? 0;
    const rate = c.qty > 0 ? Number((amount / c.qty).toFixed(2)) : amount;
    charges.push({
      code: "TT",
      description: `Transporte Terrestre (${c.code})`,
      quantity: c.qty,
      unit: "CONTENEDOR",
      rate,
      amount,
    });
  }

  for (const c of params.lines) {
    if (c.qty <= 0) continue;
    charges.push({
      code: "D",
      description: `DTHC (${c.code})`,
      quantity: c.qty,
      unit: "CONTENEDOR",
      rate: c.dthcRate,
      amount: Number((c.dthcRate * c.qty).toFixed(3)),
    });
  }

  return charges;
};

export const buildFclOperationalLinbisCharges = (params: {
  lines: FclContainerLine[];
  ttIncomeByCode: Partial<Record<FclContainerCode, number>>;
  billToName: string;
  incotermLabel: "DAP" | "DDP";
}) => {
  const { lines, ttIncomeByCode, billToName, incotermLabel } = params;
  const charges: any[] = [];
  const fclLabel = `FCL ${incotermLabel}`;

  const pushFixed = (
    id: number,
    code: string,
    unit: string,
    amount: number,
    reference: string,
    notes: string,
  ) => {
    charges.push({
      service: { id, code },
      income: {
        quantity: 1,
        unit,
        rate: amount,
        amount,
        showamount: amount,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: { name: billToName },
        currency: { abbr: "USD" as const },
        reference,
        showOnDocument: true,
        notes,
      },
      expense: { currency: { abbr: "USD" as const } },
    });
  };

  pushFixed(
    134698,
    "H",
    "MIN",
    FCL_HANDLING_USD,
    "Amount to Handling",
    `Handling - ${fclLabel} (Última Milla)`,
  );
  pushFixed(
    134703,
    "BANK",
    "MIN",
    FCL_BANK_USD,
    "Amount to Banking Charge",
    `Banking Charge - ${fclLabel} (Última Milla)`,
  );
  pushFixed(
    134795,
    "B",
    "MIN",
    FCL_BL_USD,
    "Amount to BL",
    `BL - ${fclLabel} (Última Milla)`,
  );

  for (const c of lines) {
    if (c.qty <= 0) continue;
    const ttAmount = ttIncomeByCode[c.code] ?? 0;
    const ttRateEffective =
      c.qty > 0 ? Number((ttAmount / c.qty).toFixed(2)) : ttAmount;
    charges.push({
      service: { id: 134796, code: "TT" },
      income: {
        quantity: c.qty,
        unit: "CONTENEDOR",
        rate: ttRateEffective,
        amount: ttAmount,
        showamount: ttAmount,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: { name: billToName },
        currency: { abbr: "USD" as const },
        reference: "Amount to Transporte Terrestre",
        showOnDocument: true,
        notes: `Transporte Terrestre - ${c.qty} contenedor${c.qty > 1 ? "es" : ""} ${c.code} × ${ttRateEffective} USD`,
      },
      expense: { currency: { abbr: "USD" as const } },
    });
  }

  for (const c of lines) {
    if (c.qty <= 0) continue;
    const dthcAmount = Number((c.dthcRate * c.qty).toFixed(3));
    charges.push({
      service: { id: 134807, code: "D" },
      income: {
        quantity: c.qty,
        unit: "CONTENEDOR",
        rate: c.dthcRate,
        amount: dthcAmount,
        showamount: dthcAmount,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: { name: billToName },
        currency: { abbr: "USD" as const },
        reference: "Amount to DTHC",
        showOnDocument: true,
        notes: `DTHC - ${c.qty} contenedor${c.qty > 1 ? "es" : ""} ${c.code} × ${c.dthcRate} USD`,
      },
      expense: { currency: { abbr: "USD" as const } },
    });
  }

  return charges;
};
