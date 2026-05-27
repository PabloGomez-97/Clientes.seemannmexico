// QuoteLCL-ejecutivo.tsx
// Wrapper delgado que reutiliza QuoteLCL en modo ejecutivo.
// Toda la lógica vive en QuoteLCL.tsx (isEjecutivoMode = true).

import QuoteLCL from "../../quotes/QuoteLCL";
import type { QuoteLCLProps } from "../../quotes/Handlers/LCL/HandlerQuoteLCL";

export default function QuoteLCLEjecutivo(
  props: Omit<QuoteLCLProps, "isEjecutivoMode">,
) {
  return <QuoteLCL {...props} isEjecutivoMode />;
}
