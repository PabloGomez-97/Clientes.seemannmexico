// src/components/administrador/HomeEjecutivo.tsx — Torre de Control del Ejecutivo
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
import "../Sidebar/styles/Shipsgotracking.css";
import "./HomeEjecutivo.css";

// ── Behavior-tracking API base (same server as ComportamientoDeClientes) ──
const BEHAVIOR_API =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

// Colors for behavior tracking badges (mirrors ComportamientoDeClientes)
const BEHAVIOR_TYPE_COLORS: Record<string, string> = {
  AIR: "#ff6200",
  FCL: "#ff6200",
  LCL: "#ff6200",
  LASTMILE: "#0d9488",
};

const BEHAVIOR_QUOTE_TYPES = ["AIR", "FCL", "LCL", "LASTMILE"] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Cliente {
  id: string;
  email: string;
  username: string;
  nombreuser?: string;
  createdAt: string;
}

// Behavior tracking — aggregated KPI stats
interface BehaviorStats {
  uniqueAccountCount: number;
  totalStarted: number;
  totalCompleted: number;
  totalAbandoned: number;
  overallRate: number;
}

// Behavior tracking — analytics (subset we use)
interface BehaviorAnalytics {
  abandonmentByType: { quoteType: string; event: string; count: number }[];
}

// Client + stats with aggregated data
interface ClientStats {
  username: string;
  nombreuser?: string;
  email: string;
  trackingAir: number;
  trackingOcean: number;
}

interface TemperatureRecord {
  email: string;
  username: string;
  nombreuser: string;
  consecutiveAbandons: number;
  completed30d: number;
  lastActivity: string | null;
  bucket: "frio" | "tibio" | "caliente" | "new";
  isCold: boolean;
  isHotAbandons: boolean;
}

interface TemperatureData {
  counts: {
    frio: number;
    tibio: number;
    caliente: number;
    masAbandonos: number;
  };
  lists: {
    frio: TemperatureRecord[];
    tibio: TemperatureRecord[];
    caliente: TemperatureRecord[];
    masAbandonos: TemperatureRecord[];
  };
}

interface ActivityFeedItem {
  sessionId: string;
  clientEmail: string;
  clientUsername: string;
  clientNombre: string;
  event: "QUOTE_STARTED" | "QUOTE_COMPLETED" | "QUOTE_ABANDONED";
  quoteType: "AIR" | "FCL" | "LCL" | "LASTMILE";
  route?: { origin?: string; destination?: string } | null;
  startedAt: string;
  timestamp: string;
}

type ListModalType =
  | null
  | "all-clients"
  | "all-trackings"
  | "kpi-trackings"
  | "kpi-delayed"
  | "client-detail";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function isAirDelayed(s: AirShipment): boolean {
  if (!s.route) return false;
  const landed = ["LANDED", "DELIVERED"].includes(s.status);
  if (landed) return false;
  const etaStr = s.route.destination.date_of_rcf;
  if (!etaStr) return false;
  return new Date(etaStr) < new Date();
}

function isOceanDelayed(s: OceanShipment): boolean {
  if (!s.route) return false;
  const arrived = ["ARRIVED", "DISCHARGED"].includes(s.status);
  if (arrived) return false;
  const etaStr = s.route.port_of_discharge.date_of_discharge;
  if (!etaStr) return false;
  return new Date(etaStr) < new Date();
}

function getAirBadgeClass(status: string): string {
  switch (status) {
    case "BOOKED":
    case "INPROGRESS":
      return "ej-badge--booked";
    case "EN_ROUTE":
      return "ej-badge--transit";
    case "LANDED":
    case "DELIVERED":
      return "ej-badge--delivered";
    default:
      return "ej-badge--other";
  }
}

function getOceanBadgeClass(status: string): string {
  switch (status) {
    case "BOOKED":
    case "NEW":
    case "INPROGRESS":
    case "LOADED":
      return "ej-badge--booked";
    case "SAILING":
      return "ej-badge--sailing";
    case "ARRIVED":
    case "DISCHARGED":
      return "ej-badge--delivered";
    default:
      return "ej-badge--other";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components (stateless)
// ═══════════════════════════════════════════════════════════════════════════

function SkeletonMetricStrip() {
  return (
    <div className="ej-client-metrics-strip" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="ej-client-metrics-strip__item" key={index}>
          <div
            className="ej-skeleton"
            style={{ width: "52%", height: 11, marginBottom: 10 }}
          />
          <div
            className="ej-skeleton"
            style={{ width: "34%", height: 20, marginBottom: 6 }}
          />
          <div className="ej-skeleton" style={{ width: "68%", height: 11 }} />
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="ej-progress">
      <div className="ej-progress__track">
        <div
          className="ej-progress__fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="ej-progress__text">{pct}%</span>
    </div>
  );
}

function DonutChart({
  segments,
  size = 100,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="ej-donut-wrap">
      <svg width={size} height={size} viewBox="0 0 100 100">
        {total === 0 ? (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#f1f3f8"
            strokeWidth="12"
          />
        ) : (
          segments
            .filter((seg) => seg.value > 0)
            .map((seg, i) => {
              const pct = seg.value / total;
              const dash = pct * c;
              const gap = c - dash;
              const o = offset;
              offset += dash;
              return (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="12"
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-o}
                  transform="rotate(-90 50 50)"
                />
              );
            })
        )}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dy="0.35em"
          fontSize="16"
          fontWeight="700"
          fill="#1a1a2e"
        >
          {total}
        </text>
      </svg>
      <div className="ej-donut-legend">
        {segments
          .filter((s) => s.value > 0)
          .map((seg, i) => (
            <div key={i} className="ej-donut-legend__item">
              <span
                className="ej-donut-legend__dot"
                style={{ background: seg.color }}
              />
              {seg.label}
              <span className="ej-donut-legend__value">{seg.value}</span>
            </div>
          ))}
      </div>
    </div>
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
    <div className="ej-status-row">
      <span className="ej-status-row__label">{label}</span>
      <div className="ej-status-row__bar-wrap">
        <div
          className="ej-status-row__bar"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="ej-status-row__count">{count}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function HomeEjecutivo() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // ── Core state ─────────────────────────────────────────
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Behavior tracking
  const [behaviorStats, setBehaviorStats] = useState<BehaviorStats | null>(
    null,
  );
  const [behaviorAnalytics, setBehaviorAnalytics] =
    useState<BehaviorAnalytics | null>(null);
  const [behaviorLoading, setBehaviorLoading] = useState(true);

  // Atención Inmediata (temperature buckets)
  const [temperatureData, setTemperatureData] =
    useState<TemperatureData | null>(null);
  const [temperatureLoading, setTemperatureLoading] = useState(true);

  // Feed de actividad reciente
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  // ShipsGo data
  const [trackingAir, setTrackingAir] = useState<AirShipment[]>([]);
  const [trackingOcean, setTrackingOcean] = useState<OceanShipment[]>([]);

  // Filters
  const [clientFilter, setClientFilter] = useState("");
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
  const [modalClient, setModalClient] = useState<string | null>(null);

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
      // Clear router state to prevent re-trigger on re-render
      window.history.replaceState({}, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const displayName = user?.nombreuser || user?.username || "Ejecutivo";

  // ── Fetch clients & ShipsGo data ──────────────────────────
  const fetchCoreData = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const [clientsRes, airRes, oceanRes] = await Promise.allSettled([
          fetch("/api/ejecutivo/clientes", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()),
          fetch("/api/shipsgo/shipments", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json() as Promise<AirResponse>),
          fetch("/api/shipsgo/ocean/shipments", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json() as Promise<OceanResponse>),
        ]);

        const raw = clientsRes.status === "fulfilled" ? clientsRes.value : null;
        const arr: Cliente[] = Array.isArray(raw?.clientes)
          ? raw.clientes
          : Array.isArray(raw)
            ? raw
            : [];
        setClientes(arr);
        const clientSet = new Set(arr.map((c) => c.username));

        if (
          airRes.status === "fulfilled" &&
          Array.isArray(airRes.value?.shipments)
        ) {
          setTrackingAir(
            airRes.value.shipments.filter((s) =>
              clientSet.has(s.reference ?? ""),
            ),
          );
        }
        if (
          oceanRes.status === "fulfilled" &&
          Array.isArray(oceanRes.value?.shipments)
        ) {
          setTrackingOcean(
            oceanRes.value.shipments.filter((s) =>
              clientSet.has(s.reference ?? ""),
            ),
          );
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
    fetchCoreData();
  }, [fetchCoreData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(() => fetchCoreData(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchCoreData]);

  // ── fetchBehaviorData: carga datos de Comportamiento de Clientes ──────────
  const fetchBehaviorData = useCallback(async () => {
    if (!token) return;
    setBehaviorLoading(true);
    try {
      const [clientsRes, analyticsRes] = await Promise.allSettled([
        fetch(`${BEHAVIOR_API}/api/behavior-tracking/clients`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${BEHAVIOR_API}/api/behavior-tracking/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : null)),
      ]);

      if (clientsRes.status === "fulfilled" && clientsRes.value) {
        const clients: Array<{
          email: string;
          stats?: {
            quotesStarted?: number;
            quotesCompleted?: number;
            quotesAbandoned?: number;
          };
        }> = clientsRes.value.clients || [];
        const totalStarted = clients.reduce(
          (s, c) => s + (c.stats?.quotesStarted || 0),
          0,
        );
        const totalCompleted = clients.reduce(
          (s, c) => s + (c.stats?.quotesCompleted || 0),
          0,
        );
        const totalAbandoned = clients.reduce(
          (s, c) => s + (c.stats?.quotesAbandoned || 0),
          0,
        );
        const uniqueAccountCount = new Set(clients.map((c) => c.email)).size;
        const overallRate =
          totalStarted > 0
            ? Math.round((totalCompleted / totalStarted) * 100)
            : 0;
        setBehaviorStats({
          uniqueAccountCount,
          totalStarted,
          totalCompleted,
          totalAbandoned,
          overallRate,
        });
      }

      if (analyticsRes.status === "fulfilled" && analyticsRes.value) {
        setBehaviorAnalytics(analyticsRes.value);
      }
    } catch {
      /* silent */
    } finally {
      setBehaviorLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBehaviorData();
  }, [fetchBehaviorData]);

  // ── Fetch temperature data (Atención Inmediata) ───────────
  const BEHAVIOR_API =
    import.meta.env.MODE === "development"
      ? "http://localhost:4000"
      : "https://portalclientes.seemanngroup.com";

  const fetchTemperatureData = useCallback(async () => {
    if (!token) return;
    setTemperatureLoading(true);
    try {
      const res = await fetch(
        `${BEHAVIOR_API}/api/behavior-tracking/temperature`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setTemperatureData(data);
      }
    } catch {
      /* silent */
    } finally {
      setTemperatureLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTemperatureData();
  }, [fetchTemperatureData]);

  // ── Fetch activity feed ────────────────────────────────────
  const fetchActivityFeed = useCallback(async () => {
    if (!token) return;
    setActivityLoading(true);
    try {
      const res = await fetch(
        "/api/ejecutivo/activity-feed?hours=12&limit=30",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setActivityFeed(Array.isArray(data.feed) ? data.feed : []);
      }
    } catch {
      /* silent */
    } finally {
      setActivityLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchActivityFeed();
  }, [fetchActivityFeed]);

  // ═══════════════════════════════════════════════════════════════════════
  // Computed values
  // ═══════════════════════════════════════════════════════════════════════

  // ShipsGo tracking stats
  const airInTransit = useMemo(
    () =>
      trackingAir.filter((s) =>
        ["EN_ROUTE", "BOOKED", "INPROGRESS"].includes(s.status),
      ),
    [trackingAir],
  );
  const airCompleted = useMemo(
    () => trackingAir.filter((s) => ["LANDED", "DELIVERED"].includes(s.status)),
    [trackingAir],
  );
  const airDelayed = useMemo(
    () => trackingAir.filter(isAirDelayed),
    [trackingAir],
  );

  const oceanInTransit = useMemo(
    () =>
      trackingOcean.filter((s) =>
        ["SAILING", "LOADED", "BOOKED", "NEW", "INPROGRESS"].includes(s.status),
      ),
    [trackingOcean],
  );
  const oceanCompleted = useMemo(
    () =>
      trackingOcean.filter((s) => ["ARRIVED", "DISCHARGED"].includes(s.status)),
    [trackingOcean],
  );
  const oceanDelayed = useMemo(
    () => trackingOcean.filter(isOceanDelayed),
    [trackingOcean],
  );

  const totalDelayed = airDelayed.length + oceanDelayed.length;

  // Client stats (aggregated)
  const clientStats = useMemo<ClientStats[]>(() => {
    const map = new Map<string, ClientStats>();
    clientes.forEach((c) => {
      map.set(c.username, {
        username: c.username,
        nombreuser: c.nombreuser,
        email: c.email,
        trackingAir: 0,
        trackingOcean: 0,
      });
    });

    trackingAir.forEach((s) => {
      const entry = map.get(s.reference || "");
      if (entry) entry.trackingAir++;
    });
    trackingOcean.forEach((s) => {
      const entry = map.get(s.reference || "");
      if (entry) entry.trackingOcean++;
    });

    return [...map.values()].sort(
      (a, b) =>
        b.trackingAir +
        b.trackingOcean -
        (a.trackingAir + a.trackingOcean),
    );
  }, [clientes, trackingAir, trackingOcean]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!clientFilter.trim()) return clientStats;
    const q = clientFilter.toLowerCase();
    return clientStats.filter(
      (c) =>
        c.username.toLowerCase().includes(q) ||
        (c.nombreuser || "").toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [clientStats, clientFilter]);

  // New clients this month
  const newThisMonth = useMemo(() => {
    const firstDay = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    return clientes.filter((c) => new Date(c.createdAt) >= firstDay).length;
  }, [clientes]);
  // Recent ShipsGo air/ocean
  const recentAir = useMemo(
    () =>
      [...trackingAir]
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 8),
    [trackingAir],
  );
  const recentOcean = useMemo(
    () =>
      [...trackingOcean]
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 8),
    [trackingOcean],
  );

  // Status distributions for ShipsGo
  const airStatusDist = useMemo(() => {
    const counts: Record<string, number> = {};
    trackingAir.forEach((s) => {
      counts[s.status] = (counts[s.status] || 0) + 1;
    });
    return counts;
  }, [trackingAir]);

  const oceanStatusDist = useMemo(() => {
    const counts: Record<string, number> = {};
    trackingOcean.forEach((s) => {
      counts[s.status] = (counts[s.status] || 0) + 1;
    });
    return counts;
  }, [trackingOcean]);

  // Donut segments
  const airDonut = useMemo(
    () => [
      { value: airInTransit.length, color: "#0891b2", label: "En Tránsito" },
      { value: airCompleted.length, color: "#059669", label: "Completados" },
      { value: airDelayed.length, color: "#dc2626", label: "Retrasos" },
    ],
    [airInTransit, airCompleted, airDelayed],
  );
  const oceanDonut = useMemo(
    () => [
      { value: oceanInTransit.length, color: "#2563eb", label: "En Tránsito" },
      { value: oceanCompleted.length, color: "#059669", label: "Completados" },
      { value: oceanDelayed.length, color: "#dc2626", label: "Retrasos" },
    ],
    [oceanInTransit, oceanCompleted, oceanDelayed],
  );

  // Abandonment by type — derived from behaviorAnalytics
  const behaviorByType = useMemo(() => {
    if (!behaviorAnalytics?.abandonmentByType) return [];
    return BEHAVIOR_QUOTE_TYPES.map((type) => {
      const events = behaviorAnalytics.abandonmentByType.filter(
        (e) => e.quoteType === type,
      );
      const started =
        events.find((e) => e.event === "QUOTE_STARTED")?.count || 0;
      const completed =
        events.find((e) => e.event === "QUOTE_COMPLETED")?.count || 0;
      const abandoned =
        events.find((e) => e.event === "QUOTE_ABANDONED")?.count || 0;
      const abandonRate =
        started > 0 ? Math.round((abandoned / started) * 100) : 0;
      return { type, started, completed, abandoned, abandonRate };
    }).filter((t) => t.started > 0);
  }, [behaviorAnalytics]);

  // Greeting
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Render: Loading
  // ═══════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="ej-home">
        <div className="ej-header">
          <div className="ej-header__left">
            <h1>Cargando Torre de Control...</h1>
          </div>
        </div>
        <SkeletonMetricStrip />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="ej-home">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="ej-header">
        <div className="ej-header__left">
          <h1>
            {greeting}, <span>{displayName}</span>
          </h1>
          <p>{today}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="ej-refresh-btn"
            onClick={() => fetchCoreData(true)}
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
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
          <div className="ej-header__badge">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div className="ej-pulse" />
            TORRE DE CONTROL
          </div>
        </div>
      </div>

      {/* ── Barra de Actividad Reciente ────────────────────────────────── */}
      <div className="ej-activity-bar">
        <div className="ej-activity-bar__label">
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
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Actividad Reciente
        </div>

        {activityLoading ? (
          <div className="ej-activity-bar__loading">Cargando actividad...</div>
        ) : activityFeed.length === 0 && totalDelayed === 0 ? (
          <div className="ej-activity-bar__empty">
            Sin actividad de clientes
          </div>
        ) : (
          <div className="ej-activity-bar__carousel">
            <div className="ej-activity-bar__track">
              {(() => {
                // Build combined items: activity + delays
                const activityItems = activityFeed
                  .slice(0, 5)
                  .map((item, idx) => (
                    <div
                      key={`act-${item.sessionId}-${idx}`}
                      className="ej-activity-bar__chip"
                      onClick={() =>
                        navigate(
                          `/admin/comportamiento-clientes/${encodeURIComponent(item.clientUsername)}`,
                        )
                      }
                    >
                      <div
                        className={`ej-activity-item__dot ej-activity-item__dot--${
                          item.event === "QUOTE_COMPLETED"
                            ? "success"
                            : item.event === "QUOTE_ABANDONED"
                              ? "abandon"
                              : "info"
                        }`}
                      />
                      <span className="ej-activity-bar__chip-client">
                        {item.clientUsername}
                      </span>
                      <span className="ej-activity-bar__chip-action">
                        {item.event === "QUOTE_COMPLETED"
                          ? "completó"
                          : item.event === "QUOTE_ABANDONED"
                            ? "abandonó"
                            : "inició"}
                      </span>
                      <span className="ej-activity-bar__chip-type">
                        {item.quoteType}
                      </span>
                      <span className="ej-activity-bar__chip-time">
                        {timeAgo(item.timestamp)}
                      </span>
                    </div>
                  ));

                const delayItems = [
                  ...airDelayed.slice(0, 3).map((s, idx) => (
                    <div
                      key={`delay-air-${s.id}-${idx}`}
                      className="ej-activity-bar__chip ej-activity-bar__chip--delay"
                      onClick={() => setSelectedAir(s)}
                    >
                      <div className="ej-activity-item__dot ej-activity-item__dot--abandon" />
                      <span className="ej-activity-bar__chip-delay-label">
                        Retraso
                      </span>
                      <span className="ej-activity-bar__chip-type ej-activity-bar__chip-type--delay">
                        AIR
                      </span>
                      <span className="ej-activity-bar__chip-client">
                        {s.awb_number}
                      </span>
                      {s.route && (
                        <span className="ej-activity-bar__chip-action">
                          {s.route.origin.location.iata}→
                          {s.route.destination.location.iata}
                        </span>
                      )}
                    </div>
                  )),
                  ...oceanDelayed.slice(0, 3).map((s, idx) => (
                    <div
                      key={`delay-ocean-${s.id}-${idx}`}
                      className="ej-activity-bar__chip ej-activity-bar__chip--delay"
                      onClick={() => setSelectedOcean(s)}
                    >
                      <div className="ej-activity-item__dot ej-activity-item__dot--abandon" />
                      <span className="ej-activity-bar__chip-delay-label">
                        Retraso
                      </span>
                      <span className="ej-activity-bar__chip-type ej-activity-bar__chip-type--delay">
                        FCL
                      </span>
                      <span className="ej-activity-bar__chip-client">
                        {s.container_number || s.booking_number || `#${s.id}`}
                      </span>
                      {s.route && (
                        <span className="ej-activity-bar__chip-action">
                          {s.route.port_of_loading.location.code}→
                          {s.route.port_of_discharge.location.code}
                        </span>
                      )}
                    </div>
                  )),
                ];

                const allItems = [...activityItems, ...delayItems];
                // Duplicate for infinite loop
                return [...allItems, ...allItems];
              })()}
            </div>
          </div>
        )}

        <button
          className="ej-activity-bar__see-all"
          onClick={() => setActivityModalOpen(true)}
        >
          {activityFeed.length > 0 ? "Ver todos →" : ""}
        </button>
      </div>

      {/* ── Acceso Rápido ──────────────────────────────────────────────── */}
      <div className="ops-quick-actions-section">
        <span className="ops-quick-actions-label">Acceso Rápido</span>
        <div className="ops-quick-actions">
          <button
            className="ops-quick-action"
            onClick={() => navigate("/admin/cotizador-administrador")}
          >
            Nueva Cotización
          </button>
          <button
            className="ops-quick-action"
            onClick={() =>
              navigate("/admin/cotizador-administrador", {
                state: { tipoEnvio: "LASTMILE" },
              })
            }
          >
            Cotización Última Milla
          </button>
          <button
            className="ops-quick-action"
            onClick={() => navigate("/admin/reporteriaclientes")}
          >
            Mis Clientes
          </button>
          <button
            className="ops-quick-action"
            onClick={() => navigate("/admin/trackeos")}
          >
            Seguimientos
          </button>
        </div>
      </div>

      {/* ── Delay Banner (solo cuando hay retrasos) ─────────────────────── */}
      {totalDelayed > 0 && (
        <div
          className="ej-delay-banner"
          onClick={() => {
            setListModal("kpi-delayed");
            setListModalTab("all");
          }}
        >
          <span className="ej-delay-banner__icon">⚠</span>
          <span className="ej-delay-banner__msg">
            <strong>{totalDelayed}</strong> envío
            {totalDelayed !== 1 ? "s" : ""} con retraso activo
          </span>
          <span className="ej-delay-banner__meta">
            {airDelayed.length > 0 &&
              `${airDelayed.length} aéreo${airDelayed.length !== 1 ? "s" : ""}`}
            {airDelayed.length > 0 && oceanDelayed.length > 0 && " · "}
            {oceanDelayed.length > 0 &&
              `${oceanDelayed.length} marítimo${oceanDelayed.length !== 1 ? "s" : ""}`}
          </span>
          <span className="ej-delay-banner__cta">Ver detalles →</span>
        </div>
      )}

      {/* ── Comportamiento de Clientes ─────────────────────────────────── */}
      <div className="ej-section">
        <div className="ej-section-header">
          <h3 className="ej-section-title" style={{ margin: 0 }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary-color)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="23 21 23 15 20 12 17 15 17 21" />
              <line x1="20" y1="12" x2="20" y2="9" />
            </svg>
            Comportamiento de Clientes
          </h3>
          <button
            className="ej-view-all"
            onClick={() => navigate("/admin/comportamiento-clientes")}
          >
            Ver análisis completo →
          </button>
        </div>

        {behaviorLoading ? (
          <div className="ej-panel">
            <div
              className="ej-skeleton"
              style={{ width: "100%", height: 72, borderRadius: 8 }}
            />
          </div>
        ) : behaviorStats ? (
          <div className="ej-panel">
            <div className="ej-behavior-stats">
              <div className="ej-behavior-stat">
                <span className="ej-behavior-stat__value">
                  {behaviorStats.uniqueAccountCount}
                </span>
                <span className="ej-behavior-stat__label">Cuentas Activas</span>
              </div>
              <div className="ej-behavior-stat">
                <span className="ej-behavior-stat__value">
                  {behaviorStats.totalStarted}
                </span>
                <span className="ej-behavior-stat__label">
                  Cotizaciones Iniciadas
                </span>
              </div>
              <div className="ej-behavior-stat">
                <span className="ej-behavior-stat__value">
                  {behaviorStats.totalCompleted}
                </span>
                <span className="ej-behavior-stat__label">
                  Cotizaciones Completadas
                </span>
              </div>
              <div className="ej-behavior-stat">
                <span className="ej-behavior-stat__value">
                  {behaviorStats.totalAbandoned}
                </span>
                <span className="ej-behavior-stat__label">
                  Cotizaciones Abandonadas
                </span>
              </div>
              <div className="ej-behavior-stat">
                <span className="ej-behavior-stat__value">
                  {Math.max(
                    0,
                    behaviorStats.totalStarted -
                      behaviorStats.totalCompleted -
                      behaviorStats.totalAbandoned,
                  )}
                </span>
                <span className="ej-behavior-stat__label">
                  Cotizaciones En Progreso
                </span>
              </div>
              <div className="ej-behavior-stat">
                <span className="ej-behavior-stat__value">
                  {behaviorStats.overallRate}%
                </span>
                <span className="ej-behavior-stat__label">
                  Tasa global x Cotización
                </span>
              </div>
            </div>
            {behaviorByType.length > 0 && (
              <div className="ej-behavior-types">
                {behaviorByType.map(
                  ({ type, started, completed, abandoned }) => (
                    <div key={type} className="ej-behavior-type">
                      <span
                        className="ej-behavior-type__badge"
                        style={{
                          background: BEHAVIOR_TYPE_COLORS[type] || "#6b7280",
                        }}
                      >
                        {type}
                      </span>
                      <div className="ej-behavior-type__rows">
                        <div className="ej-behavior-type__row">
                          <span className="ej-behavior-type__row-label">
                            Iniciadas
                          </span>
                          <span className="ej-behavior-type__row-value">
                            {started}
                          </span>
                        </div>
                        <div className="ej-behavior-type__row">
                          <span className="ej-behavior-type__row-label">
                            Completadas
                          </span>
                          <span className="ej-behavior-type__row-value">
                            {completed}
                          </span>
                        </div>
                        <div className="ej-behavior-type__row">
                          <span className="ej-behavior-type__row-label">
                            Abandonadas
                          </span>
                          <span className="ej-behavior-type__row-value">
                            {abandoned}
                          </span>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <hr />
      {/* ── Operaciones de Clientes ─────────────────────────────────────── */}
      <div className="ej-section">
        <div className="ej-section-header">
          <h3 className="ej-section-title" style={{ margin: 0 }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary-color)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="23 21 23 15 20 12 17 15 17 21" />
              <line x1="20" y1="12" x2="20" y2="9" />
            </svg>
            Operaciones de Clientes
          </h3>
          <button
            className="ej-view-all"
            onClick={() => navigate("/admin/reporteriaclientes")}
          >
            Ver análisis completo →
          </button>
        </div>
        <div className="ej-client-metrics-strip">
          {/* Clients o */}
          <div
            className="ej-kpi ej-kpi--orange ej-kpi--clickable ej-client-metrics-strip__item"
            onClick={() => setListModal("all-clients")}
          >
            <div className="ej-kpi__header">
              <span className="ej-kpi__label">Mis Clientes</span>
              <div
                className="ej-kpi__icon"
                style={{ background: "var(--ej-orange-bg)" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ej-orange)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <div className="ej-kpi__value">{clientes.length}</div>
            <div className="ej-kpi__sub">
              {newThisMonth > 0
                ? `+${newThisMonth} este mes`
                : "Cartera activa"}
            </div>
          </div>

          {/* ShipsGo Trackings */}
          <div
            className="ej-kpi ej-kpi--green ej-kpi--clickable ej-client-metrics-strip__item"
            onClick={() => {
              setListModal("all-trackings");
              setListModalTab("all");
            }}
          >
            <div className="ej-kpi__header">
              <span className="ej-kpi__label">Seguimientos</span>
              <div
                className="ej-kpi__icon"
                style={{ background: "var(--ej-green-bg)" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ej-green)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
            </div>
            <div className="ej-kpi__value">
              {trackingAir.length + trackingOcean.length}
            </div>
            <div className="ej-kpi__sub">
              {trackingAir.length} aéreos · {trackingOcean.length} marítimos
            </div>
          </div>

          {/* Active (in transit) */}
          <div
            className="ej-kpi ej-kpi--amber ej-kpi--clickable ej-client-metrics-strip__item"
            onClick={() => {
              setListModal("kpi-trackings");
              setListModalTab("all");
            }}
          >
            <div className="ej-kpi__header">
              <span className="ej-kpi__label">En Movimiento</span>
              <div
                className="ej-kpi__icon"
                style={{ background: "var(--ej-amber-bg)" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ej-amber)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>
            <div className="ej-kpi__value">
              {airInTransit.length + oceanInTransit.length}
            </div>
            <div className="ej-kpi__sub">
              {airInTransit.length} aéreos · {oceanInTransit.length} marítimos
            </div>
          </div>

          {/* Delays */}
          <div
            className="ej-kpi ej-kpi--red ej-kpi--clickable ej-client-metrics-strip__item"
            onClick={() => {
              setListModal("kpi-delayed");
              setListModalTab("all");
            }}
          >
            <div className="ej-kpi__header">
              <span className="ej-kpi__label">Retrasos Activos</span>
              <div
                className="ej-kpi__icon"
                style={{ background: "var(--ej-red-bg)" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ej-red)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
            <div className="ej-kpi__value">{totalDelayed}</div>
            <div className="ej-kpi__sub">
              {airDelayed.length} aéreos · {oceanDelayed.length} marítimos
            </div>
          </div>
        </div>
      </div>

      {/* ── Atención Inmediata ─────────────────────────────────────────── */}
      <div className="ej-section">
        {temperatureLoading ? (
          <div
            className="ej-skeleton"
            style={{ width: "100%", height: 80, borderRadius: 8 }}
          />
        ) : (
          <div className="ej-attention-panel__cols">
            {/* ── Clientes Fríos ── */}
            <div className="ej-attention-col">
              <div className="ej-attention-col__header">
                <span>Clientes Fríos</span>
                {temperatureData && temperatureData.counts.frio > 0 && (
                  <span className="ej-attention-col__count">
                    {temperatureData.counts.frio}
                  </span>
                )}
              </div>
              <div className="ej-attention-col__list">
                {!temperatureData || temperatureData.lists.frio.length === 0 ? (
                  <div className="ej-attention-col__empty">
                    Sin clientes fríos
                  </div>
                ) : (
                  temperatureData.lists.frio.slice(0, 5).map((r) => (
                    <div key={r.email} className="ej-attention-item">
                      <div className="ej-attention-item__avatar">
                        {(r.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="ej-attention-item__body">
                        <div className="ej-attention-item__name">
                          {r.username}
                        </div>
                        <div className="ej-attention-item__sub">
                          {r.lastActivity
                            ? `Últ. actividad ${timeAgo(r.lastActivity)}`
                            : "Nunca cotizó"}
                        </div>
                      </div>
                      <button
                        className="ej-attention-item__btn"
                        onClick={() =>
                          navigate(
                            `/admin/comportamiento-clientes/${encodeURIComponent(r.username)}`,
                          )
                        }
                      >
                        Ver →
                      </button>
                    </div>
                  ))
                )}
              </div>
              {temperatureData && temperatureData.counts.frio > 0 && (
                <button
                  className="ej-attention-col__view-all"
                  onClick={() => navigate("/admin/comportamiento-clientes")}
                >
                  Ver todos →
                </button>
              )}
            </div>

            {/* ── Clientes Tibios ── */}
            <div className="ej-attention-col">
              <div className="ej-attention-col__header">
                <span>Clientes Tibios</span>
                {temperatureData && temperatureData.counts.tibio > 0 && (
                  <span className="ej-attention-col__count">
                    {temperatureData.counts.tibio}
                  </span>
                )}
              </div>
              <div className="ej-attention-col__list">
                {!temperatureData ||
                temperatureData.lists.tibio.length === 0 ? (
                  <div className="ej-attention-col__empty">
                    Sin clientes tibios
                  </div>
                ) : (
                  temperatureData.lists.tibio.slice(0, 5).map((r) => (
                    <div key={r.email} className="ej-attention-item">
                      <div className="ej-attention-item__avatar">
                        {(r.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="ej-attention-item__body">
                        <div className="ej-attention-item__name">
                          {r.username}
                        </div>
                        <div className="ej-attention-item__sub">
                          {r.completed30d} cotizaci
                          {r.completed30d === 1 ? "ón" : "ones"} en 30d
                        </div>
                      </div>
                      <button
                        className="ej-attention-item__btn"
                        onClick={() =>
                          navigate(
                            `/admin/comportamiento-clientes/${encodeURIComponent(r.username)}`,
                          )
                        }
                      >
                        Ver →
                      </button>
                    </div>
                  ))
                )}
              </div>
              {temperatureData && temperatureData.counts.tibio > 0 && (
                <button
                  className="ej-attention-col__view-all"
                  onClick={() => navigate("/admin/comportamiento-clientes")}
                >
                  Ver todos →
                </button>
              )}
            </div>

            {/* ── Múltiples Abandonos ── */}
            <div className="ej-attention-col">
              <div className="ej-attention-col__header">
                <span>Múltiples Abandonos</span>
                {temperatureData && temperatureData.counts.masAbandonos > 0 && (
                  <span className="ej-attention-col__count">
                    {temperatureData.counts.masAbandonos}
                  </span>
                )}
              </div>
              <div className="ej-attention-col__list">
                {!temperatureData ||
                temperatureData.lists.masAbandonos.length === 0 ? (
                  <div className="ej-attention-col__empty">
                    Sin abandonos múltiples
                  </div>
                ) : (
                  temperatureData.lists.masAbandonos.slice(0, 5).map((r) => (
                    <div key={r.email} className="ej-attention-item">
                      <div className="ej-attention-item__avatar">
                        {(r.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="ej-attention-item__body">
                        <div className="ej-attention-item__name">
                          {r.username}
                        </div>
                        <div className="ej-attention-item__sub">
                          {r.consecutiveAbandons} abandono
                          {r.consecutiveAbandons !== 1 ? "s" : ""} consecutivos
                        </div>
                      </div>
                      <button
                        className="ej-attention-item__btn"
                        onClick={() =>
                          navigate(
                            `/admin/comportamiento-clientes/${encodeURIComponent(r.username)}`,
                          )
                        }
                      >
                        Ver →
                      </button>
                    </div>
                  ))
                )}
              </div>
              {temperatureData && temperatureData.counts.masAbandonos > 0 && (
                <button
                  className="ej-attention-col__view-all"
                  onClick={() => navigate("/admin/comportamiento-clientes")}
                >
                  Ver todos →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de Actividad Reciente (completa) ────────────────────── */}
      {activityModalOpen && (
        <div
          className="ej-list-overlay"
          onClick={() => setActivityModalOpen(false)}
        >
          <div className="ej-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ej-list-modal__header">
              <h2 className="ej-list-modal__title">
                Actividad Reciente de Clientes
              </h2>
              <button
                className="ej-list-modal__close"
                onClick={() => setActivityModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ej-list-modal__body">
              {activityFeed.length === 0 ? (
                <div className="ej-empty">Sin actividad de clientes</div>
              ) : (
                <div className="ej-activity-feed">
                  {activityFeed.map((item) => (
                    <div
                      key={item.sessionId}
                      className="ej-activity-item"
                      onClick={() => {
                        setActivityModalOpen(false);
                        navigate(
                          `/admin/comportamiento-clientes/${encodeURIComponent(item.clientUsername)}`,
                        );
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div
                        className={`ej-activity-item__dot ej-activity-item__dot--${
                          item.event === "QUOTE_COMPLETED"
                            ? "success"
                            : item.event === "QUOTE_ABANDONED"
                              ? "warn"
                              : "info"
                        }`}
                      />
                      <div className="ej-activity-item__body">
                        <span className="ej-activity-item__client">
                          {item.clientUsername}
                        </span>{" "}
                        <span className="ej-activity-item__action">
                          {item.event === "QUOTE_COMPLETED"
                            ? "completó"
                            : item.event === "QUOTE_ABANDONED"
                              ? "abandonó"
                              : "inició"}
                        </span>{" "}
                        cotización{" "}
                        <span
                          className={`ej-activity-item__type ej-activity-item__type--${item.quoteType.toLowerCase()}`}
                        >
                          {item.quoteType}
                        </span>
                        {item.route?.origin && item.route?.destination && (
                          <span className="ej-activity-item__route">
                            {" "}
                            {item.route.origin}→{item.route.destination}
                          </span>
                        )}
                      </div>
                      <span className="ej-activity-item__time">
                        {timeAgo(item.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Distribución de Seguimientos ──────────────────────────────── */}
      {/* ShipsGo Tracking Distribution */}
      <div className="ej-panel">
        <h3 className="ej-section-title">Distribución de Seguimientos</h3>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
        >
          {/* Air donut */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ej-cyan)",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              ✈ Aéreos
            </div>
            <DonutChart segments={airDonut} size={90} />
            <div className="ej-status-grid" style={{ marginTop: 8 }}>
              <StatusBar
                label="En Tránsito"
                count={airStatusDist["EN_ROUTE"] || 0}
                total={trackingAir.length}
                color="#0891b2"
              />
              <StatusBar
                label="Aterrizado"
                count={airStatusDist["LANDED"] || 0}
                total={trackingAir.length}
                color="#059669"
              />
              <StatusBar
                label="Entregado"
                count={airStatusDist["DELIVERED"] || 0}
                total={trackingAir.length}
                color="#22c55e"
              />
              {(airStatusDist["BOOKED"] || 0) > 0 && (
                <StatusBar
                  label="Reservado"
                  count={airStatusDist["BOOKED"] || 0}
                  total={trackingAir.length}
                  color="#7c3aed"
                />
              )}
            </div>
          </div>

          {/* Ocean donut */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ej-blue)",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              🚢 Marítimos
            </div>
            <DonutChart segments={oceanDonut} size={90} />
            <div className="ej-status-grid" style={{ marginTop: 8 }}>
              <StatusBar
                label="Navegando"
                count={oceanStatusDist["SAILING"] || 0}
                total={trackingOcean.length}
                color="#2563eb"
              />
              <StatusBar
                label="Arribado"
                count={oceanStatusDist["ARRIVED"] || 0}
                total={trackingOcean.length}
                color="#059669"
              />
              <StatusBar
                label="Descargado"
                count={oceanStatusDist["DISCHARGED"] || 0}
                total={trackingOcean.length}
                color="#22c55e"
              />
              {(oceanStatusDist["LOADED"] || 0) > 0 && (
                <StatusBar
                  label="Cargado"
                  count={oceanStatusDist["LOADED"] || 0}
                  total={trackingOcean.length}
                  color="#7c3aed"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ShipsGo Recent Shipments Table ────────────────────────────── */}
      <div className="ej-panel" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <h3 className="ej-section-title" style={{ margin: 0 }}>
            Últimos Seguimientos
          </h3>
          <button
            className="ej-view-all"
            onClick={() => {
              setListModal("all-trackings");
              setListModalTab("all");
            }}
          >
            Ver todos →
          </button>
        </div>

        {/* Tabs */}
        <div className="ej-tabs">
          <button
            className={`ej-tab ${shipmentTab === "air" ? "ej-tab--active" : ""}`}
            onClick={() => setShipmentTab("air")}
          >
            ✈ Aéreos ({trackingAir.length})
          </button>
          <button
            className={`ej-tab ${shipmentTab === "ocean" ? "ej-tab--active" : ""}`}
            onClick={() => setShipmentTab("ocean")}
          >
            🚢 Marítimos ({trackingOcean.length})
          </button>
        </div>

        {shipmentTab === "air" ? (
          recentAir.length === 0 ? (
            <div className="ej-empty">
              No hay seguimientos aéreos registrados.
            </div>
          ) : (
            <table className="ej-mini-table">
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
                      className="ej-clickable-row"
                      onClick={() => setSelectedAir(s)}
                    >
                      <td>
                        <span
                          className={`ej-badge ${delayed ? "ej-badge--delayed" : getAirBadgeClass(s.status)}`}
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
                            className="ej-flag"
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
                            className="ej-flag"
                          />
                        )}
                        {s.route?.destination.location.iata || "—"}
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.reference || "—"}</td>
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
          <div className="ej-empty">
            No hay seguimientos marítimos registrados.
          </div>
        ) : (
          <table className="ej-mini-table">
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
                    className="ej-clickable-row"
                    onClick={() => setSelectedOcean(s)}
                  >
                    <td>
                      <span
                        className={`ej-badge ${delayed ? "ej-badge--delayed" : getOceanBadgeClass(s.status)}`}
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
                          className="ej-flag"
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
                          className="ej-flag"
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
                      {formatDate(s.route?.port_of_discharge.date_of_discharge)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Cartera de Clientes + Distribución ──────────────────────────── */}
      <div className="ej-grid-client">
        {/* Client Portfolio */}
        <div className="ej-panel">
          <div className="ej-section-header" style={{ marginBottom: 14 }}>
            <h3 className="ej-section-title" style={{ margin: 0 }}>
              Cartera de Clientes
            </h3>
            <button
              className="ej-view-all"
              onClick={() => setListModal("all-clients")}
            >
              Ver todos →
            </button>
          </div>

          <input
            type="text"
            className="ej-filter-bar__search"
            placeholder="Buscar cliente..."
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <div className="ej-client-list">
            {filteredClients.length === 0 ? (
              <div className="ej-empty">Sin resultados.</div>
            ) : (
              filteredClients.slice(0, 12).map((c) => {
                const total = c.trackingAir + c.trackingOcean;
                return (
                  <div
                    key={c.username}
                    className="ej-client-row"
                    onClick={() => {
                      setModalClient(c.username);
                      setListModal("client-detail");
                    }}
                  >
                    <div className="ej-client-row__avatar">
                      {(c.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ej-client-row__name">{c.username}</div>
                      <div style={{ fontSize: 11, color: "#8b92a5" }}>
                        ✈{c.trackingAir} 🚢{c.trackingOcean} seguimientos
                      </div>
                    </div>
                    <span className="ej-client-row__count">{total}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Distribución de Seguimientos */}
        <div className="ej-panel">
          <h3 className="ej-section-title">Distribución</h3>
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ej-cyan)",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              ✈ Aéreos
            </div>
            <DonutChart segments={airDonut} size={90} />
            <div className="ej-status-grid" style={{ marginTop: 8 }}>
              <StatusBar
                label="En Tránsito"
                count={airStatusDist["EN_ROUTE"] || 0}
                total={trackingAir.length}
                color="#0891b2"
              />
              <StatusBar
                label="Aterrizado"
                count={airStatusDist["LANDED"] || 0}
                total={trackingAir.length}
                color="#059669"
              />
              <StatusBar
                label="Entregado"
                count={airStatusDist["DELIVERED"] || 0}
                total={trackingAir.length}
                color="#22c55e"
              />
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ej-blue)",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              🚢 Marítimos
            </div>
            <DonutChart segments={oceanDonut} size={90} />
            <div className="ej-status-grid" style={{ marginTop: 8 }}>
              <StatusBar
                label="Navegando"
                count={oceanStatusDist["SAILING"] || 0}
                total={trackingOcean.length}
                color="#2563eb"
              />
              <StatusBar
                label="Arribado"
                count={oceanStatusDist["ARRIVED"] || 0}
                total={trackingOcean.length}
                color="#059669"
              />
              <StatusBar
                label="Descargado"
                count={oceanStatusDist["DISCHARGED"] || 0}
                total={trackingOcean.length}
                color="#22c55e"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Individual shipsgo detail modals */}
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

      {/* List modal */}
      {listModal && (
        <EjListModal
          type={listModal}
          tab={listModalTab}
          onTabChange={setListModalTab}
          onClose={() => {
            setListModal(null);
            setModalClient(null);
          }}
          clientStats={clientStats}
          trackingAir={trackingAir}
          trackingOcean={trackingOcean}
          airInTransit={airInTransit}
          oceanInTransit={oceanInTransit}
          airDelayed={airDelayed}
          oceanDelayed={oceanDelayed}
          modalClient={modalClient}
          onSelectAir={(s) => {
            setListModal(null);
            setSelectedAir(s);
          }}
          onSelectOcean={(s) => {
            setListModal(null);
            setSelectedOcean(s);
          }}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MiniStat
// ═══════════════════════════════════════════════════════════════════════════

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
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderRadius: 8,
        background: "#fafbfc",
        border: "1px solid var(--ej-border)",
      }}
    >
      <span
        style={{ fontSize: 12, fontWeight: 600, color: "var(--ej-text-muted)" }}
      >
        {label}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EjListModal — Full-list overlay
// ═══════════════════════════════════════════════════════════════════════════

interface EjListModalProps {
  type: NonNullable<ListModalType>;
  tab: "air" | "ocean" | "all";
  onTabChange: (t: "air" | "ocean" | "all") => void;
  onClose: () => void;
  clientStats: ClientStats[];
  trackingAir: AirShipment[];
  trackingOcean: OceanShipment[];
  airInTransit: AirShipment[];
  oceanInTransit: OceanShipment[];
  airDelayed: AirShipment[];
  oceanDelayed: OceanShipment[];
  modalClient: string | null;
  onSelectAir: (s: AirShipment) => void;
  onSelectOcean: (s: OceanShipment) => void;
  onNavigate: (path: string) => void;
}

function EjListModal({
  type,
  tab,
  onTabChange,
  onClose,
  clientStats,
  trackingAir,
  trackingOcean,
  airInTransit,
  oceanInTransit,
  airDelayed,
  oceanDelayed,
  modalClient,
  onSelectAir,
  onSelectOcean,
  onNavigate,
}: EjListModalProps) {
  const [search, setSearch] = useState("");

  let title = "";
  let showTrackingTabs = false;
  let airList: AirShipment[] = [];
  let oceanList: OceanShipment[] = [];

  switch (type) {
    case "all-trackings":
      title = "Todos los Seguimientos";
      airList = trackingAir;
      oceanList = trackingOcean;
      showTrackingTabs = true;
      break;
    case "kpi-trackings":
      title = "Envíos En Movimiento";
      airList = airInTransit;
      oceanList = oceanInTransit;
      showTrackingTabs = true;
      break;
    case "kpi-delayed":
      title = "Retrasos Activos";
      airList = airDelayed;
      oceanList = oceanDelayed;
      showTrackingTabs = true;
      break;
    default:
      break;
  }

  // Filtering tracking lists by search
  const filteredAirList = search
    ? airList.filter(
        (s) =>
          s.awb_number.toLowerCase().includes(search.toLowerCase()) ||
          (s.reference || "").toLowerCase().includes(search.toLowerCase()) ||
          (s.airline?.name || "").toLowerCase().includes(search.toLowerCase()),
      )
    : airList;
  const filteredOceanList = search
    ? oceanList.filter(
        (s) =>
          (s.container_number || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (s.booking_number || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (s.reference || "").toLowerCase().includes(search.toLowerCase()) ||
          (s.carrier?.name || "").toLowerCase().includes(search.toLowerCase()),
      )
    : oceanList;

  const filteredAir = tab === "ocean" ? [] : filteredAirList;
  const filteredOcean = tab === "air" ? [] : filteredOceanList;

  // ── Render: Tracking modals ──
  if (showTrackingTabs) {
    const hasBothTypes = airList.length > 0 && oceanList.length > 0;
    return (
      <div className="ej-list-overlay" onClick={onClose}>
        <div className="ej-list-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ej-list-modal__header">
            <h2 className="ej-list-modal__title">{title}</h2>
            <button className="ej-list-modal__close" onClick={onClose}>
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

          <div style={{ padding: "0 24px" }}>
            <input
              type="text"
              className="ej-filter-bar__search"
              placeholder="Buscar AWB, container, cliente, aerolínea..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", marginTop: 12 }}
            />
          </div>

          {hasBothTypes && (
            <div className="ej-tabs" style={{ padding: "0 24px" }}>
              <button
                className={`ej-tab ${tab === "all" ? "ej-tab--active" : ""}`}
                onClick={() => onTabChange("all")}
              >
                Todos ({airList.length + oceanList.length})
              </button>
              <button
                className={`ej-tab ${tab === "air" ? "ej-tab--active" : ""}`}
                onClick={() => onTabChange("air")}
              >
                ✈ Aéreos ({airList.length})
              </button>
              <button
                className={`ej-tab ${tab === "ocean" ? "ej-tab--active" : ""}`}
                onClick={() => onTabChange("ocean")}
              >
                🚢 Marítimos ({oceanList.length})
              </button>
            </div>
          )}

          <div className="ej-list-modal__body">
            {filteredAir.length > 0 && (
              <>
                {hasBothTypes && tab === "all" && (
                  <h4 className="ej-list-modal__subtitle">
                    ✈ Aéreos ({filteredAir.length})
                  </h4>
                )}
                <table className="ej-mini-table">
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
                          className="ej-clickable-row"
                          onClick={() => onSelectAir(s)}
                        >
                          <td>
                            <span
                              className={`ej-badge ${delayed ? "ej-badge--delayed" : getAirBadgeClass(s.status)}`}
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
                                className="ej-flag"
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
                                className="ej-flag"
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

            {filteredOcean.length > 0 && (
              <>
                {hasBothTypes && tab === "all" && (
                  <h4 className="ej-list-modal__subtitle">
                    🚢 Marítimos ({filteredOcean.length})
                  </h4>
                )}
                <table className="ej-mini-table">
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
                          className="ej-clickable-row"
                          onClick={() => onSelectOcean(s)}
                        >
                          <td>
                            <span
                              className={`ej-badge ${delayed ? "ej-badge--delayed" : getOceanBadgeClass(s.status)}`}
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
                                  s.route.port_of_loading.location.country.code,
                                )}
                                alt=""
                                className="ej-flag"
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
                                className="ej-flag"
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
              <div className="ej-empty">
                No hay seguimientos en esta categoría.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Client list modal ──
  if (type === "all-clients") {
    return (
      <div className="ej-list-overlay" onClick={onClose}>
        <div className="ej-list-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ej-list-modal__header">
            <h2 className="ej-list-modal__title">
              Mis Clientes ({clientStats.length})
            </h2>
            <button className="ej-list-modal__close" onClick={onClose}>
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
          <div style={{ padding: "0 24px" }}>
            <input
              type="text"
              className="ej-filter-bar__search"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", marginTop: 12 }}
            />
          </div>
          <div className="ej-list-modal__body">
            <table className="ej-mini-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre Empresa</th>
                  <th>Nombre Cliente</th>
                  <th>Email</th>
                  <th>✈ Aéreo</th>
                  <th>🚢 Marítimo</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {clientStats
                  .filter(
                    (c) =>
                      !search ||
                      c.username.toLowerCase().includes(search.toLowerCase()) ||
                      (c.nombreuser || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((c, i) => (
                    <tr
                      key={c.username}
                      className="ej-clickable-row"
                      onClick={() => onNavigate("/admin/reporteriaclientes")}
                    >
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background:
                              i === 0
                                ? "var(--ej-orange)"
                                : i === 1
                                  ? "#64748b"
                                  : i === 2
                                    ? "#94a3b8"
                                    : "#cbd5e1",
                            color: i < 3 ? "#fff" : "#64748b",
                            fontSize: 11,
                            fontWeight: 700,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.username}</td>
                      <td style={{ fontSize: 11, color: "#8b92a5" }}>
                        {c.nombreuser}
                      </td>
                      <td style={{ fontSize: 11, color: "#8b92a5" }}>
                        {c.email}
                      </td>
                      <td>{c.trackingAir}</td>
                      <td>{c.trackingOcean}</td>
                      <td
                        style={{ fontWeight: 700, color: "var(--ej-orange)" }}
                      >
                        {c.trackingAir + c.trackingOcean}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Client detail modal ──
  if (type === "client-detail" && modalClient) {
    const cs = clientStats.find((c) => c.username === modalClient);
    const clientTrackingAir = trackingAir.filter(
      (s) => s.reference === modalClient,
    );
    const clientTrackingOcean = trackingOcean.filter(
      (s) => s.reference === modalClient,
    );

    return (
      <div className="ej-list-overlay" onClick={onClose}>
        <div className="ej-list-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ej-list-modal__header">
            <h2 className="ej-list-modal__title">
              📊 {cs?.nombreuser || modalClient}
            </h2>
            <button className="ej-list-modal__close" onClick={onClose}>
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
          <div className="ej-list-modal__body">
            {/* Client KPIs mini */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <MiniStat
                label="✈ Aéreos"
                value={clientTrackingAir.length}
                color="var(--ej-cyan)"
              />
              <MiniStat
                label="🚢 Marítimos"
                value={clientTrackingOcean.length}
                color="var(--ej-blue)"
              />
              <MiniStat
                label="🔍 Seguimientos"
                value={clientTrackingAir.length + clientTrackingOcean.length}
                color="var(--ej-green)"
              />
            </div>

            {/* ShipsGo trackings for this client */}
            {(clientTrackingAir.length > 0 ||
              clientTrackingOcean.length > 0) && (
              <>
                <h4 className="ej-list-modal__subtitle">
                  🔍 Seguimientos en Tiempo Real
                </h4>
                {clientTrackingAir.length > 0 && (
                  <table className="ej-mini-table" style={{ marginBottom: 16 }}>
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>AWB</th>
                        <th>Aerolínea</th>
                        <th>Origen → Destino</th>
                        <th>Progreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientTrackingAir.map((s) => {
                        const delayed = isAirDelayed(s);
                        return (
                          <tr
                            key={s.id}
                            className="ej-clickable-row"
                            onClick={() => onSelectAir(s)}
                          >
                            <td>
                              <span
                                className={`ej-badge ${delayed ? "ej-badge--delayed" : getAirBadgeClass(s.status)}`}
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
                              {s.route?.origin.location.iata || "?"} →{" "}
                              {s.route?.destination.location.iata || "?"}
                            </td>
                            <td style={{ minWidth: 100 }}>
                              <ProgressBar
                                value={s.route?.transit_percentage ?? 0}
                                color={delayed ? "#dc2626" : "#0891b2"}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {clientTrackingOcean.length > 0 && (
                  <table className="ej-mini-table" style={{ marginBottom: 16 }}>
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Container</th>
                        <th>Naviera</th>
                        <th>Origen → Destino</th>
                        <th>Progreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientTrackingOcean.map((s) => {
                        const delayed = isOceanDelayed(s);
                        return (
                          <tr
                            key={s.id}
                            className="ej-clickable-row"
                            onClick={() => onSelectOcean(s)}
                          >
                            <td>
                              <span
                                className={`ej-badge ${delayed ? "ej-badge--delayed" : getOceanBadgeClass(s.status)}`}
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
                              {s.route?.port_of_loading.location.name || "?"} →{" "}
                              {s.route?.port_of_discharge.location.name || "?"}
                            </td>
                            <td style={{ minWidth: 100 }}>
                              <ProgressBar
                                value={s.route?.transit_percentage ?? 0}
                                color={delayed ? "#dc2626" : "#2563eb"}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {clientTrackingAir.length === 0 &&
              clientTrackingOcean.length === 0 && (
                <div className="ej-empty" style={{ marginBottom: 16 }}>
                  Sin seguimientos activos para este cliente.
                </div>
              )}

            {/* Navigate button */}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                className="ej-quick-action"
                onClick={() => {
                  onClose();
                  onNavigate("/admin/reporteriaclientes");
                }}
                style={{ display: "inline-flex" }}
              >
                Abrir Portal Completo de {cs?.nombreuser || modalClient} →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
