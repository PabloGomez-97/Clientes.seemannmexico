/**
 * Última Milla — lógica LCL (DAP / DDP) separada de FCL y AÉREO.
 */
export {
  LCL_DELIVERY_BRACKETS,
  LCL_DELIVERY_MAX_KG,
  LCL_DELIVERY_MAX_M3,
  findLclDeliveryBracket,
  type LclDeliveryBracketResult,
} from "./lclDeliveryBrackets";

export {
  LCL_HANDLING_USD,
  LCL_BANK_USD,
  LCL_GASTOS_LOCALES_USD,
  LCL_DOC_RATE_PER_M3,
  calcLclCostoTransporte,
  buildLclOperationalPdfCharges,
  buildLclOperationalLinbisCharges,
  type LclPdfCharge,
} from "./lclOperationalCharges";

export {
  LCL_DDP_ADUANA_SERVICES,
  calculateLclDdpAduanaCharges,
  buildLclDdpAduanaLinbisCharges,
  buildLclDdpAduanaPdfCharges,
  calcLclExtraportCharges,
  type LclDdpAduanaBreakdown,
  type LclDdpAduanaResult,
  type LclDdpAduanaPdfCharge,
} from "./lclDdpAduana";
