import { useEffect, useState } from "react";

export type QuoteBtnPhase = "idle" | "loading" | "check" | "done";

export function useQuoteGeneratingMessage(btnPhase: QuoteBtnPhase): string | null {
  const [message, setMessage] = useState<string | null>(null);
  const isGenerating = btnPhase === "loading" || btnPhase === "check";

  useEffect(() => {
    if (!isGenerating) {
      setMessage(null);
      return;
    }

    setMessage("Esto puede tardar unos segundos");
    const timer = setTimeout(() => {
      setMessage("Por favor, espere");
    }, 5000);

    return () => clearTimeout(timer);
  }, [isGenerating]);

  return message;
}
