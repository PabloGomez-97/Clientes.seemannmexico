/**
 * Brackets Transporte Terrestre (TT) — AÉREO última milla.
 * Cobro FIJO por bracket según peso real total (kg).
 */
export const AEREO_TT_BRACKETS: Array<{ maxKg: number; amount: number }> = [
  { maxKg: 300, amount: 85.09 },
  { maxKg: 500, amount: 91.63 },
  { maxKg: 1000, amount: 104.72 },
  { maxKg: 1500, amount: 117.81 },
  { maxKg: 2000, amount: 163.63 },
];

export const AEREO_TT_MAX_KG = 2000;

export interface AereoTtBracketResult {
  amount: number;
  bracketIndex: number;
  maxKg: number;
}

export const findAereoTtBracket = (
  realWeightKg: number,
): AereoTtBracketResult | null => {
  if (realWeightKg <= 0 || realWeightKg > AEREO_TT_MAX_KG) return null;
  const idx = AEREO_TT_BRACKETS.findIndex((b) => realWeightKg <= b.maxKg);
  if (idx < 0) return null;
  return {
    amount: AEREO_TT_BRACKETS[idx].amount,
    bracketIndex: idx,
    maxKg: AEREO_TT_BRACKETS[idx].maxKg,
  };
};
