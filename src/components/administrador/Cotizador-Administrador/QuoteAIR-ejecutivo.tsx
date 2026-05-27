import QuoteAPITester from "../../quotes/QuoteAIR";
import type { QuoteAIRProps } from "../../quotes/Handlers/Air/HandlerQuoteAir";

/**
 * QuoteAIR-ejecutivo.tsx
 * Thin wrapper that reuses QuoteAIR in ejecutivo mode.
 * All logic lives in QuoteAIR.tsx  this component only sets isEjecutivoMode=true.
 */
function QuoteAIREjecutivo(props: QuoteAIRProps) {
  return <QuoteAPITester {...props} isEjecutivoMode />;
}

export default QuoteAIREjecutivo;
