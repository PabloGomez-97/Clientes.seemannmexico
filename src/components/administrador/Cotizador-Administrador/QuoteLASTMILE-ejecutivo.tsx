import QuoteLASTMILE from "../../quotes/QuoteLASTMILE";
import type { QuoteLastMileProps } from "../../quotes/Handlers/LASTMILE/HandlerQuoteLASTMILE";

/**
 * QuoteLASTMILE-ejecutivo.tsx
 * Thin wrapper that reuses QuoteLASTMILE in ejecutivo mode.
 * All logic lives in QuoteLASTMILE.tsx — this component only sets isEjecutivoMode=true.
 */
function QuoteLASTMILEEjecutivo(props: QuoteLastMileProps) {
  return <QuoteLASTMILE {...props} isEjecutivoMode />;
}

export default QuoteLASTMILEEjecutivo;
