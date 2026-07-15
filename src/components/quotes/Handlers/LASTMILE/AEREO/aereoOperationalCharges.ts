/**
 * Cobros operativos compartidos AÉREO DAP / AÉREO DDP (Última Milla):
 * Desconsolidación, Handling, Banking, TT.
 * LAC y aduana DDP viven en aereoDdpAduana.ts (LAC no entra al CIF).
 */

import { type AereoTtBracketResult } from "./aereoTtBrackets";

export const AEREO_DESCONSOLIDACION_USD = 190;
export const AEREO_HANDLING_USD = 60;
export const AEREO_BANK_USD = 50;

/** Costo de transporte usado en el CIF de AÉREO DDP (sin LAC ni aduana). */
export const calcAereoCostoTransporte = (ttIncomeUsd: number): number =>
  AEREO_DESCONSOLIDACION_USD +
  AEREO_HANDLING_USD +
  AEREO_BANK_USD +
  ttIncomeUsd;

export interface AereoPdfCharge {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export const buildAereoOperationalPdfCharges = (params: {
  ttBracket: AereoTtBracketResult | null;
  ttIncomeUsd: number;
}): AereoPdfCharge[] => {
  const charges: AereoPdfCharge[] = [
    {
      code: "D",
      description: "Desconsolidación",
      quantity: 1,
      unit: "Each",
      rate: AEREO_DESCONSOLIDACION_USD,
      amount: AEREO_DESCONSOLIDACION_USD,
    },
    {
      code: "H",
      description: "Handling",
      quantity: 1,
      unit: "MIN",
      rate: AEREO_HANDLING_USD,
      amount: AEREO_HANDLING_USD,
    },
    {
      code: "BANK",
      description: "Banking Charge",
      quantity: 1,
      unit: "MIN",
      rate: AEREO_BANK_USD,
      amount: AEREO_BANK_USD,
    },
  ];

  if (params.ttBracket) {
    charges.push({
      code: "TT",
      description: `Transporte Terrestre (≤${params.ttBracket.maxKg}kg)`,
      quantity: 1,
      unit: "Each",
      rate: params.ttIncomeUsd,
      amount: params.ttIncomeUsd,
    });
  }

  return charges;
};

export const buildAereoOperationalLinbisCharges = (params: {
  billToName: string;
  incotermLabel: "DAP" | "DDP";
  realWeightKg: number;
  ttBracket: AereoTtBracketResult | null;
  ttIncomeUsd: number;
}) => {
  const {
    billToName,
    incotermLabel,
    realWeightKg,
    ttBracket,
    ttIncomeUsd,
  } = params;
  const charges: any[] = [];
  const aereoLabel = `AÉREO ${incotermLabel}`;

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
    134954,
    "D",
    "Each",
    AEREO_DESCONSOLIDACION_USD,
    "Amount to Desconsolidación",
    `Desconsolidación - ${aereoLabel} (Última Milla)`,
  );
  pushFixed(
    134698,
    "H",
    "MIN",
    AEREO_HANDLING_USD,
    "Amount to Handling",
    `Handling - ${aereoLabel} (Última Milla)`,
  );
  pushFixed(
    134703,
    "BANK",
    "MIN",
    AEREO_BANK_USD,
    "Amount to Banking Charge",
    `Banking Charge - ${aereoLabel} (Última Milla)`,
  );

  if (ttBracket) {
    charges.push({
      service: { id: 134796, code: "TT" },
      income: {
        quantity: 1,
        unit: "Each",
        rate: ttIncomeUsd,
        amount: ttIncomeUsd,
        showamount: ttIncomeUsd,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: { name: billToName },
        currency: { abbr: "USD" as const },
        reference: "Amount to Transporte Terrestre",
        showOnDocument: true,
        notes: `Transporte Terrestre - bracket ≤${ttBracket.maxKg}kg (peso real total: ${realWeightKg.toFixed(2)} kg)`,
      },
      expense: { currency: { abbr: "USD" as const } },
    });
  }

  return charges;
};
