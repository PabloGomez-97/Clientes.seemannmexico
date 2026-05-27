// ============================================================================
// Tipos compartidos — Gestión Cotizador (tarifas TT, DELV y recargos)
// ============================================================================

export interface IFclCotizadorConfig {
  ttRate20GP: number;
  ttRate40: number;
  vespucioExtendedSurchargePct: number;
}

export interface ILclDeliveryBracket {
  maxKg: number;
  maxM3: number;
  amount: number;
}

export interface ILclCotizadorConfig {
  brackets: ILclDeliveryBracket[];
  maxKg: number;
  maxM3: number;
  vespucioExtendedSurchargePct: number;
}

export interface IAereoTtBracket {
  maxKg: number;
  amount: number;
}

export interface IAereoCotizadorConfig {
  brackets: IAereoTtBracket[];
  /** Límite superior peso real (kg) para tabla TT */
  maxKg: number;
  vespucioExtendedSurchargePct: number;
}

export interface IGestionCotizadorConfig {
  fcl: IFclCotizadorConfig;
  lcl: ILclCotizadorConfig;
  aereo: IAereoCotizadorConfig;
  updatedBy: string;
}

export const DEFAULT_FCL_COTIZADOR: IFclCotizadorConfig = {
  ttRate20GP: 690.2,
  ttRate40: 547.4,
  vespucioExtendedSurchargePct: 45,
};

export const DEFAULT_LCL_DELIVERY_BRACKETS: ILclDeliveryBracket[] = [
  { maxKg: 500, maxM3: 2.5, amount: 183.26 },
  { maxKg: 1000, maxM3: 5, amount: 202.9 },
  { maxKg: 2000, maxM3: 8, amount: 248.71 },
  { maxKg: 3000, maxM3: 11, amount: 274.89 },
  { maxKg: 4000, maxM3: 15, amount: 294.53 },
  { maxKg: 5000, maxM3: 20, amount: 314.16 },
  { maxKg: 6000, maxM3: 25, amount: 353.43 },
  { maxKg: 7000, maxM3: 30, amount: 392.7 },
];

export const DEFAULT_LCL_COTIZADOR: ILclCotizadorConfig = {
  brackets: DEFAULT_LCL_DELIVERY_BRACKETS,
  maxKg: 7000,
  maxM3: 30,
  vespucioExtendedSurchargePct: 45,
};

export const DEFAULT_AEREO_TT_BRACKETS: IAereoTtBracket[] = [
  { maxKg: 300, amount: 85.09 },
  { maxKg: 500, amount: 91.63 },
  { maxKg: 1000, amount: 104.72 },
  { maxKg: 1500, amount: 117.81 },
  { maxKg: 2000, amount: 163.63 },
];

export const DEFAULT_AEREO_COTIZADOR: IAereoCotizadorConfig = {
  brackets: DEFAULT_AEREO_TT_BRACKETS,
  maxKg: 2000,
  vespucioExtendedSurchargePct: 45,
};

export const DEFAULT_GESTION_COTIZADOR_CONFIG: IGestionCotizadorConfig = {
  fcl: DEFAULT_FCL_COTIZADOR,
  lcl: DEFAULT_LCL_COTIZADOR,
  aereo: DEFAULT_AEREO_COTIZADOR,
  updatedBy: "system",
};

export const LCL_DELIVERY_EXPENSE_DIVISOR = 1.1;

export type ContainerTypeForTt = "20GP" | "40HQ" | "40NOR";

export function getFclTtRate(
  containerType: ContainerTypeForTt,
  fcl: IFclCotizadorConfig = DEFAULT_FCL_COTIZADOR,
): number {
  return containerType === "20GP" ? fcl.ttRate20GP : fcl.ttRate40;
}

export function getVespucioExtendedMultiplier(
  surchargePct: number = DEFAULT_FCL_COTIZADOR.vespucioExtendedSurchargePct,
): number {
  return 1 + surchargePct / 100;
}

export interface LclDeliveryBracketResult {
  amount: number;
  unit: "kg" | "m3";
  quantity: number;
  bracketIndex: number;
}

/**
 * Bracket DELV LCL: elige el tramo de mayor índice entre peso real (kg) y volumen (m³).
 */
export function findLclDeliveryBracket(
  realWeightKg: number,
  totalVolumeM3: number,
  lcl: ILclCotizadorConfig = DEFAULT_LCL_COTIZADOR,
): LclDeliveryBracketResult | null {
  const { brackets, maxKg, maxM3 } = lcl;
  if (realWeightKg > maxKg || totalVolumeM3 > maxM3) {
    return null;
  }

  const kgIdx = brackets.findIndex((b) => realWeightKg <= b.maxKg);
  const m3Idx = brackets.findIndex((b) => totalVolumeM3 <= b.maxM3);
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
    chosenIdx = effectiveM3Idx;
    unit = "m3";
    quantity = totalVolumeM3;
  }

  return {
    amount: brackets[chosenIdx].amount,
    unit,
    quantity,
    bracketIndex: chosenIdx,
  };
}

export function lclDeliveryExpenseFromIncome(incomeAmount: number): number {
  return Number((incomeAmount / LCL_DELIVERY_EXPENSE_DIVISOR).toFixed(2));
}

/** Alias: mismo divisor 1.10 para TT aéreo */
export const aereoTtExpenseFromIncome = lclDeliveryExpenseFromIncome;

export interface AereoTtBracketResult {
  amount: number;
  bracketIndex: number;
}

/**
 * Bracket TT Aéreo: solo peso real total (kg), suma de piezas.
 */
export function findAereoTtBracket(
  realWeightKg: number,
  aereo: IAereoCotizadorConfig = DEFAULT_AEREO_COTIZADOR,
): AereoTtBracketResult | null {
  const { brackets, maxKg } = aereo;
  if (realWeightKg <= 0 || realWeightKg > maxKg) return null;
  const idx = brackets.findIndex((b) => realWeightKg <= b.maxKg);
  if (idx < 0) return null;
  return {
    amount: brackets[idx].amount,
    bracketIndex: idx,
  };
}

/** Destinos con última milla aérea (Santiago de Chile) */
export const AIR_ULTIMA_MILLA_DESTINATION_NORMALIZED = new Set([
  "santiago de chile",
  "santiago_de_chile",
]);

export function isAirUltimaMillaEligibleDestination(
  destinationNormalized?: string | null,
  destinationLabel?: string | null,
): boolean {
  const norm = (destinationNormalized ?? "").trim().toLowerCase();
  if (AIR_ULTIMA_MILLA_DESTINATION_NORMALIZED.has(norm)) return true;
  const label = (destinationLabel ?? "").toLowerCase();
  return label.includes("santiago") && label.includes("chile");
}
