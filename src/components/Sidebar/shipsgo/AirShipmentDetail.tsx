import { useState, useEffect } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { useAuditLog } from "../../../hooks/useAuditLog";
import { useTrackingEmailPreferences } from "../../../hooks/useTrackingEmailPreferences";
import type {
  AirShipment,
  AirShipmentDetail as AirShipmentDetailType,
  AirMovement,
} from "./types";
import {
  AIR_STATUS_LABELS,
  MOVEMENT_EVENT_LABELS,
  getStatusClass,
  formatDate,
  formatDateTime,
  getFlagUrl,
} from "./types";
import AirShipmentRoute from "./AirShipmentRoute";
import TrackingEmailSuggestions from "../../tracking/TrackingEmailSuggestions";

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";
const OPERATIONS_FOLLOWER_EMAIL = "operaciones@seemanngroup.com";
const MAX_VISIBLE_FOLLOWERS = 9;

interface AirShipmentDetailProps {
  shipment: AirShipment;
  onClose: () => void;
}

function AirShipmentDetails({ shipment, onClose }: AirShipmentDetailProps) {
  const { token } = useAuth();
  const { registrarEvento } = useAuditLog();
  const [detail, setDetail] = useState<AirShipmentDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [newFollowerEmail, setNewFollowerEmail] = useState("");
  const [followerError, setFollowerError] = useState<string | null>(null);
  const [followerLoading, setFollowerLoading] = useState(false);
  const [removingFollowerId, setRemovingFollowerId] = useState<number | null>(
    null,
  );
  const [activeSection, setActiveSection] = useState<
    "overview" | "movements" | "route" | "followers"
  >("overview");

  useEffect(() => {
    let cancelled = false;
    async function fetchDetail() {
      setDetailLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/shipsgo/shipments/${shipment.id}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setDetail(data.shipment || null);
        }
      } catch {
        // Silently fall back to basic shipment data
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [shipment.id]);

  // Use detail data if available, otherwise fallback to basic shipment
  const s = detail || shipment;
  const movements: AirMovement[] = detail?.movements || [];
  const followers = detail?.followers || [];
  const preferenceReference =
    detail?.reference || shipment.reference || undefined;
  const { emails: savedTrackingEmails } =
    useTrackingEmailPreferences(preferenceReference);
  const visibleFollowers = followers.filter(
    (item) =>
      item.email.trim().toLowerCase() !==
      OPERATIONS_FOLLOWER_EMAIL.toLowerCase(),
  );

  const handleAddFollower = async (emailOverride?: string) => {
    const follower = (emailOverride ?? newFollowerEmail).trim();

    if (!token) {
      setFollowerError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }

    if (!follower) {
      setFollowerError("Ingresa un correo electrónico para agregar.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(follower)) {
      setFollowerError("Ingresa un correo electrónico válido.");
      return;
    }

    if (
      visibleFollowers.some(
        (item) => item.email.toLowerCase() === follower.toLowerCase(),
      )
    ) {
      setFollowerError("Ese correo ya está agregado a este tracking.");
      return;
    }

    if (follower.toLowerCase() === OPERATIONS_FOLLOWER_EMAIL.toLowerCase()) {
      setFollowerError(
        "El correo de operaciones se agrega automáticamente en todos los trackings.",
      );
      return;
    }

    if (visibleFollowers.length >= MAX_VISIBLE_FOLLOWERS) {
      setFollowerError("Máximo 9 correos visibles por tracking.");
      return;
    }

    setFollowerLoading(true);
    setFollowerError(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/shipsgo/shipments/${shipment.id}/followers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ follower }),
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setFollowerError("Ese correo ya está agregado a este tracking.");
        } else {
          setFollowerError(data.error || "No se pudo agregar el correo.");
        }
        return;
      }

      setDetail((prev) =>
        prev
          ? {
              ...prev,
              followers: [...prev.followers, data.follower].filter(Boolean),
            }
          : prev,
      );
      registrarEvento({
        accion: "TRACKING_FOLLOWER_AGREGADO",
        categoria: "TRACKING",
        descripcion: `Follower agregado al tracking aéreo AWB ${shipment.awb_number}: ${follower}`,
        detalles: {
          tipo: "air",
          shipmentId: String(shipment.id),
          awb: shipment.awb_number,
          followerEmail: follower,
          referencia: shipment.reference,
        },
        clienteAfectado: shipment.reference || undefined,
      });
      setNewFollowerEmail("");
    } catch {
      setFollowerError("No se pudo agregar el correo.");
    } finally {
      setFollowerLoading(false);
    }
  };

  const handleRemoveFollower = async (followerId: number) => {
    if (!token) {
      setFollowerError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }

    setRemovingFollowerId(followerId);
    setFollowerError(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/shipsgo/shipments/${shipment.id}/followers/${followerId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFollowerError(data.error || "No se pudo eliminar el correo.");
        return;
      }

      const removedFollower = detail?.followers?.find(
        (item) => item.id === followerId,
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              followers: prev.followers.filter(
                (item) => item.id !== followerId,
              ),
            }
          : prev,
      );
      registrarEvento({
        accion: "TRACKING_FOLLOWER_ELIMINADO",
        categoria: "TRACKING",
        descripcion: `Follower eliminado del tracking aéreo AWB ${shipment.awb_number}: ${removedFollower?.email || followerId}`,
        detalles: {
          tipo: "air",
          shipmentId: String(shipment.id),
          awb: shipment.awb_number,
          followerId: String(followerId),
          followerEmail: removedFollower?.email,
          referencia: shipment.reference,
        },
        clienteAfectado: shipment.reference || undefined,
      });
    } catch {
      setFollowerError("No se pudo eliminar el correo.");
    } finally {
      setRemovingFollowerId(null);
    }
  };

  return (
    <div className="sg-modal-overlay" onClick={onClose}>
      <div className="sg-detail-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sg-detail-header">
          <div className="sg-detail-header-info">
            <div className="sg-detail-header-top">
              <span className={getStatusClass(s.status)}>
                {AIR_STATUS_LABELS[s.status] || s.status}
              </span>
              {s.status_split && (
                <span
                  className="sg-status"
                  style={{ background: "#fef3c7", color: "#92400e" }}
                >
                  Split
                </span>
              )}
            </div>
            <h2 className="sg-detail-header-awb">AWB {s.awb_number}</h2>
            <div className="sg-detail-header-meta">
              {s.airline && (
                <span>
                  {s.airline.iata} — {s.airline.name}
                </span>
              )}
              {s.reference && <span>Ref: {s.reference}</span>}
            </div>
          </div>
          <button className="sg-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Section tabs */}
        <div className="sg-detail-tabs">
          <button
            className={`sg-detail-tab ${activeSection === "overview" ? "sg-detail-tab--active" : ""}`}
            onClick={() => setActiveSection("overview")}
          >
            Resumen
          </button>
          <button
            className={`sg-detail-tab ${activeSection === "movements" ? "sg-detail-tab--active" : ""}`}
            onClick={() => setActiveSection("movements")}
          >
            Movimientos{movements.length > 0 ? ` (${movements.length})` : ""}
          </button>
          <button
            className={`sg-detail-tab ${activeSection === "route" ? "sg-detail-tab--active" : ""}`}
            onClick={() => setActiveSection("route")}
          >
            Ruta
          </button>
          <button
            className={`sg-detail-tab ${activeSection === "followers" ? "sg-detail-tab--active" : ""}`}
            onClick={() => setActiveSection("followers")}
          >
            Email
            {visibleFollowers.length > 0 ? ` (${visibleFollowers.length})` : ""}
          </button>
        </div>

        {/* Content */}
        <div className="sg-detail-content">
          {detailLoading && (
            <div className="sg-route-loading" style={{ padding: "1rem 0 0" }}>
              <div className="sg-spinner sg-spinner--small" />
              <span>Cargando detalles...</span>
            </div>
          )}

          {/* ── OVERVIEW TAB ── */}
          {activeSection === "overview" && (
            <>
              {/* Route summary */}
              {s.route && (
                <div className="sg-detail-section">
                  <div className="sg-detail-title">Ruta</div>
                  <div className="sg-route">
                    <div className="sg-route-point">
                      <div className="sg-route-point-label">Origen</div>
                      <div className="sg-route-point-iata">
                        {s.route.origin.location.iata}
                        <img
                          src={getFlagUrl(s.route.origin.location.country.code)}
                          alt=""
                          className="sg-location-flag"
                          style={{ marginLeft: "0.375rem" }}
                        />
                      </div>
                      <div className="sg-route-point-name">
                        {s.route.origin.location.name}
                      </div>
                      <div className="sg-route-point-date">
                        {formatDate(s.route.origin.date_of_dep)}
                      </div>
                    </div>
                    <div className="sg-route-center">
                      <div className="sg-route-line-visual">
                        <div
                          className="sg-route-line-fill"
                          style={{ width: `${s.route.transit_percentage}%` }}
                        />
                      </div>
                      <div className="sg-route-center-info">
                        {s.route.ts_count > 0 && (
                          <span>
                            {s.route.ts_count} escala
                            {s.route.ts_count > 1 ? "s" : ""}
                          </span>
                        )}
                        <span>{s.route.transit_time}h</span>
                      </div>
                    </div>
                    <div className="sg-route-point sg-route-point--end">
                      <div className="sg-route-point-label">Destino</div>
                      <div className="sg-route-point-iata">
                        {s.route.destination.location.iata}
                        <img
                          src={getFlagUrl(
                            s.route.destination.location.country.code,
                          )}
                          alt=""
                          className="sg-location-flag"
                          style={{ marginLeft: "0.375rem" }}
                        />
                      </div>
                      <div className="sg-route-point-name">
                        {s.route.destination.location.name}
                      </div>
                      <div className="sg-route-point-date">
                        {s.route.transit_percentage === 100 ? "" : "ETA: "}
                        {formatDate(s.route.destination.date_of_rcf)}
                      </div>
                    </div>
                  </div>
                  <div className="sg-progress-summary">
                    <div className="sg-detail-progress">
                      <div
                        className={`sg-detail-progress-fill ${s.route.transit_percentage === 100 ? "sg-detail-progress-fill--done" : ""}`}
                        style={{ width: `${s.route.transit_percentage}%` }}
                      />
                    </div>
                    <span className="sg-progress-pct-label">
                      {s.route.transit_percentage}%
                    </span>
                  </div>
                </div>
              )}

              {/* Cargo */}
              <div className="sg-detail-section">
                <div className="sg-detail-title">Carga</div>
                <div className="sg-cargo-grid">
                  <div className="sg-cargo-item">
                    <div className="sg-cargo-value">
                      {s.cargo.pieces ?? "—"}
                    </div>
                    <div className="sg-cargo-label">Piezas</div>
                  </div>
                  <div className="sg-cargo-item">
                    <div className="sg-cargo-value">
                      {s.cargo.weight ? `${s.cargo.weight} kg` : "—"}
                    </div>
                    <div className="sg-cargo-label">Peso</div>
                  </div>
                  <div className="sg-cargo-item">
                    <div className="sg-cargo-value">
                      {s.cargo.volume ? `${s.cargo.volume} m³` : "—"}
                    </div>
                    <div className="sg-cargo-label">Volumen</div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              {s.route && (
                <div className="sg-detail-section">
                  <div className="sg-detail-title">Línea de tiempo</div>
                  <div className="sg-timeline">
                    {s.route.origin.date_of_dep && (
                      <div className="sg-timeline-item sg-timeline-item--done">
                        <div className="sg-timeline-label">
                          Salida — {s.route.origin.location.iata}
                        </div>
                        <div className="sg-timeline-date">
                          {formatDateTime(s.route.origin.date_of_dep)}
                        </div>
                        {s.route.origin.date_of_dep_initial &&
                          s.route.origin.date_of_dep_initial !==
                            s.route.origin.date_of_dep && (
                            <div className="sg-timeline-initial">
                              Programado:{" "}
                              {formatDateTime(
                                s.route.origin.date_of_dep_initial,
                              )}
                            </div>
                          )}
                      </div>
                    )}
                    {s.route.transit_percentage > 0 &&
                      s.route.transit_percentage < 100 && (
                        <div className="sg-timeline-item sg-timeline-item--active">
                          <div className="sg-timeline-label">
                            En tránsito — {s.route.transit_percentage}%
                          </div>
                          <div className="sg-timeline-date">
                            Actualizado: {formatDateTime(s.updated_at)}
                          </div>
                        </div>
                      )}
                    {s.route.destination.date_of_rcf && (
                      <div
                        className={`sg-timeline-item ${
                          s.route.transit_percentage === 100
                            ? "sg-timeline-item--done"
                            : ""
                        }`}
                      >
                        <div className="sg-timeline-label">
                          {s.route.transit_percentage === 100
                            ? "Llegada"
                            : "ETA"}{" "}
                          — {s.route.destination.location.iata}
                        </div>
                        <div className="sg-timeline-date">
                          {formatDateTime(s.route.destination.date_of_rcf)}
                        </div>
                        {s.route.destination.date_of_rcf_initial &&
                          s.route.destination.date_of_rcf_initial !==
                            s.route.destination.date_of_rcf && (
                            <div className="sg-timeline-initial">
                              Programado:{" "}
                              {formatDateTime(
                                s.route.destination.date_of_rcf_initial,
                              )}
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {s.tags.length > 0 && (
                <div className="sg-detail-section">
                  <div className="sg-detail-title">Etiquetas</div>
                  <div className="sg-tags">
                    {s.tags.map((t) => (
                      <span key={t.id} className="sg-tag">
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="sg-detail-section">
                <div className="sg-detail-title">Información adicional</div>
                <div className="sg-detail-grid">
                  <div className="sg-detail-item">
                    <label>Creado</label>
                    <span>{formatDateTime(s.created_at)}</span>
                  </div>
                  <div className="sg-detail-item">
                    <label>Actualizado</label>
                    <span>{formatDateTime(s.updated_at)}</span>
                  </div>
                  <div className="sg-detail-item">
                    <label>Verificado</label>
                    <span>{formatDateTime(s.checked_at)}</span>
                  </div>
                  {s.discarded_at && (
                    <div className="sg-detail-item">
                      <label>Descartado</label>
                      <span>{formatDateTime(s.discarded_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── MOVEMENTS TAB ── */}
          {activeSection === "movements" && (
            <>
              {movements.length === 0 ? (
                <div className="sg-detail-section">
                  <div className="sg-route-empty">
                    {detailLoading
                      ? "Cargando movimientos..."
                      : "No hay movimientos registrados para este envío."}
                  </div>
                </div>
              ) : (
                <div className="sg-detail-section">
                  <div className="sg-detail-title">
                    Historial de movimientos
                  </div>
                  <div className="sg-movements">
                    {movements.map((m: AirMovement, idx: number) => (
                      <div key={idx} className="sg-movement-item">
                        <div className="sg-movement-event">
                          <span className="sg-movement-code">{m.event}</span>
                          <span className="sg-movement-label">
                            {MOVEMENT_EVENT_LABELS[m.event] || m.event}
                          </span>
                        </div>
                        <div className="sg-movement-details">
                          <div className="sg-movement-location">
                            <span className="sg-movement-iata">
                              {m.location.iata}
                            </span>
                            <img
                              src={getFlagUrl(m.location.country.code)}
                              alt=""
                              className="sg-location-flag"
                            />
                            <span className="sg-movement-airport">
                              {m.location.name}
                            </span>
                          </div>
                          <div className="sg-movement-meta">
                            <span>{formatDateTime(m.timestamp)}</span>
                            {m.flight && (
                              <span className="sg-movement-flight">
                                {m.flight}
                              </span>
                            )}
                            {m.cargo.pieces != null && (
                              <span>
                                {m.cargo.pieces} pzas · {m.cargo.weight} kg
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── ROUTE TAB ── */}
          {activeSection === "route" && (
            <AirShipmentRoute shipmentId={shipment.id} />
          )}

          {activeSection === "followers" && (
            <div className="sg-followers-panel">
              <div className="sg-followers-hero">
                <div>
                  <div className="sg-followers-eyebrow">Notificaciones</div>
                  <h3 className="sg-followers-heading">
                    Correos de seguimiento
                  </h3>
                  <p className="sg-followers-copy">
                    Administra quién recibe actualizaciones de este tracking.
                  </p>
                </div>
                <div className="sg-followers-count-card">
                  <span className="sg-followers-count-value">
                    {visibleFollowers.length}
                  </span>
                  <span className="sg-followers-count-label">activos</span>
                </div>
              </div>

              <div className="sg-followers-compose">
                <input
                  className="sg-followers-input"
                  type="email"
                  value={newFollowerEmail}
                  onChange={(e) => setNewFollowerEmail(e.target.value)}
                  placeholder="Agregar nuevo correo"
                  disabled={
                    followerLoading ||
                    visibleFollowers.length >= MAX_VISIBLE_FOLLOWERS
                  }
                />
                <button
                  className="sg-followers-add"
                  onClick={() => {
                    void handleAddFollower();
                  }}
                  disabled={
                    followerLoading ||
                    visibleFollowers.length >= MAX_VISIBLE_FOLLOWERS
                  }
                >
                  {followerLoading ? "Agregando..." : "Agregar"}
                </button>
              </div>

              <div className="sg-followers-hint">
                Puedes mantener hasta 9 correos visibles por tracking. El correo
                de operaciones se administra automáticamente.
              </div>

              {followerError && (
                <div className="sg-followers-error">{followerError}</div>
              )}

              {visibleFollowers.length > 0 ? (
                <div className="sg-followers-list sg-followers-list--cards">
                  {visibleFollowers.map((follower) => (
                    <div key={follower.id} className="sg-follower-card">
                      <div className="sg-follower-avatar">
                        {follower.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="sg-follower-meta">
                        <span className="sg-follower-email">
                          {follower.email}
                        </span>
                        <span className="sg-follower-status">
                          Notificación activa
                        </span>
                      </div>
                      <button
                        className="sg-follower-remove"
                        onClick={() => handleRemoveFollower(follower.id)}
                        disabled={removingFollowerId === follower.id}
                      >
                        {removingFollowerId === follower.id
                          ? "Eliminando..."
                          : "Quitar"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sg-followers-empty sg-followers-empty--panel">
                  Aún no agregas correos visibles para este tracking.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sg-modal-footer">
          <button className="sg-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default AirShipmentDetails;
