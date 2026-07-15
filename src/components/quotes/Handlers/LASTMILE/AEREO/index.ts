/**
 * Última Milla — lógica AÉREO (DAP / DDP) separada de LCL y FCL.
 */
export {
  AEREO_TT_BRACKETS,
  AEREO_TT_MAX_KG,
  findAereoTtBracket,
  type AereoTtBracketResult,
} from "./aereoTtBrackets";

export {
  AEREO_DESCONSOLIDACION_USD,
  AEREO_HANDLING_USD,
  AEREO_BANK_USD,
  calcAereoCostoTransporte,
  buildAereoOperationalPdfCharges,
  buildAereoOperationalLinbisCharges,
  type AereoPdfCharge,
} from "./aereoOperationalCharges";

export {
  AEREO_DDP_ADUANA_SERVICES,
  calculateAereoDdpAduanaCharges,
  buildAereoDdpAduanaLinbisCharges,
  buildAereoDdpAduanaPdfCharges,
  type AereoDdpAduanaBreakdown,
  type AereoDdpAduanaResult,
  type AereoDdpAduanaPdfCharge,
} from "./aereoDdpAduana";
