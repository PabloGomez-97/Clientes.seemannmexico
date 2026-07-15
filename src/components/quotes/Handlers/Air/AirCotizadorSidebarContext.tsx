import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AirCotizadorSidebarContextValue {
  sidebar: ReactNode | null;
  setSidebar: (node: ReactNode | null) => void;
  hasSidebar: boolean;
}

const AirCotizadorSidebarContext =
  createContext<AirCotizadorSidebarContextValue | null>(null);

export function AirCotizadorSidebarProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebar, setSidebarState] = useState<ReactNode | null>(null);

  const setSidebar = useCallback((node: ReactNode | null) => {
    setSidebarState(node);
  }, []);

  const value = useMemo(
    () => ({
      sidebar,
      setSidebar,
      hasSidebar: sidebar != null,
    }),
    [sidebar, setSidebar],
  );

  return (
    <AirCotizadorSidebarContext.Provider value={value}>
      {children}
    </AirCotizadorSidebarContext.Provider>
  );
}

export function useAirCotizadorSidebarOptional() {
  return useContext(AirCotizadorSidebarContext);
}

export function AirCotizadorSidebarSlot() {
  const ctx = useAirCotizadorSidebarOptional();
  if (!ctx?.hasSidebar) return null;

  return (
    <aside
      className="cotizador-split__aside"
      aria-label="Panel lateral del cotizador"
    >
      <div className="cotizador-quote-container cotizador-quote-container--form cotizador-quote-container--history">
        {ctx.sidebar}
      </div>
    </aside>
  );
}
