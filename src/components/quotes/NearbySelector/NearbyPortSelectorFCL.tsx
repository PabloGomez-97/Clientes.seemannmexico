import type { CountryPort } from "../Handlers/FCL/ExpandedRoutesFcl";

type SelectOption = { value: string; label: string };

interface NearbyPortSelectorFCLProps {
  /** Los 4 puertos más cercanos (índice 0 = automático, 1-3 = alternativos). */
  nearbyPorts: Array<CountryPort & { distanceKm: number }>;
  /** Puerto seleccionado manualmente por el usuario (null = automático). */
  selectedPort: SelectOption | null;
  /** Callback para seleccionar / deseleccionar un puerto alternativo. */
  onSelectPort: (port: SelectOption | null) => void;
}

/**
 * Selector de puerto cercano para FCL — sistema independiente de LCL y AÉREO.
 * Muestra el puerto asignado (automático o seleccionado) y tarjetas
 * clickeables para los puertos alternativos más cercanos.
 */
const NearbyPortSelectorFCL = ({
  nearbyPorts,
  selectedPort,
  onSelectPort,
}: NearbyPortSelectorFCLProps) => {
  const effectivePort = selectedPort
    ? (nearbyPorts.find((p) => p.value === selectedPort.value) ??
      nearbyPorts[0] ??
      null)
    : (nearbyPorts[0] ?? null);

  const alternativePorts = nearbyPorts.slice(1);

  return (
    <div style={{ padding: "8px 0 4px", marginBottom: 12 }}>
      {/* Puerto asignado */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
          fontSize: "0.75rem",
          color: "#475569",
        }}
      >
        <i className="bi bi-anchor" style={{ color: "#2563eb" }} />
        <span>Puerto asignado:</span>
        <span style={{ fontWeight: 700, color: "#1e3a5f" }}>
          {effectivePort?.label ?? "—"}
        </span>
        <span style={{ color: "#94a3b8" }}>·</span>
        <span>
          {effectivePort
            ? nearbyPorts
                .find((p) => p.value === effectivePort.value)
                ?.distanceKm.toFixed(0)
            : "—"}{" "}
          km
        </span>
        {!selectedPort && (
          <span
            style={{
              background: "#dcfce7",
              color: "#16a34a",
              borderRadius: 10,
              padding: "1px 7px",
              fontSize: "0.65rem",
              fontWeight: 700,
            }}
          >
            más cercano
          </span>
        )}
      </div>

      {/* Tarjetas de puertos alternativos */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {alternativePorts.map((p, i) => {
          const isAlt = selectedPort?.value === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() =>
                onSelectPort(isAlt ? null : { value: p.value, label: p.label })
              }
              style={{
                flex: 1,
                minWidth: 100,
                border: isAlt ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
                borderRadius: 8,
                padding: "7px 10px",
                background: isAlt ? "#eff6ff" : "#fff",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: isAlt ? "#2563eb" : "#94a3b8",
                  marginBottom: 2,
                }}
              >
                {i + 2}° más cercano
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: isAlt ? 700 : 500,
                  color: isAlt ? "#1e3a5f" : "#334155",
                }}
              >
                {p.label}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#64748b",
                  marginTop: 1,
                }}
              >
                {p.distanceKm.toFixed(0)} km
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NearbyPortSelectorFCL;
