// ============================================================================
// TIPOS Y UTILIDADES — Agencia de Aduanas LCL (frontend-safe)
// ============================================================================

export const DESPACHO_SUELTA_IVA_PCT = 19;

export interface ILclChargeValues {
  honorariosPct: number;
  honorariosMinCurrency: number;
  customsClearanceCurrency: number;
  despachoSueltaRatePerWM: number;
  separacionBLCurrency: number;
  apoyoTramitacionCurrency: number;
  apoyoServicioDocumentalCurrency: number;
  ivaAduaneroPct: number;
  derechosPct: number;
}

export interface IAgenciaAduanaLclConfig {
  charges: ILclChargeValues;
  updatedBy: string;
}

export const DEFAULT_LCL_CHARGE_VALUES: ILclChargeValues = {
  honorariosPct: 0.3,
  honorariosMinCurrency: 115,
  customsClearanceCurrency: 60,
  despachoSueltaRatePerWM: 38,
  separacionBLCurrency: 200,
  apoyoTramitacionCurrency: 31,
  apoyoServicioDocumentalCurrency: 220,
  ivaAduaneroPct: 19,
  derechosPct: 6,
};

export const DEFAULT_LCL_CONFIG: IAgenciaAduanaLclConfig = {
  charges: DEFAULT_LCL_CHARGE_VALUES,
  updatedBy: "system",
};

function roundTotal(n: number): number {
  return Number(n.toFixed(2));
}

export function calculateAduanaChargesLcl(
  valorProducto: number,
  costoTransporte: number,
  seguro: number,
  wmChargeable: number,
  config: IAgenciaAduanaLclConfig,
) {
  const ch = config.charges;
  const wm = wmChargeable > 0 ? wmChargeable : 0;

  const cif = valorProducto + costoTransporte + seguro;

  const honorariosCalc = cif * (ch.honorariosPct / 100);
  const honorarios = Math.max(honorariosCalc, ch.honorariosMinCurrency);

  const customsClearance = ch.customsClearanceCurrency;

  const despachoSueltaBase = ch.despachoSueltaRatePerWM * wm;
  const despachoSuelta = despachoSueltaBase * (1 + DESPACHO_SUELTA_IVA_PCT / 100);

  const extraportCharges =
    despachoSuelta +
    ch.separacionBLCurrency +
    ch.apoyoTramitacionCurrency +
    ch.apoyoServicioDocumentalCurrency;

  const ivaAduanero = cif * (ch.ivaAduaneroPct / 100);
  const derechos = cif * (ch.derechosPct / 100);

  const total = roundTotal(
    honorarios +
      customsClearance +
      extraportCharges +
      ivaAduanero +
      derechos,
  );

  return {
    cif,
    honorarios,
    honorariosUsedMin: honorariosCalc < ch.honorariosMinCurrency,
    customsClearance,
    extraportCharges,
    wmChargeable: wm,
    ivaAduanero,
    derechos,
    total,
  };
}
