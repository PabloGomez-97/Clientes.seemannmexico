import { useState, useEffect } from "react";
import type {
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  GeoJSONPointProperties,
  GeoJSONLineStringProperties,
} from "./types";
import { getFlagUrl, formatDateTime } from "./types";

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

interface AirShipmentRouteProps {
  shipmentId: number;
}

function AirShipmentRoute({ shipmentId }: AirShipmentRouteProps) {
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRoute() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/shipsgo/shipments/${shipmentId}/geojson`,
        );
        if (!res.ok) throw new Error("No se pudo obtener la ruta");
        const data = await res.json();
        if (!cancelled) {
          setGeojson(data.geojson || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar la ruta",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="sg-detail-section">
        <div className="sg-detail-title">Ruta del envío (experimental)</div>
        <div className="sg-route-loading">
          <div className="sg-spinner sg-spinner--small" />
          <span>Cargando ruta...</span>
        </div>
      </div>
    );
  }

  if (error || !geojson || !geojson.features?.length) {
    return (
      <div className="sg-detail-section">
        <div className="sg-detail-title">Ruta del envío (experimental)</div>
        <div className="sg-route-empty">
          {error
            ? "No se pudo cargar la ruta del envío."
            : "Ruta no disponible para este envío."}
        </div>
      </div>
    );
  }

  // Extract airports (Point features) and routes (LineString features)
  const airports = geojson.features.filter(
    (f): f is GeoJSONFeature & { geometry: { type: "Point" } } =>
      f.geometry.type === "Point",
  );
  const routes = geojson.features.filter(
    (f): f is GeoJSONFeature & { geometry: { type: "LineString" } } =>
      f.geometry.type === "LineString",
  );

  const statusOrder = { PAST: 0, CURRENT: 1, FUTURE: 2 };
  const sortedAirports = [...airports].sort(
    (a, b) =>
      (statusOrder[a.properties.status as keyof typeof statusOrder] ?? 9) -
      (statusOrder[b.properties.status as keyof typeof statusOrder] ?? 9),
  );

  return (
    <div className="sg-detail-section">
      <div className="sg-detail-title">Ruta del envío (experimental)</div>

      {/* Visual route map */}
      <div className="sg-route-map">
        {sortedAirports.map((airport, idx) => {
          const props = airport.properties as GeoJSONPointProperties;
          const isLast = idx === sortedAirports.length - 1;

          return (
            <div
              key={`${props.location.iata}-${idx}`}
              className="sg-route-map-segment"
            >
              <div
                className={`sg-route-map-node sg-route-map-node--${props.status.toLowerCase()}`}
              >
                <div className="sg-route-map-dot" />
                <div className="sg-route-map-info">
                  <div className="sg-route-map-iata">
                    {props.location.iata}
                    <img
                      src={getFlagUrl(props.location.country.code)}
                      alt=""
                      className="sg-location-flag"
                    />
                  </div>
                  <div className="sg-route-map-name">{props.location.name}</div>
                  <div className="sg-route-map-country">
                    {props.location.country.name}
                  </div>
                </div>
              </div>
              {!isLast && (
                <div
                  className={`sg-route-map-line sg-route-map-line--${props.status.toLowerCase()}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Flight legs */}
      {routes.map((route, idx) => {
        const props = route.properties as GeoJSONLineStringProperties;
        return (
          <div
            key={idx}
            className={`sg-route-leg sg-route-leg--${props.status.toLowerCase()}`}
          >
            <div className="sg-route-leg-header">
              <span
                className={`sg-route-leg-status sg-route-leg-status--${props.status.toLowerCase()}`}
              >
                {props.status === "PAST"
                  ? "Completado"
                  : props.status === "CURRENT"
                    ? "En vuelo"
                    : "Pendiente"}
              </span>
              {props.flight && (
                <span className="sg-route-leg-flight">
                  Vuelo {props.flight}
                </span>
              )}
            </div>
            <div className="sg-route-leg-body">
              {props.events?.DEP && (
                <div className="sg-route-leg-event">
                  <span className="sg-route-leg-event-label">Salida</span>
                  <span className="sg-route-leg-event-airport">
                    {props.events.DEP.location.iata} —{" "}
                    {props.events.DEP.location.name}
                  </span>
                  <span className="sg-route-leg-event-time">
                    {formatDateTime(props.events.DEP.timestamp)}
                  </span>
                </div>
              )}
              {props.events?.ARR && (
                <div className="sg-route-leg-event">
                  <span className="sg-route-leg-event-label">Llegada</span>
                  <span className="sg-route-leg-event-airport">
                    {props.events.ARR.location.iata} —{" "}
                    {props.events.ARR.location.name}
                  </span>
                  <span className="sg-route-leg-event-time">
                    {formatDateTime(props.events.ARR.timestamp)}
                  </span>
                </div>
              )}
              {props.cargo && (props.cargo.pieces || props.cargo.weight) && (
                <div className="sg-route-leg-cargo">
                  {props.cargo.pieces != null && (
                    <span>{props.cargo.pieces} pzas</span>
                  )}
                  {props.cargo.weight != null && (
                    <span>{props.cargo.weight} kg</span>
                  )}
                  {props.cargo.volume != null && (
                    <span>{props.cargo.volume} m³</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AirShipmentRoute;
