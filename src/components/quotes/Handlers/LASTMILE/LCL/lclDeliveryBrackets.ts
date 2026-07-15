/**
 * Brackets DELIVERY - TRUCKING (id 134724, code DELV) — LCL última milla.
 * Se aplica el bracket cuyo índice es el MAYOR entre el que cubre el
 * peso real (kg) y el que cubre el volumen total (m³).
 * El amount listado corresponde al INCOME en USD; el EXPENSE se calcula
 * como income / 1.10 (10% markup).
 */
export const LCL_DELIVERY_BRACKETS: Array<{
  maxKg: number;
  maxM3: number;
  amount: number;
}> = [
  { maxKg: 500, maxM3: 2.5, amount: 183.26 },
  { maxKg: 1000, maxM3: 5, amount: 202.9 },
  { maxKg: 2000, maxM3: 8, amount: 248.71 },
  { maxKg: 3000, maxM3: 11, amount: 274.89 },
  { maxKg: 4000, maxM3: 15, amount: 294.53 },
  { maxKg: 5000, maxM3: 20, amount: 314.16 },
  { maxKg: 6000, maxM3: 25, amount: 353.43 },
  { maxKg: 7000, maxM3: 30, amount: 392.7 },
];

export const LCL_DELIVERY_MAX_KG = 7000;
export const LCL_DELIVERY_MAX_M3 = 30;

export interface LclDeliveryBracketResult {
  amount: number;
  unit: "kg" | "m3";
  quantity: number;
  bracketIndex: number;
}

/**
 * Determina el bracket DELIVERY a cobrar dado el peso real (kg)
 * y el volumen total (m³). Se elige el bracket más alto entre ambas
 * dimensiones (mayor índice = mayor costo). Retorna `null` si la
 * carga excede el máximo de la tabla.
 */
export const findLclDeliveryBracket = (
  realWeightKg: number,
  totalVolumeM3: number,
): LclDeliveryBracketResult | null => {
  if (
    realWeightKg > LCL_DELIVERY_MAX_KG ||
    totalVolumeM3 > LCL_DELIVERY_MAX_M3
  ) {
    return null;
  }

  const kgIdx = LCL_DELIVERY_BRACKETS.findIndex(
    (b) => realWeightKg <= b.maxKg,
  );
  const m3Idx = LCL_DELIVERY_BRACKETS.findIndex(
    (b) => totalVolumeM3 <= b.maxM3,
  );
  if (kgIdx < 0 && m3Idx < 0) return null;

  const effectiveKgIdx = kgIdx >= 0 ? kgIdx : -1;
  const effectiveM3Idx = m3Idx >= 0 ? m3Idx : -1;

  let chosenIdx: number;
  let unit: "kg" | "m3";
  let quantity: number;

  if (effectiveKgIdx > effectiveM3Idx) {
    chosenIdx = effectiveKgIdx;
    unit = "kg";
    quantity = realWeightKg;
  } else if (effectiveM3Idx > effectiveKgIdx) {
    chosenIdx = effectiveM3Idx;
    unit = "m3";
    quantity = totalVolumeM3;
  } else {
    // Empate de índice: prevalece el volumen (LCL es volumétrico)
    chosenIdx = effectiveM3Idx;
    unit = "m3";
    quantity = totalVolumeM3;
  }

  return {
    amount: LCL_DELIVERY_BRACKETS[chosenIdx].amount,
    unit,
    quantity,
    bracketIndex: chosenIdx,
  };
};
