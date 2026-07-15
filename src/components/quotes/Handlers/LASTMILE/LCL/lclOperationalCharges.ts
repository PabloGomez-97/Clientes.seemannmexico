/**
 * Cobros operativos compartidos LCL DAP / LCL DDP (Última Milla):
 * Handling, Banking, Gastos Locales, DOC LCL, DELV.
 * La aduana DDP vive en lclDdpAduana.ts.
 */

import {
  LCL_DELIVERY_BRACKETS,
  type LclDeliveryBracketResult,
} from "./lclDeliveryBrackets";

export const LCL_HANDLING_USD = 75;
export const LCL_BANK_USD = 50;
export const LCL_GASTOS_LOCALES_USD = 65;
export const LCL_DOC_RATE_PER_M3 = 10;

export interface LclOperationalTotalsInput {
  volumeM3: number;
  realWeightKg: number;
  /** Monto DELV ya con recargo Vespucio aplicado (o 0 si no hay bracket). */
  deliveryIncomeUsd: number;
}

/** Costo de transporte usado en el CIF de LCL DDP (sin aduana ni extraport). */
export const calcLclCostoTransporte = (
  input: LclOperationalTotalsInput,
): number => {
  const totalM3 = Number(input.volumeM3.toFixed(3));
  const docAmount = Number((totalM3 * LCL_DOC_RATE_PER_M3).toFixed(2));
  return (
    LCL_HANDLING_USD +
    LCL_BANK_USD +
    LCL_GASTOS_LOCALES_USD +
    docAmount +
    input.deliveryIncomeUsd
  );
};

export interface LclPdfCharge {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export const buildLclOperationalPdfCharges = (params: {
  volumeM3: number;
  bracket: LclDeliveryBracketResult | null;
  deliveryIncomeUsd: number;
}): LclPdfCharge[] => {
  const totalM3 = Number(params.volumeM3.toFixed(3));
  const docAmount = Number((totalM3 * LCL_DOC_RATE_PER_M3).toFixed(2));

  const charges: LclPdfCharge[] = [
    {
      code: "H",
      description: "Handling",
      quantity: 1,
      unit: "MIN",
      rate: LCL_HANDLING_USD,
      amount: LCL_HANDLING_USD,
    },
    {
      code: "BANK",
      description: "Banking Charge",
      quantity: 1,
      unit: "MIN",
      rate: LCL_BANK_USD,
      amount: LCL_BANK_USD,
    },
    {
      code: "GL",
      description: "Gastos Locales",
      quantity: 1,
      unit: "MIN",
      rate: LCL_GASTOS_LOCALES_USD,
      amount: LCL_GASTOS_LOCALES_USD,
    },
    {
      code: "DOC LCL",
      description: "Documentation Ocean - LCL",
      quantity: totalM3,
      unit: "m3",
      rate: LCL_DOC_RATE_PER_M3,
      amount: docAmount,
    },
  ];

  if (params.bracket) {
    const qty = Number(params.bracket.quantity.toFixed(3));
    const incomeAmount = params.deliveryIncomeUsd;
    const incomeRate =
      qty > 0 ? Number((incomeAmount / qty).toFixed(4)) : incomeAmount;
    charges.push({
      code: "DELV",
      description: "Delivery - Trucking",
      quantity: qty,
      unit: params.bracket.unit,
      rate: incomeRate,
      amount: incomeAmount,
    });
  }

  return charges;
};

export const buildLclOperationalCharges = (params: {
  volumeM3: number;
  realWeightKg: number;
  billToName: string;
  incotermLabel: "DAP" | "DDP";
  deliveryIncomeUsd: number;
  bracket: LclDeliveryBracketResult | null;
}) => {
  const {
    volumeM3,
    billToName,
    incotermLabel,
    deliveryIncomeUsd,
    bracket,
  } = params;
  const charges: any[] = [];

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
    LCL_HANDLING_USD,
    "Amount to Handling",
    `Handling - LCL ${incotermLabel} (Última Milla)`,
  );
  pushFixed(
    134703,
    "BANK",
    "MIN",
    LCL_BANK_USD,
    "Amount to Banking Charge",
    `Banking Charge - LCL ${incotermLabel} (Última Milla)`,
  );
  pushFixed(
    134710,
    "GL",
    "MIN",
    LCL_GASTOS_LOCALES_USD,
    "Amount to Gastos Locales",
    `Gastos Locales - LCL ${incotermLabel} (Última Milla)`,
  );

  const totalM3 = Number(volumeM3.toFixed(3));
  const docAmount = Number((totalM3 * LCL_DOC_RATE_PER_M3).toFixed(2));
  charges.push({
    service: { id: 134711, code: "DOC LCL" },
    income: {
      quantity: totalM3,
      unit: "m3",
      rate: LCL_DOC_RATE_PER_M3,
      amount: docAmount,
      showamount: docAmount,
      payment: "Collect",
      billApplyTo: "Other",
      billTo: { name: billToName },
      currency: { abbr: "USD" as const },
      reference: "Amount to Documentation Ocean - LCL",
      showOnDocument: true,
      notes: `Documentation Ocean LCL - ${totalM3.toFixed(3)} m³ × ${LCL_DOC_RATE_PER_M3} USD/m³`,
    },
    expense: { currency: { abbr: "USD" as const } },
  });

  if (bracket) {
    const incomeAmount = deliveryIncomeUsd;
    const expenseAmount = Number((incomeAmount / 1.1).toFixed(2));
    const qty = Number(bracket.quantity.toFixed(3));
    const incomeRate =
      qty > 0 ? Number((incomeAmount / qty).toFixed(4)) : incomeAmount;
    const expenseRate =
      qty > 0 ? Number((expenseAmount / qty).toFixed(4)) : expenseAmount;
    const b = LCL_DELIVERY_BRACKETS[bracket.bracketIndex];
    charges.push({
      service: { id: 134724, code: "DELV" },
      income: {
        quantity: qty,
        unit: bracket.unit,
        rate: incomeRate,
        amount: incomeAmount,
        showamount: incomeAmount,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: { name: billToName },
        currency: { abbr: "USD" as const },
        reference: "Amount to Delivery - Trucking",
        showOnDocument: true,
        notes: `Delivery Trucking - bracket ${bracket.bracketIndex + 1} (≤${b.maxKg}kg / ≤${b.maxM3}m³) por ${bracket.unit === "m3" ? "volumen" : "peso volumétrico"}`,
      },
      expense: {
        quantity: qty,
        unit: bracket.unit,
        rate: expenseRate,
        amount: expenseAmount,
        showamount: expenseAmount,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: { name: billToName },
        currency: { abbr: "USD" as const },
        reference: "Expense Delivery - Trucking",
        showOnDocument: true,
        notes: `Delivery Trucking expense - income / 1.10`,
      },
    });
  }

  return charges;
};
