import { createContext, useContext } from "react";

type ReporteriaClientesContextValue = {
  openTrackingTab: (tab?: "air" | "ocean") => void;
  openQuotesTab: (quoteNumber?: string) => void;
  quoteFilterNumber?: string;
};

const ReporteriaClientesContext =
  createContext<ReporteriaClientesContextValue | null>(null);

export const ReporteriaClientesProvider = ReporteriaClientesContext.Provider;

export function useReporteriaClientesContext() {
  return useContext(ReporteriaClientesContext);
}
