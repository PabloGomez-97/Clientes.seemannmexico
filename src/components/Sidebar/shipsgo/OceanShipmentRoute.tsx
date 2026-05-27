import { useState, useEffect } from "react";
import type {
  OceanGeoJSONFeatureCollection,
  OceanGeoJSONFeature,
  OceanGeoJSONPointProperties,
  OceanGeoJSONLineStringProperties,
} from "./types";
import { getFlagUrl, formatDateTime } from "./types";

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

interface OceanShipmentRouteProps {
  shipmentId: number;
}

function OceanShipmentRoute({ shipmentId }: OceanShipmentRouteProps) {
  const [geojson, setGeojson] = useState<OceanGeoJSONFeatureCollection | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRoute() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/shipsgo/ocean/shipments/${shipmentId}/geojson`,
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

  // Extract ports (Point features) and legs (LineString features)
  const ports = geojson.features.filter(
    (f): f is OceanGeoJSONFeature & { geometry: { type: "Point" } } =>
      f.geometry.type === "Point",
  );
  const legs = geojson.features.filter(
    (f): f is OceanGeoJSONFeature & { geometry: { type: "LineString" } } =>
      f.geometry.type === "LineString",
  );

  const statusOrder = { PAST: 0, CURRENT: 1, FUTURE: 2 };
  const sortedPorts = [...ports].sort(
    (a, b) =>
      (statusOrder[a.properties.status as keyof typeof statusOrder] ?? 9) -
      (statusOrder[b.properties.status as keyof typeof statusOrder] ?? 9),
  );

  return (
    <div className="sg-detail-section">
      <div className="sg-detail-title">Ruta del envío (experimental)</div>

      {/* Visual route map */}
      <div className="sg-route-map">
        {sortedPorts.map((port, idx) => {
          const props = port.properties as OceanGeoJSONPointProperties;
          const isLast = idx === sortedPorts.length - 1;

          return (
            <div
              key={`${props.location.code}-${idx}`}
              className="sg-route-map-segment"
            >
              <div
                className={`sg-route-map-node sg-route-map-node--${props.status.toLowerCase()}`}
              >
                <div className="sg-route-map-dot" />
                <div className="sg-route-map-info">
                  <div className="sg-route-map-iata">
                    {props.location.code}
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

      {/* Voyage legs */}
      {legs.map((leg, idx) => {
        const props = leg.properties as OceanGeoJSONLineStringProperties;
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
                    ? "Navegando"
                    : "Pendiente"}
              </span>
              {props.vessel && (
                <span className="sg-route-leg-flight">{props.vessel.name}</span>
              )}
              {props.voyage && (
                <span className="sg-route-leg-flight">
                  Viaje {props.voyage}
                </span>
              )}
            </div>
            <div className="sg-route-leg-body">
              {props.events?.DEPA && (
                <div className="sg-route-leg-event">
                  <span className="sg-route-leg-event-label">Zarpe</span>
                  <span className="sg-route-leg-event-airport">
                    {props.events.DEPA.location.code} —{" "}
                    {props.events.DEPA.location.name}
                  </span>
                  <span className="sg-route-leg-event-time">
                    {formatDateTime(props.events.DEPA.timestamp)}
                  </span>
                </div>
              )}
              {props.events?.ARRV && (
                <div className="sg-route-leg-event">
                  <span className="sg-route-leg-event-label">Arribo</span>
                  <span className="sg-route-leg-event-airport">
                    {props.events.ARRV.location.code} —{" "}
                    {props.events.ARRV.location.name}
                  </span>
                  <span className="sg-route-leg-event-time">
                    {formatDateTime(props.events.ARRV.timestamp)}
                  </span>
                </div>
              )}
              {props.current && (
                <div className="sg-route-leg-current">
                  Posición actual del buque disponible
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default OceanShipmentRoute;
