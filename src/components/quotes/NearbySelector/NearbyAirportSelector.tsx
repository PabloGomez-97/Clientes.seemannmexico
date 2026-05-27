import type { CountryAirport } from "../Handlers/Air/ExpandedRoutesAir";

type SelectOption = { value: string; label: string };

interface NearbyAirportSelectorProps {
  /** Los 4 aeropuertos más cercanos (índice 0 = automático, 1-3 = alternativos). */
  nearbyAirports: Array<CountryAirport & { distanceKm: number }>;
  /** Aeropuerto seleccionado manualmente por el usuario (null = automático). */
  selectedAirport: SelectOption | null;
  /** Callback para seleccionar / deseleccionar un aeropuerto alternativo. */
  onSelectAirport: (airport: SelectOption | null) => void;
}

/**
 * Muestra el aeropuerto asignado (automático o seleccionado) y tarjetas
 * clickeables para los aeropuertos alternativos más cercanos.
 *
 * Agregar soporte a un nuevo país NO requiere modificar este componente.
 */
const NearbyAirportSelector = ({
  nearbyAirports,
  selectedAirport,
  onSelectAirport,
}: NearbyAirportSelectorProps) => {
  const effectiveAirport = selectedAirport
    ? (nearbyAirports.find((a) => a.value === selectedAirport.value) ??
      nearbyAirports[0] ??
      null)
    : (nearbyAirports[0] ?? null);

  const alternativeAirports = nearbyAirports.slice(1);

  return (
    <div style={{ padding: "8px 0 4px", marginBottom: 12 }}>
      {/* Aeropuerto asignado */}
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
        <i className="bi bi-airplane" style={{ color: "#ff6200" }} />
        <span>Aeropuerto asignado:</span>
        <span style={{ fontWeight: 700, color: "#1e3a5f" }}>
          {effectiveAirport?.label ?? "—"}
        </span>
        <span style={{ color: "#94a3b8" }}>·</span>
        <span>
          {effectiveAirport
            ? nearbyAirports
                .find((a) => a.value === effectiveAirport.value)
                ?.distanceKm.toFixed(0)
            : "—"}{" "}
          km
        </span>
        {!selectedAirport && (
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

      {/* Tarjetas de aeropuertos alternativos */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {alternativeAirports.map((a, i) => {
          const isAlt = selectedAirport?.value === a.value;
          return (
            <button
              key={a.value}
              type="button"
              onClick={() =>
                onSelectAirport(
                  isAlt ? null : { value: a.value, label: a.label },
                )
              }
              style={{
                flex: 1,
                minWidth: 100,
                border: isAlt ? "1.5px solid #ff6200" : "1.5px solid #e2e8f0",
                borderRadius: 8,
                padding: "7px 10px",
                background: isAlt ? "#fff7f0" : "#fff",
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
                  color: isAlt ? "#ff6200" : "#94a3b8",
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
                {a.label}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#64748b",
                  marginTop: 1,
                }}
              >
                {a.distanceKm.toFixed(0)} km
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NearbyAirportSelector;
