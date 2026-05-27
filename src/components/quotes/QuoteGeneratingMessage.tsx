// Este componente lo hice para que se muestre un mensaje de cargando cotización, espere...

import {
  useQuoteGeneratingMessage,
  type QuoteBtnPhase,
} from "./hooks/useQuoteGeneratingMessage";

type Props = {
  btnPhase: QuoteBtnPhase;
};

export function QuoteGeneratingMessage({ btnPhase }: Props) {
  const message = useQuoteGeneratingMessage(btnPhase);
  if (!message) return null;

  return <span className="quote-generating-message">{message}</span>;
}
