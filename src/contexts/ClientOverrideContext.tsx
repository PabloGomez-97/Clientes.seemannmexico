import { createContext, useContext } from "react";

/**
 * Context to override activeUsername when rendering client views
 * inside the ejecutivo's ReporteriaClientes.
 * Returns null when not inside a provider (normal client usage).
 */
const ClientOverrideContext = createContext<string | null>(null);

export const ClientOverrideProvider = ClientOverrideContext.Provider;

export function useClientOverride(): string | null {
  return useContext(ClientOverrideContext);
}
