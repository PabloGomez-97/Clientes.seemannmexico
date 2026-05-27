import QuoteFCL from "../../quotes/QuoteFCL";
import type { QuoteFCLProps } from "../../quotes/Handlers/FCL/HandlerQuoteFCL";

/**
 * QuoteFCL-ejecutivo.tsx
 * Thin wrapper that reuses QuoteFCL in ejecutivo mode.
 * All logic lives in QuoteFCL.tsx  this component only sets isEjecutivoMode=true.
 */
function QuoteFCLEjecutivo(props: QuoteFCLProps) {
  return <QuoteFCL {...props} isEjecutivoMode />;
}

export default QuoteFCLEjecutivo;
