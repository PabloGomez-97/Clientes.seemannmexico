/**
 * Última Milla — lógica FCL (DAP / DDP) separada de LCL y AÉREO.
 */
export {
  FCL_HANDLING_USD,
  FCL_BANK_USD,
  FCL_BL_USD,
  FCL_DTHC_RATE_20GP,
  FCL_DTHC_RATE_40,
  buildFclContainerLines,
  totalFclContainers,
  calcFclCostoTransporte,
  buildFclOperationalPdfCharges,
  buildFclOperationalLinbisCharges,
  type FclContainerCode,
  type FclContainerQty,
  type FclTtRates,
  type FclContainerLine,
  type FclPdfCharge,
} from "./fclOperationalCharges";

export {
  FCL_DDP_ADUANA_SERVICES,
  calculateFclDdpAduanaCharges,
  buildFclDdpAduanaLinbisCharges,
  buildFclDdpAduanaPdfCharges,
  type FclDdpAduanaBreakdown,
  type FclDdpAduanaResult,
  type FclDdpAduanaPdfCharge,
} from "./fclDdpAduana";
