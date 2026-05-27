// src/components/administrador/HomeOperaciones.tsx — Torre de Control de Operaciones
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type {
  AirShipment,
  AirResponse,
  OceanShipment,
  OceanResponse,
} from "../Sidebar/shipsgo/types";
import {
  AIR_STATUS_LABELS,
  OCEAN_STATUS_LABELS,
  formatDate,
  getFlagUrl,
} from "../Sidebar/shipsgo/types";
import AirShipmentDetail from "../Sidebar/shipsgo/AirShipmentDetail";
import OceanShipmentDetail from "../Sidebar/shipsgo/OceanShipmentDetail";
import ShipsGoTrackingAdminOP from "./Shipsgo/OP-trackeo";
import "../Sidebar/styles/Shipsgotracking.css";
import "./HomeOperaciones.css";

// ═══════════════════════════════════════════════════════════════════════════
// Modal types
// ═══════════════════════════════════════════════════════════════════════════

type ListModalType =
  | null
  | "all-shipments"
  | "all-clients"
  | "kpi-total"
  | "kpi-active"
  | "kpi-air-transit"
  | "kpi-ocean-transit"
  | "kpi-completed"
  | "kpi-delayed"
  | "kpi-clients";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface ClientUser {
  id: string;
  email: string;
  username: string;
  nombreuser?: string;
  usernames?: string[];
  createdAt: string;
}

interface ClientShipmentCount {
  username: string;
  nombreuser?: string;
  air: number;
  ocean: number;
  total: number;
}

function normalizeClientSearch(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function clientMatchesSearch(client: ClientUser, query: string): boolean {
  if (!query) return true;

  return [
    client.username,
    client.email,
    client.nombreuser,
    ...(client.usernames || []),
  ]
    .filter(Boolean)
    .some((value) => normalizeClientSearch(value).includes(query));
}

function shipmentMatchesClientSearch(
  reference: string | undefined,
  query: string,
  matchingUsernames: Set<string>,
): boolean {
  if (!query) return true;

  const normalizedReference = normalizeClientSearch(reference);
  if (normalizedReference.includes(query)) return true;

  return reference ? matchingUsernames.has(reference) : false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function isAirDelayed(s: AirShipment): boolean {
  if (!s.route) return false;
  const { transit_percentage } = s.route;
  const eta = s.route.destination.date_of_rcf;
  if (!eta || transit_percentage >= 100) return false;
  // Only in-transit shipments can be delayed (not LANDED/DELIVERED)
  if (s.status === "LANDED" || s.status === "DELIVERED") return false;
  return new Date(s.updated_at) >= new Date(eta) && transit_percentage < 100;
}

function isOceanDelayed(s: OceanShipment): boolean {
  if (!s.route) return false;
  const { transit_percentage } = s.route;
  const eta = s.route.port_of_discharge.date_of_discharge;
  if (!eta || transit_percentage >= 100) return false;
  // Only sailing/in-transit shipments can be delayed (not ARRIVED/DISCHARGED)
  if (s.status === "ARRIVED" || s.status === "DISCHARGED") return false;
  return new Date(s.updated_at) >= new Date(eta) && transit_percentage < 100;
}

function isAirInTransit(s: AirShipment): boolean {
  return s.status === "EN_ROUTE" || s.status === "BOOKED";
}

function isAirCompleted(s: AirShipment): boolean {
  return s.status === "LANDED" || s.status === "DELIVERED";
}

function isOceanInTransit(s: OceanShipment): boolean {
  return (
    s.status === "SAILING" ||
    s.status === "LOADED" ||
    s.status === "BOOKED" ||
    s.status === "NEW" ||
    s.status === "INPROGRESS"
  );
}

function isOceanCompleted(s: OceanShipment): boolean {
  return s.status === "ARRIVED" || s.status === "DISCHARGED";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getToday(): string {
  return new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function SkeletonMetricStrip() {
  return (
    <div className="ops-metrics-strip" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="ops-metrics-strip__item" key={index}>
          <div
            className="ops-skeleton"
            style={{ width: "52%", height: 11, marginBottom: 10 }}
          />
          <div
            className="ops-skeleton"
            style={{ width: "34%", height: 20, marginBottom: 6 }}
          />
          <div className="ops-skeleton" style={{ width: "68%", height: 11 }} />
        </div>
      ))}
    </div>
  );
}

/** SVG donut chart for status distribution */
function DonutChart({
  segments,
  size = 110,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="#f1f3f8"
          strokeWidth="4"
        />
        <text
          x="18"
          y="20"
          textAnchor="middle"
          fontSize="7"
          fill="#b1b8c9"
          fontWeight="700"
        >
          0
        </text>
      </svg>
    );
  }
  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      {segments
        .filter((s) => s.value > 0)
        .map((seg, i) => {
          const pct = (seg.value / total) * 100;
          const offset = 100 - cumulative + 25; // 25 = start from top
          cumulative += pct;
          return (
            <circle
              key={i}
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke={seg.color}
              strokeWidth="4"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            />
          );
        })}
      <text
        x="18"
        y="20"
        textAnchor="middle"
        fontSize="8"
        fill="#1a1a2e"
        fontWeight="700"
      >
        {total}
      </text>
    </svg>
  );
}

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="ops-status-row">
      <span className="ops-status-row__label">{label}</span>
      <div className="ops-status-row__bar-wrap">
        <div
          className="ops-status-row__bar"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="ops-status-row__count">{count}</span>
    </div>
  );
}

function getAirBadgeClass(status: string): string {
  if (status === "EN_ROUTE") return "ops-badge--transit";
  if (status === "LANDED" || status === "DELIVERED")
    return "ops-badge--delivered";
  if (status === "BOOKED") return "ops-badge--booked";
  return "ops-badge--other";
}

function getOceanBadgeClass(status: string): string {
  if (status === "SAILING") return "ops-badge--sailing";
  if (status === "ARRIVED" || status === "DISCHARGED")
    return "ops-badge--delivered";
  if (status === "LOADED" || status === "BOOKED") return "ops-badge--booked";
  return "ops-badge--other";
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="ops-progress">
      <div className="ops-progress__track">
        <div
          className="ops-progress__fill"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="ops-progress__text">{value}%</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function HomeOperaciones() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Data state
  const [allAir, setAllAir] = useState<AirShipment[]>([]);
  const [allOcean, setAllOcean] = useState<OceanShipment[]>([]);
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipmentTab, setShipmentTab] = useState<"air" | "ocean">("air");

  // Modal state
  const [selectedAir, setSelectedAir] = useState<AirShipment | null>(null);
  const [selectedOcean, setSelectedOcean] = useState<OceanShipment | null>(
    null,
  );
  const [listModal, setListModal] = useState<ListModalType>(null);
  const [listModalTab, setListModalTab] = useState<"air" | "ocean" | "all">(
    "all",
  );
  const [showCreateTrackingModal, setShowCreateTrackingModal] = useState(false);

  // Auto-open modal when navigated from a notification (router state)
  const location = useLocation();
  useEffect(() => {
    const s = (location.state as any) || null;
    if (s && typeof s === "object" && s.openModal) {
      setListModal(s.openModal as ListModalType);
      if (
        s.modalTab &&
        (s.modalTab === "air" || s.modalTab === "ocean" || s.modalTab === "all")
      ) {
        setListModalTab(s.modalTab);
      }
      window.history.replaceState({}, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const displayName = user?.nombreuser || user?.username || "Operaciones";

  // ── Data fetching ───────────────────────────────────────────────────────
  const fetchData = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const [airRes, oceanRes, clientsRes] = await Promise.allSettled([
          fetch("/api/shipsgo/shipments", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json() as Promise<AirResponse>),
          fetch("/api/shipsgo/ocean/shipments", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json() as Promise<OceanResponse>),
          fetch("/api/admin/users", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()),
        ]);

        if (
          airRes.status === "fulfilled" &&
          Array.isArray(airRes.value?.shipments)
        ) {
          setAllAir(airRes.value.shipments);
        }
        if (
          oceanRes.status === "fulfilled" &&
          Array.isArray(oceanRes.value?.shipments)
        ) {
          setAllOcean(oceanRes.value.shipments);
        }
        if (clientsRes.status === "fulfilled") {
          const raw = clientsRes.value;
          const arr: ClientUser[] = Array.isArray(raw?.users)
            ? raw.users
            : Array.isArray(raw)
              ? raw
              : [];
          setClients(arr.filter((u: ClientUser) => u.username !== "Ejecutivo"));
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Computed stats ──────────────────────────────────────────────────────

  // Air stats
  const airInTransit = useMemo(() => allAir.filter(isAirInTransit), [allAir]);
  const airCompleted = useMemo(() => allAir.filter(isAirCompleted), [allAir]);
  const airDelayed = useMemo(() => allAir.filter(isAirDelayed), [allAir]);

  // Ocean stats
  const oceanInTransit = useMemo(
    () => allOcean.filter(isOceanInTransit),
    [allOcean],
  );
  const oceanCompleted = useMemo(
    () => allOcean.filter(isOceanCompleted),
    [allOcean],
  );
  const oceanDelayed = useMemo(
    () => allOcean.filter(isOceanDelayed),
    [allOcean],
  );

  // Total active = air in-transit + ocean in-transit
  const totalActive = airInTransit.length + oceanInTransit.length;
  const totalCompleted = airCompleted.length + oceanCompleted.length;
  const totalDelayed = airDelayed.length + oceanDelayed.length;
  const totalTrackings = allAir.length + allOcean.length;
  const overviewMetrics = [
    {
      id: "total",
      label: "Total",
      value: totalTrackings,
      subtext: `${allAir.length} aéreos · ${allOcean.length} marítimos`,
      onClick: () => {
        setListModal("kpi-total");
        setListModalTab("all");
      },
    },
    {
      id: "active",
      label: "En movimiento",
      value: totalActive,
      subtext: `${airInTransit.length} aéreos · ${oceanInTransit.length} marítimos`,
      onClick: () => {
        setListModal("kpi-active");
        setListModalTab("all");
      },
    },
    {
      id: "completed",
      label: "Completados",
      value: totalCompleted,
      subtext: `${airCompleted.length} aterrizados · ${oceanCompleted.length} arribados`,
      onClick: () => {
        setListModal("kpi-completed");
        setListModalTab("all");
      },
    },
    {
      id: "delayed",
      label: "Retrasos",
      value: totalDelayed,
      subtext: `${airDelayed.length} aéreos · ${oceanDelayed.length} marítimos`,
      onClick: () => {
        setListModal("kpi-delayed");
        setListModalTab("all");
      },
    },
  ];

  // Air status distribution
  const airStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    allAir.forEach((s) => {
      map[s.status] = (map[s.status] || 0) + 1;
    });
    return map;
  }, [allAir]);

  // Ocean status distribution
  const oceanStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    allOcean.forEach((s) => {
      map[s.status] = (map[s.status] || 0) + 1;
    });
    return map;
  }, [allOcean]);

  // Client ranking by shipment count
  const clientRanking = useMemo<ClientShipmentCount[]>(() => {
    const map = new Map<string, ClientShipmentCount>();
    clients.forEach((c) => {
      const usernames = c.usernames?.length ? c.usernames : [c.username];
      let air = 0;
      let ocean = 0;
      usernames.forEach((u) => {
        air += allAir.filter((s) => s.reference === u).length;
        ocean += allOcean.filter((s) => s.reference === u).length;
      });
      if (air + ocean > 0) {
        map.set(c.username, {
          username: c.username,
          nombreuser: c.nombreuser,
          air,
          ocean,
          total: air + ocean,
        });
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [clients, allAir, allOcean]);

  // Recent shipments (last 10 created)
  const recentAir = useMemo(
    () =>
      [...allAir]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 8),
    [allAir],
  );

  const recentOcean = useMemo(
    () =>
      [...allOcean]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 8),
    [allOcean],
  );

  // Route & carrier statistics
  const airRouteStats = useMemo(() => {
    const map: Record<string, number> = {};
    allAir.forEach((s) => {
      const o = s.route?.origin.location.iata;
      const d = s.route?.destination.location.iata;
      if (o && d) {
        const key = `${o} → ${d}`;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allAir]);

  const airAirlineStats = useMemo(() => {
    const map: Record<string, number> = {};
    allAir.forEach((s) => {
      const name = s.airline?.name;
      if (name) map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allAir]);

  const oceanRouteStats = useMemo(() => {
    const map: Record<string, number> = {};
    allOcean.forEach((s) => {
      const o = s.route?.port_of_loading.location.name;
      const d = s.route?.port_of_discharge.location.name;
      if (o && d) {
        const key = `${o} → ${d}`;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allOcean]);

  const oceanCarrierStats = useMemo(() => {
    const map: Record<string, number> = {};
    allOcean.forEach((s) => {
      const name = s.carrier?.name;
      if (name) map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allOcean]);

  // ── Donut segments ──────────────────────────────────────────────────────
  const airDonutSegments = useMemo(
    () => [
      {
        value: airStatusDist["EN_ROUTE"] || 0,
        color: "#0891b2",
        label: "En Tránsito",
      },
      {
        value:
          (airStatusDist["LANDED"] || 0) + (airStatusDist["DELIVERED"] || 0),
        color: "#059669",
        label: "Completado",
      },
      {
        value: airStatusDist["BOOKED"] || 0,
        color: "#7c3aed",
        label: "Reservado",
      },
      {
        value:
          (airStatusDist["UNTRACKED"] || 0) +
          (airStatusDist["DISCARDED"] || 0) +
          (airStatusDist["INPROGRESS"] || 0),
        color: "#cbd5e1",
        label: "Otros",
      },
    ],
    [airStatusDist],
  );

  const oceanDonutSegments = useMemo(
    () => [
      {
        value: oceanStatusDist["SAILING"] || 0,
        color: "#2563eb",
        label: "Navegando",
      },
      {
        value:
          (oceanStatusDist["ARRIVED"] || 0) +
          (oceanStatusDist["DISCHARGED"] || 0),
        color: "#059669",
        label: "Completado",
      },
      {
        value:
          (oceanStatusDist["LOADED"] || 0) + (oceanStatusDist["BOOKED"] || 0),
        color: "#7c3aed",
        label: "Cargado/Reservado",
      },
      {
        value:
          (oceanStatusDist["NEW"] || 0) +
          (oceanStatusDist["INPROGRESS"] || 0) +
          (oceanStatusDist["UNTRACKED"] || 0),
        color: "#cbd5e1",
        label: "Otros",
      },
    ],
    [oceanStatusDist],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="ops-home">
        <div className="ops-header">
          <div className="ops-header__left">
            <h1>
              {getGreeting()}, <span>{displayName}</span>
            </h1>
            <p>{getToday()}</p>
          </div>
        </div>
        <SkeletonMetricStrip />
      </div>
    );
  }

  return (
    <div className="ops-home">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="ops-header">
        <div className="ops-header__left">
          <h1>
            {getGreeting()}, <span>{displayName}</span>
          </h1>
          <p>{getToday()}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="ops-refresh-btn"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? "spinning" : ""}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Actualizar
          </button>
          <div className="ops-header__badge">
            <div className="ops-pulse" />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Torre de Control
          </div>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <div className="ops-quick-actions-section">
        <span className="ops-quick-actions-label">Acceso rápido</span>
        <div className="ops-quick-actions">
          <button
            className="ops-quick-action"
            onClick={() => setShowCreateTrackingModal(true)}
          >
            Nuevo Seguimiento
          </button>
          <button
            className="ops-quick-action"
            onClick={() => navigate("/admin/op-trackeos")}
          >
            Rastreo de envíos
          </button>
          <button
            className="ops-quick-action"
            onClick={() => navigate("/admin/op-reporteriaclientes")}
          >
            Todos los clientes
          </button>
          <button
            className="ops-quick-action"
            onClick={() => navigate("/admin/op-documentacion")}
          >
            Documentación
          </button>
          <button
            className="ops-quick-action"
            onClick={() => navigate("/admin/cotizador-administrador")}
          >
            Cotizador
          </button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="ops-metrics-strip">
        {overviewMetrics.map((metric) => (
          <div
            key={metric.id}
            className="ops-metrics-strip__item ops-metrics-strip__item--clickable"
            onClick={metric.onClick}
          >
            <span className="ops-metrics-strip__label">{metric.label}</span>
            <span className="ops-metrics-strip__value">{metric.value}</span>
            <span className="ops-metrics-strip__sub">{metric.subtext}</span>
          </div>
        ))}
      </div>

      {/* ── Delay Banner ──────────────────────────────────────────────────── */}
      {totalDelayed > 0 && (
        <div
          className="ops-delay-banner"
          onClick={() => {
            setListModal("kpi-delayed");
            setListModalTab("all");
          }}
        >
          <span className="ops-delay-banner__icon">⚠</span>
          <span className="ops-delay-banner__msg">
            <strong>{totalDelayed}</strong> envío
            {totalDelayed !== 1 ? "s" : ""} con retraso activo
          </span>
          <span className="ops-delay-banner__meta">
            {airDelayed.length > 0 &&
              `${airDelayed.length} aéreo${airDelayed.length !== 1 ? "s" : ""}`}
            {airDelayed.length > 0 && oceanDelayed.length > 0 && " · "}
            {oceanDelayed.length > 0 &&
              `${oceanDelayed.length} marítimo${oceanDelayed.length !== 1 ? "s" : ""}`}
          </span>
          <span className="ops-delay-banner__cta">Ver detalles →</span>
        </div>
      )}

      {/* ── Distribución de Seguimientos ─────────────────────────────────── */}
      <div className="ops-section">
        <div className="ops-section-header">
          <h3 className="ops-section-title" style={{ margin: 0 }}>
            Distribución de Seguimientos
          </h3>
        </div>
        <div className="ops-grid-2">
          {/* Air status donut & bars */}
          <div className="ops-panel">
            <h3 className="ops-section-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--secondary-color)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
              </svg>
              Distribución Aérea
            </h3>
            <div className="ops-donut-wrap">
              <DonutChart segments={airDonutSegments} />
              <div className="ops-donut-legend">
                {airDonutSegments
                  .filter((s) => s.value > 0)
                  .map((seg) => (
                    <div key={seg.label} className="ops-donut-legend__item">
                      <span
                        className="ops-donut-legend__dot"
                        style={{ background: seg.color }}
                      />
                      {seg.label}
                      <span className="ops-donut-legend__value">
                        {seg.value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="ops-status-grid">
              <StatusBar
                label="En Tránsito"
                count={airStatusDist["EN_ROUTE"] || 0}
                total={allAir.length}
                color="#0891b2"
              />
              <StatusBar
                label="Aterrizado"
                count={airStatusDist["LANDED"] || 0}
                total={allAir.length}
                color="#059669"
              />
              <StatusBar
                label="Entregado"
                count={airStatusDist["DELIVERED"] || 0}
                total={allAir.length}
                color="#22c55e"
              />
              <StatusBar
                label="Reservado"
                count={airStatusDist["BOOKED"] || 0}
                total={allAir.length}
                color="#7c3aed"
              />
              {(airStatusDist["UNTRACKED"] || 0) > 0 && (
                <StatusBar
                  label="Sin Rastreo"
                  count={airStatusDist["UNTRACKED"] || 0}
                  total={allAir.length}
                  color="#94a3b8"
                />
              )}
            </div>
          </div>

          {/* Ocean status donut & bars */}
          <div className="ops-panel">
            <h3 className="ops-section-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--secondary-color)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 20a2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1" />
                <path d="M4 18l-1-5h18l-1 5" />
                <path d="M12 2v7" />
                <path d="M7 9h10" />
              </svg>
              Distribución Marítima
            </h3>
            <div className="ops-donut-wrap">
              <DonutChart segments={oceanDonutSegments} />
              <div className="ops-donut-legend">
                {oceanDonutSegments
                  .filter((s) => s.value > 0)
                  .map((seg) => (
                    <div key={seg.label} className="ops-donut-legend__item">
                      <span
                        className="ops-donut-legend__dot"
                        style={{ background: seg.color }}
                      />
                      {seg.label}
                      <span className="ops-donut-legend__value">
                        {seg.value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="ops-status-grid">
              <StatusBar
                label="Navegando"
                count={oceanStatusDist["SAILING"] || 0}
                total={allOcean.length}
                color="#2563eb"
              />
              <StatusBar
                label="Llegó"
                count={oceanStatusDist["ARRIVED"] || 0}
                total={allOcean.length}
                color="#059669"
              />
              <StatusBar
                label="Descargado"
                count={oceanStatusDist["DISCHARGED"] || 0}
                total={allOcean.length}
                color="#22c55e"
              />
              <StatusBar
                label="Cargado"
                count={oceanStatusDist["LOADED"] || 0}
                total={allOcean.length}
                color="#7c3aed"
              />
              {(oceanStatusDist["UNTRACKED"] || 0) > 0 && (
                <StatusBar
                  label="Sin Rastreo"
                  count={oceanStatusDist["UNTRACKED"] || 0}
                  total={allOcean.length}
                  color="#94a3b8"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Últimos Movimientos ────────────────────────────────────────────── */}
      <div className="ops-section">
        <div className="ops-section-header">
          <h3 className="ops-section-title" style={{ margin: 0 }}>
            Últimos Movimientos
          </h3>
          <button
            className="ops-view-all"
            onClick={() => {
              setListModal("all-shipments");
              setListModalTab("all");
            }}
          >
            Ver todos →
          </button>
        </div>
        <div className="ops-panel">
          {/* Tabs */}
          <div className="ops-tabs">
            <button
              className={`ops-tab ${shipmentTab === "air" ? "ops-tab--active" : ""}`}
              onClick={() => setShipmentTab("air")}
            >
              ✈ Aéreos ({allAir.length})
            </button>
            <button
              className={`ops-tab ${shipmentTab === "ocean" ? "ops-tab--active" : ""}`}
              onClick={() => setShipmentTab("ocean")}
            >
              🚢 Marítimos ({allOcean.length})
            </button>
          </div>

          {shipmentTab === "air" ? (
            recentAir.length === 0 ? (
              <div className="ops-empty">
                No hay seguimientos aéreos registrados.
              </div>
            ) : (
              <table className="ops-mini-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>AWB</th>
                    <th>Aerolínea</th>
                    <th>Ruta</th>
                    <th>Cliente</th>
                    <th>Progreso</th>
                    <th>ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAir.map((s) => {
                    const delayed = isAirDelayed(s);
                    return (
                      <tr
                        key={s.id}
                        className="ops-clickable-row"
                        onClick={() => setSelectedAir(s)}
                      >
                        <td>
                          <span
                            className={`ops-badge ${delayed ? "ops-badge--delayed" : getAirBadgeClass(s.status)}`}
                          >
                            {delayed
                              ? "⚠ Retraso"
                              : AIR_STATUS_LABELS[s.status] || s.status}
                          </span>
                        </td>
                        <td
                          style={{
                            fontWeight: 600,
                            fontFamily: "monospace",
                            fontSize: 11,
                          }}
                        >
                          {s.awb_number}
                        </td>
                        <td>{s.airline?.name || "—"}</td>
                        <td>
                          {s.route?.origin.location.country.code && (
                            <img
                              src={getFlagUrl(
                                s.route.origin.location.country.code,
                              )}
                              alt=""
                              className="ops-flag"
                            />
                          )}
                          {s.route?.origin.location.iata || "—"}
                          {" → "}
                          {s.route?.destination.location.country.code && (
                            <img
                              src={getFlagUrl(
                                s.route.destination.location.country.code,
                              )}
                              alt=""
                              className="ops-flag"
                            />
                          )}
                          {s.route?.destination.location.iata || "—"}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {s.reference || "—"}
                        </td>
                        <td style={{ minWidth: 100 }}>
                          <ProgressBar
                            value={s.route?.transit_percentage ?? 0}
                            color={delayed ? "#dc2626" : "#0891b2"}
                          />
                        </td>
                        <td style={{ fontSize: 11, color: "#8b92a5" }}>
                          {formatDate(s.route?.destination.date_of_rcf)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : recentOcean.length === 0 ? (
            <div className="ops-empty">
              No hay seguimientos marítimos registrados.
            </div>
          ) : (
            <table className="ops-mini-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Container / Booking</th>
                  <th>Naviera</th>
                  <th>Ruta</th>
                  <th>Cliente</th>
                  <th>Progreso</th>
                  <th>ETA</th>
                </tr>
              </thead>
              <tbody>
                {recentOcean.map((s) => {
                  const delayed = isOceanDelayed(s);
                  return (
                    <tr
                      key={s.id}
                      className="ops-clickable-row"
                      onClick={() => setSelectedOcean(s)}
                    >
                      <td>
                        <span
                          className={`ops-badge ${delayed ? "ops-badge--delayed" : getOceanBadgeClass(s.status)}`}
                        >
                          {delayed
                            ? "⚠ Retraso"
                            : OCEAN_STATUS_LABELS[s.status] || s.status}
                        </span>
                      </td>
                      <td
                        style={{
                          fontWeight: 600,
                          fontFamily: "monospace",
                          fontSize: 11,
                        }}
                      >
                        {s.container_number || s.booking_number || "—"}
                      </td>
                      <td>{s.carrier?.name || "—"}</td>
                      <td>
                        {s.route?.port_of_loading.location.country?.code && (
                          <img
                            src={getFlagUrl(
                              s.route.port_of_loading.location.country.code,
                            )}
                            alt=""
                            className="ops-flag"
                          />
                        )}
                        {s.route?.port_of_loading.location.name || "—"}
                        {" → "}
                        {s.route?.port_of_discharge.location.country?.code && (
                          <img
                            src={getFlagUrl(
                              s.route.port_of_discharge.location.country.code,
                            )}
                            alt=""
                            className="ops-flag"
                          />
                        )}
                        {s.route?.port_of_discharge.location.name || "—"}
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.reference || "—"}</td>
                      <td style={{ minWidth: 100 }}>
                        <ProgressBar
                          value={s.route?.transit_percentage ?? 0}
                          color={delayed ? "#dc2626" : "#2563eb"}
                        />
                      </td>
                      <td style={{ fontSize: 11, color: "#8b92a5" }}>
                        {formatDate(
                          s.route?.port_of_discharge.date_of_discharge,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Reportería de Movimientos ─────────────────────────────────────── */}
      <div className="ops-section">
        <div className="ops-section-header">
          <h3 className="ops-section-title" style={{ margin: 0 }}>
            Reportería de Movimientos
          </h3>
        </div>
        <div className="ops-panel">
          <div className="ops-report-grid">
            {/* Rutas Aéreas más usadas */}
            <div className="ops-report-stat">
              <div
                className="ops-report-stat__label"
                style={{ color: "var(--secondary-color)" }}
              >
                Rutas Aéreas más usadas
              </div>
              {airRouteStats.length === 0 ? (
                <div className="ops-empty">Sin datos.</div>
              ) : (
                airRouteStats.map(([route, count], i) => {
                  const pct =
                    airRouteStats[0][1] > 0
                      ? (count / airRouteStats[0][1]) * 100
                      : 0;
                  return (
                    <div key={route} className="ops-report-item">
                      <span className="ops-report-item__name">
                        {i === 0 ? "1° " : `${i + 1}. `}
                        {route}
                      </span>
                      <div className="ops-report-item__bar-wrap">
                        <div
                          className="ops-report-item__bar"
                          style={{
                            width: `${pct}%`,
                            background: "var(--ops-cyan)",
                          }}
                        />
                      </div>
                      <span
                        className="ops-report-item__count"
                        style={{ color: "var(--ops-cyan)" }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Aerolíneas más usadas */}
            <div className="ops-report-stat">
              <div
                className="ops-report-stat__label"
                style={{ color: "var(--secondary-color)" }}
              >
                Aerolíneas más usadas
              </div>
              {airAirlineStats.length === 0 ? (
                <div className="ops-empty">Sin datos.</div>
              ) : (
                airAirlineStats.map(([airline, count], i) => {
                  const pct =
                    airAirlineStats[0][1] > 0
                      ? (count / airAirlineStats[0][1]) * 100
                      : 0;
                  return (
                    <div key={airline} className="ops-report-item">
                      <span className="ops-report-item__name">
                        {i === 0 ? "1° " : `${i + 1}. `}
                        {airline}
                      </span>
                      <div className="ops-report-item__bar-wrap">
                        <div
                          className="ops-report-item__bar"
                          style={{
                            width: `${pct}%`,
                            background: "var(--ops-cyan)",
                          }}
                        />
                      </div>
                      <span
                        className="ops-report-item__count"
                        style={{ color: "var(--ops-cyan)" }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rutas Marítimas más usadas */}
            <div className="ops-report-stat">
              <div
                className="ops-report-stat__label"
                style={{ color: "var(--secondary-color)" }}
              >
                Rutas Marítimas más usadas
              </div>
              {oceanRouteStats.length === 0 ? (
                <div className="ops-empty">Sin datos.</div>
              ) : (
                oceanRouteStats.map(([route, count], i) => {
                  const pct =
                    oceanRouteStats[0][1] > 0
                      ? (count / oceanRouteStats[0][1]) * 100
                      : 0;
                  return (
                    <div key={route} className="ops-report-item">
                      <span className="ops-report-item__name">
                        {i === 0 ? "1° " : `${i + 1}. `}
                        {route}
                      </span>
                      <div className="ops-report-item__bar-wrap">
                        <div
                          className="ops-report-item__bar"
                          style={{
                            width: `${pct}%`,
                            background: "var(--ops-blue)",
                          }}
                        />
                      </div>
                      <span
                        className="ops-report-item__count"
                        style={{ color: "var(--ops-blue)" }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Navieras más usadas */}
            <div className="ops-report-stat">
              <div
                className="ops-report-stat__label"
                style={{ color: "var(--secondary-color)" }}
              >
                Navieras más usadas
              </div>
              {oceanCarrierStats.length === 0 ? (
                <div className="ops-empty">Sin datos.</div>
              ) : (
                oceanCarrierStats.map(([carrier, count], i) => {
                  const pct =
                    oceanCarrierStats[0][1] > 0
                      ? (count / oceanCarrierStats[0][1]) * 100
                      : 0;
                  return (
                    <div key={carrier} className="ops-report-item">
                      <span className="ops-report-item__name">
                        {i === 0 ? "1° " : `${i + 1}. `}
                        {carrier}
                      </span>
                      <div className="ops-report-item__bar-wrap">
                        <div
                          className="ops-report-item__bar"
                          style={{
                            width: `${pct}%`,
                            background: "var(--ops-blue)",
                          }}
                        />
                      </div>
                      <span
                        className="ops-report-item__count"
                        style={{ color: "var(--ops-blue)" }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Client Ranking ─────────────────────────────────────── */}
      <div className="ops-grid-3">
        {/* Client Ranking */}
        <div className="ops-panel">
          <div className="ops-section-header" style={{ marginBottom: 14 }}>
            <h3 className="ops-section-title" style={{ margin: 0 }}>
              Clientes con más seguimientos
            </h3>
            <button
              className="ops-view-all"
              onClick={() => setListModal("all-clients")}
            >
              Ver todos →
            </button>
          </div>
          {clientRanking.length === 0 ? (
            <div className="ops-empty">Sin datos de clientes.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {clientRanking.map((c, i) => (
                <div key={c.username} className="ops-client-row">
                  <span
                    className="ops-client-row__rank"
                    style={
                      i === 0
                        ? {}
                        : i === 1
                          ? { background: "#64748b" }
                          : i === 2
                            ? { background: "#94a3b8" }
                            : { background: "#cbd5e1", color: "#64748b" }
                    }
                  >
                    {i + 1}
                  </span>
                  <span className="ops-client-row__name">{c.username}</span>
                  <span style={{ fontSize: 11, color: "#8b92a5" }}>
                    ✈{c.air} 🚢{c.ocean}
                  </span>
                  <span className="ops-client-row__count">{c.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Operations Summary Card */}
        <div className="ops-panel">
          <h3 className="ops-section-title">Resumen Operativo</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Air summary row */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--ops-border)",
                background: "#fafbfc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--secondary-color)",
                  }}
                >
                  Carga Aérea
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--ops-text)",
                  }}
                >
                  {allAir.length}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <MiniStat
                  label="Volando"
                  value={airInTransit.length}
                  color="var(--ops-cyan)"
                />
                <MiniStat
                  label="Completado"
                  value={airCompleted.length}
                  color="var(--ops-green)"
                />
                {airDelayed.length > 0 && (
                  <MiniStat
                    label="Retraso"
                    value={airDelayed.length}
                    color="var(--ops-red)"
                  />
                )}
              </div>
            </div>

            {/* Ocean summary row */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--ops-border)",
                background: "#fafbfc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--secondary-color)",
                  }}
                >
                  Carga Marítima
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--ops-text)",
                  }}
                >
                  {allOcean.length}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <MiniStat
                  label="Navegando"
                  value={oceanInTransit.length}
                  color="var(--ops-blue)"
                />
                <MiniStat
                  label="Completado"
                  value={oceanCompleted.length}
                  color="var(--ops-green)"
                />
                {oceanDelayed.length > 0 && (
                  <MiniStat
                    label="Retraso"
                    value={oceanDelayed.length}
                    color="var(--ops-red)"
                  />
                )}
              </div>
            </div>

            {/* Health indicator */}
            <div
              style={{
                padding: "14px",
                borderRadius: 10,
                background:
                  totalDelayed === 0
                    ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
                    : totalDelayed <= 3
                      ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                      : "linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>
                {totalDelayed === 0 ? "✅" : totalDelayed <= 3 ? "⚠️" : "🚨"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ops-text)",
                }}
              >
                {totalDelayed === 0
                  ? "Sin Retrasos"
                  : totalDelayed <= 3
                    ? "Retrasos Moderados"
                    : "Atención Requerida"}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ops-text-muted)",
                  marginTop: 2,
                }}
              >
                {totalDelayed === 0
                  ? "Todas las cargas están en tiempo"
                  : `${totalDelayed} envío${totalDelayed !== 1 ? "s" : ""} con retraso activo`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Individual shipment detail modals */}
      {selectedAir && (
        <AirShipmentDetail
          shipment={selectedAir}
          onClose={() => setSelectedAir(null)}
        />
      )}
      {selectedOcean && (
        <OceanShipmentDetail
          shipment={selectedOcean}
          onClose={() => setSelectedOcean(null)}
        />
      )}

      {/* List modal (shipments / clients / KPI drill-down) */}
      {listModal && (
        <ListModal
          type={listModal}
          tab={listModalTab}
          onTabChange={setListModalTab}
          onClose={() => setListModal(null)}
          clients={clients}
          allAir={allAir}
          allOcean={allOcean}
          airInTransit={airInTransit}
          oceanInTransit={oceanInTransit}
          airCompleted={airCompleted}
          oceanCompleted={oceanCompleted}
          airDelayed={airDelayed}
          oceanDelayed={oceanDelayed}
          clientRanking={clientRanking}
          onSelectAir={(s) => {
            setListModal(null);
            setSelectedAir(s);
          }}
          onSelectOcean={(s) => {
            setListModal(null);
            setSelectedOcean(s);
          }}
        />
      )}

      {showCreateTrackingModal && (
        <div
          className="ops-list-overlay"
          onClick={() => setShowCreateTrackingModal(false)}
        >
          <div
            className="ops-list-modal ops-list-modal--tracking"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ops-list-modal__header">
              <div>
                <h2 className="ops-list-modal__title">
                  Generar nuevo seguimiento
                </h2>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ops-text-muted)",
                    marginTop: 4,
                  }}
                >
                  Reutiliza el flujo de OP Trackeo para seleccionar cliente y
                  crear un nuevo tracking.
                </div>
              </div>
              <button
                className="ops-list-modal__close"
                onClick={() => setShowCreateTrackingModal(false)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="ops-list-modal__body ops-list-modal__body--tracking">
              <ShipsGoTrackingAdminOP />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small stat pill
function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 6,
        background: "white",
        border: "1px solid var(--ops-border)",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <span style={{ color }}>{value}</span>
      <span style={{ color: "var(--ops-text-muted)" }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ListModal — Full-list overlay for shipments / clients / KPI drill-down
// ═══════════════════════════════════════════════════════════════════════════

interface ListModalProps {
  type: NonNullable<ListModalType>;
  tab: "air" | "ocean" | "all";
  onTabChange: (t: "air" | "ocean" | "all") => void;
  onClose: () => void;
  clients: ClientUser[];
  allAir: AirShipment[];
  allOcean: OceanShipment[];
  airInTransit: AirShipment[];
  oceanInTransit: OceanShipment[];
  airCompleted: AirShipment[];
  oceanCompleted: OceanShipment[];
  airDelayed: AirShipment[];
  oceanDelayed: OceanShipment[];
  clientRanking: ClientShipmentCount[];
  onSelectAir: (s: AirShipment) => void;
  onSelectOcean: (s: OceanShipment) => void;
}

function ListModal({
  type,
  tab,
  onTabChange,
  onClose,
  clients,
  allAir,
  allOcean,
  airInTransit,
  oceanInTransit,
  airCompleted,
  oceanCompleted,
  airDelayed,
  oceanDelayed,
  clientRanking,
  onSelectAir,
  onSelectOcean,
}: ListModalProps) {
  // Determine which data to show
  const isClientModal = type === "all-clients" || type === "kpi-clients";
  const [clientFilter, setClientFilter] = useState("");
  const normalizedClientFilter = normalizeClientSearch(clientFilter);

  let title = "";
  let airList: AirShipment[] = [];
  let oceanList: OceanShipment[] = [];

  switch (type) {
    case "all-shipments":
    case "kpi-total":
      title = "Todos los Seguimientos";
      airList = allAir;
      oceanList = allOcean;
      break;
    case "kpi-active":
      title = "Envíos En Movimiento";
      airList = airInTransit;
      oceanList = oceanInTransit;
      break;
    case "kpi-air-transit":
      title = "Aéreos En Tránsito";
      airList = airInTransit;
      oceanList = [];
      break;
    case "kpi-ocean-transit":
      title = "Marítimos Navegando";
      airList = [];
      oceanList = oceanInTransit;
      break;
    case "kpi-completed":
      title = "Envíos Completados";
      airList = airCompleted;
      oceanList = oceanCompleted;
      break;
    case "kpi-delayed":
      title = "Retrasos Activos";
      airList = airDelayed;
      oceanList = oceanDelayed;
      break;
    case "all-clients":
    case "kpi-clients":
      title = "Clientes con Seguimiento";
      break;
  }

  const matchingClientUsernames = useMemo(() => {
    if (!normalizedClientFilter) return new Set<string>();

    return clients.reduce((usernames, client) => {
      if (!clientMatchesSearch(client, normalizedClientFilter)) {
        return usernames;
      }

      usernames.add(client.username);
      client.usernames?.forEach((username) => usernames.add(username));
      return usernames;
    }, new Set<string>());
  }, [clients, normalizedClientFilter]);

  const filteredClientRanking = useMemo(
    () =>
      clientRanking.filter((client) => {
        if (!normalizedClientFilter) return true;

        if (
          normalizeClientSearch(client.username).includes(
            normalizedClientFilter,
          )
        ) {
          return true;
        }

        if (
          normalizeClientSearch(client.nombreuser).includes(
            normalizedClientFilter,
          )
        ) {
          return true;
        }

        return matchingClientUsernames.has(client.username);
      }),
    [clientRanking, matchingClientUsernames, normalizedClientFilter],
  );

  const showTabs = !isClientModal && airList.length > 0 && oceanList.length > 0;

  const filteredAir = useMemo(() => {
    if (tab === "ocean") return [];

    return airList.filter((shipment) =>
      shipmentMatchesClientSearch(
        shipment.reference || "",
        normalizedClientFilter,
        matchingClientUsernames,
      ),
    );
  }, [airList, matchingClientUsernames, normalizedClientFilter, tab]);

  const filteredOcean = useMemo(() => {
    if (tab === "air") return [];

    return oceanList.filter((shipment) =>
      shipmentMatchesClientSearch(
        shipment.reference || "",
        normalizedClientFilter,
        matchingClientUsernames,
      ),
    );
  }, [matchingClientUsernames, normalizedClientFilter, oceanList, tab]);

  return (
    <div className="ops-list-overlay" onClick={onClose}>
      <div className="ops-list-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ops-list-modal__header">
          <h2 className="ops-list-modal__title">{title}</h2>
          <button className="ops-list-modal__close" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="ops-list-modal__filters">
          <input
            type="text"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="ops-list-modal__search"
            placeholder="Filtrar por cliente, username o email..."
          />
        </div>

        {/* Client list */}
        {isClientModal ? (
          <div className="ops-list-modal__body">
            {filteredClientRanking.length === 0 ? (
              <div className="ops-empty">Sin datos de clientes.</div>
            ) : (
              <table className="ops-mini-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Username</th>
                    <th>Aéreos</th>
                    <th>Marítimos</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClientRanking.map((c, i) => (
                    <tr key={c.username}>
                      <td>
                        <span
                          className="ops-client-row__rank"
                          style={
                            i === 0
                              ? {}
                              : i === 1
                                ? { background: "#64748b" }
                                : i === 2
                                  ? { background: "#94a3b8" }
                                  : { background: "#cbd5e1", color: "#64748b" }
                          }
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {c.nombreuser || c.username}
                      </td>
                      <td style={{ fontSize: 11, color: "#8b92a5" }}>
                        {c.username}
                      </td>
                      <td>✈ {c.air}</td>
                      <td>🚢 {c.ocean}</td>
                      <td
                        style={{ fontWeight: 700, color: "var(--ops-orange)" }}
                      >
                        {c.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <>
            {/* Tabs */}
            {showTabs && (
              <div className="ops-tabs" style={{ padding: "0 24px" }}>
                <button
                  className={`ops-tab ${tab === "all" ? "ops-tab--active" : ""}`}
                  onClick={() => onTabChange("all")}
                >
                  Todos ({airList.length + oceanList.length})
                </button>
                <button
                  className={`ops-tab ${tab === "air" ? "ops-tab--active" : ""}`}
                  onClick={() => onTabChange("air")}
                >
                  ✈ Aéreos ({airList.length})
                </button>
                <button
                  className={`ops-tab ${tab === "ocean" ? "ops-tab--active" : ""}`}
                  onClick={() => onTabChange("ocean")}
                >
                  🚢 Marítimos ({oceanList.length})
                </button>
              </div>
            )}

            <div className="ops-list-modal__body">
              {/* Air shipments table */}
              {filteredAir.length > 0 && (
                <>
                  {showTabs && tab === "all" && (
                    <h4 className="ops-list-modal__subtitle">
                      ✈ Aéreos ({filteredAir.length})
                    </h4>
                  )}
                  <table className="ops-mini-table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>AWB</th>
                        <th>Aerolínea</th>
                        <th>Origen</th>
                        <th>Destino</th>
                        <th>Cliente</th>
                        <th>Progreso</th>
                        <th>Creado</th>
                        <th>ETD</th>
                        <th>ETA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAir.map((s) => {
                        const delayed = isAirDelayed(s);
                        return (
                          <tr
                            key={s.id}
                            className="ops-clickable-row"
                            onClick={() => onSelectAir(s)}
                          >
                            <td>
                              <span
                                className={`ops-badge ${delayed ? "ops-badge--delayed" : getAirBadgeClass(s.status)}`}
                              >
                                {delayed
                                  ? "⚠ Retraso"
                                  : AIR_STATUS_LABELS[s.status] || s.status}
                              </span>
                            </td>
                            <td
                              style={{
                                fontWeight: 600,
                                fontFamily: "monospace",
                                fontSize: 11,
                              }}
                            >
                              {s.awb_number}
                            </td>
                            <td>{s.airline?.name || "—"}</td>
                            <td>
                              {s.route?.origin.location.country.code && (
                                <img
                                  src={getFlagUrl(
                                    s.route.origin.location.country.code,
                                  )}
                                  alt=""
                                  className="ops-flag"
                                />
                              )}
                              {s.route?.origin.location.iata || "—"}
                            </td>
                            <td>
                              {s.route?.destination.location.country.code && (
                                <img
                                  src={getFlagUrl(
                                    s.route.destination.location.country.code,
                                  )}
                                  alt=""
                                  className="ops-flag"
                                />
                              )}
                              {s.route?.destination.location.iata || "—"}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {s.reference || "—"}
                            </td>
                            <td style={{ minWidth: 100 }}>
                              <ProgressBar
                                value={s.route?.transit_percentage ?? 0}
                                color={delayed ? "#dc2626" : "#0891b2"}
                              />
                            </td>
                            <td style={{ fontSize: 11, color: "#8b92a5" }}>
                              {formatDate(s.created_at)}
                            </td>
                            <td style={{ fontSize: 11, color: "#8b92a5" }}>
                              {formatDate(s.route?.origin.date_of_dep)}
                            </td>
                            <td style={{ fontSize: 11, color: "#8b92a5" }}>
                              {formatDate(s.route?.destination.date_of_rcf)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {/* Ocean shipments table */}
              {filteredOcean.length > 0 && (
                <>
                  {showTabs && tab === "all" && (
                    <h4 className="ops-list-modal__subtitle">
                      🚢 Marítimos ({filteredOcean.length})
                    </h4>
                  )}
                  <table className="ops-mini-table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Container / Booking</th>
                        <th>Naviera</th>
                        <th>Origen</th>
                        <th>Destino</th>
                        <th>Cliente</th>
                        <th>Progreso</th>
                        <th>Creado</th>
                        <th>ETD</th>
                        <th>ETA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOcean.map((s) => {
                        const delayed = isOceanDelayed(s);
                        return (
                          <tr
                            key={s.id}
                            className="ops-clickable-row"
                            onClick={() => onSelectOcean(s)}
                          >
                            <td>
                              <span
                                className={`ops-badge ${delayed ? "ops-badge--delayed" : getOceanBadgeClass(s.status)}`}
                              >
                                {delayed
                                  ? "⚠ Retraso"
                                  : OCEAN_STATUS_LABELS[s.status] || s.status}
                              </span>
                            </td>
                            <td
                              style={{
                                fontWeight: 600,
                                fontFamily: "monospace",
                                fontSize: 11,
                              }}
                            >
                              {s.container_number || s.booking_number || "—"}
                            </td>
                            <td>{s.carrier?.name || "—"}</td>
                            <td>
                              {s.route?.port_of_loading.location.country
                                ?.code && (
                                <img
                                  src={getFlagUrl(
                                    s.route.port_of_loading.location.country
                                      .code,
                                  )}
                                  alt=""
                                  className="ops-flag"
                                />
                              )}
                              {s.route?.port_of_loading.location.name || "—"}
                            </td>
                            <td>
                              {s.route?.port_of_discharge.location.country
                                ?.code && (
                                <img
                                  src={getFlagUrl(
                                    s.route.port_of_discharge.location.country
                                      .code,
                                  )}
                                  alt=""
                                  className="ops-flag"
                                />
                              )}
                              {s.route?.port_of_discharge.location.name || "—"}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {s.reference || "—"}
                            </td>
                            <td style={{ minWidth: 100 }}>
                              <ProgressBar
                                value={s.route?.transit_percentage ?? 0}
                                color={delayed ? "#dc2626" : "#2563eb"}
                              />
                            </td>
                            <td style={{ fontSize: 11, color: "#8b92a5" }}>
                              {formatDate(s.created_at)}
                            </td>
                            <td style={{ fontSize: 11, color: "#8b92a5" }}>
                              {formatDate(
                                s.route?.port_of_loading.date_of_loading,
                              )}
                            </td>
                            <td style={{ fontSize: 11, color: "#8b92a5" }}>
                              {formatDate(
                                s.route?.port_of_discharge.date_of_discharge,
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {filteredAir.length === 0 && filteredOcean.length === 0 && (
                <div className="ops-empty">
                  No hay seguimientos en esta categoría.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
