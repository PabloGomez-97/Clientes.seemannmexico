// src/components/administrador/ComportamientoDeClientes.tsx
// Behavior tracking dashboard – read-only view for ejecutivos
import { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import "./ComportamientoDeClients.css";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
}

// ── Types ──
interface ClientStats {
  totalEvents: number;
  quotesStarted: number;
  quotesCompleted: number;
  quotesAbandoned: number;
  completionRate: number;
  lastActivity: string;
  quoteTypes: string[];
}

interface ClientBehavior {
  email: string;
  username: string;
  usernames?: string[];
  nombreuser?: string;
  parentUsername?: string;
  stats: ClientStats | null;
}

interface Session {
  sessionId: string;
  quoteType: string;
  startedAt: string;
  endedAt: string;
  status: "completed" | "abandoned" | "in_progress";
  route: { origin: string; destination: string } | null;
  lastStep: { step: string; stepNumber: number; totalSteps: number } | null;
  eventsCount: number;
  isRecurring?: boolean | null;
  quoteNumber?: string | null;
}

interface ClientDetail {
  sessions: Session[];
  summary: {
    totalSessions: number;
    completed: number;
    abandoned: number;
    byType: Record<
      string,
      { started: number; completed: number; abandoned: number }
    >;
  };
}

interface Analytics {
  abandonmentByStep: { quoteType: string; step: string; count: number }[];
  abandonmentByType: { quoteType: string; event: string; count: number }[];
  topRoutes: {
    origin: string;
    destination: string;
    quoteType: string;
    count: number;
  }[];
  completionTrend: { date: string; event: string; count: number }[];
}

interface TemperatureClient {
  email: string;
  username: string;
  usernames: string[];
  nombreuser: string;
  ejecutivoEmail: string | null;
  createdAt: string;
  completed30d: number;
  consecutiveAbandons: number;
  bucket: "frio" | "tibio" | "caliente" | "new";
  isCold: boolean;
  isHotAbandons: boolean;
  lastActivity: string | null;
  lastCompletedAt: string | null;
}

interface TemperatureSummary {
  counts: {
    frio: number;
    tibio: number;
    caliente: number;
    masAbandonos: number;
  };
  lists: {
    frio: TemperatureClient[];
    tibio: TemperatureClient[];
    caliente: TemperatureClient[];
    masAbandonos: TemperatureClient[];
  };
}

// ── Expand accounts with multiple company names into separate list entries ──
function expandClients(rawClients: ClientBehavior[]): ClientBehavior[] {
  const expanded: ClientBehavior[] = [];
  for (const client of rawClients) {
    const names =
      client.usernames && client.usernames.length > 1
        ? client.usernames
        : [client.username];
    for (let i = 0; i < names.length; i++) {
      expanded.push({
        ...client,
        username: names[i],
        parentUsername: i > 0 ? names[0] : undefined,
      });
    }
  }
  return expanded;
}

// ── Helpers ──
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es-CL");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const stepLabels: Record<string, string> = {
  commodity: "Detalles de carga",
  incoterm_charges: "Incoterm y cargos",
  route_selection: "Selección de ruta",
};

Object.assign(stepLabels, {
  datos_cargamento: "Datos del cargamento",
  servicios_adicionales: "Servicios adicionales",
  revision: "Revision",
});

const statusColors: Record<string, { bg: string; text: string; dot: string }> =
  {
    completed: { bg: "#ecfdf5", text: "#065f46", dot: "#10b981" },
    abandoned: { bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
    in_progress: { bg: "#fffbeb", text: "#92400e", dot: "#f59e0b" },
  };

const statusLabels: Record<string, string> = {
  completed: "Completada",
  abandoned: "Abandonada",
  in_progress: "En progreso",
};

const typeColors: Record<string, string> = {
  AIR: "#3b82f6",
  FCL: "#8b5cf6",
  LCL: "#06b6d4",
};

Object.assign(typeColors, {
  LASTMILE: "#0d9488",
});

const QUOTE_TYPES = ["AIR", "FCL", "LCL", "LASTMILE"] as const;

// ══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL CLIENT ANALYTICS PANEL
// ══════════════════════════════════════════════════════════════════════════════

function ClientAnalyticsPanel({ detail }: { detail: ClientDetail }) {
  const { summary, sessions } = detail;
  const completed = summary.completed;
  const abandoned = summary.abandoned;
  const inProgress = summary.totalSessions - completed - abandoned;
  const total = summary.totalSessions || 1;

  const completionRate = Math.round((completed / total) * 100);

  // Donut chart geometry
  const R = 48;
  const CX = 60;
  const CY = 60;
  const circumference = 2 * Math.PI * R;

  function segmentOffset(startFraction: number) {
    return circumference * (1 - startFraction);
  }
  function segmentDash(fraction: number) {
    return `${circumference * fraction} ${circumference * (1 - fraction)}`;
  }

  const completedFrac = completed / total;
  const abandonedFrac = abandoned / total;
  const inProgressFrac = inProgress / total;

  // Step abandonment — count how many abandoned sessions had each lastStep
  const stepAbandonment: Record<string, number> = {};
  sessions.forEach((s) => {
    if (s.status === "abandoned" && s.lastStep?.step) {
      stepAbandonment[s.lastStep.step] =
        (stepAbandonment[s.lastStep.step] || 0) + 1;
    }
  });
  const stepEntries = Object.entries(stepAbandonment).sort(
    (a, b) => b[1] - a[1],
  );
  const maxStepCount = stepEntries.length > 0 ? stepEntries[0][1] : 1;

  const DONUT_COLORS = {
    completed: "#10b981",
    abandoned: "#ef4444",
    in_progress: "#f59e0b",
  };

  // rotation offsets for donut segments
  // we rotate the SVG so that completed starts at top (-90deg)
  const startAngles = {
    completed: 0,
    abandoned: completedFrac,
    in_progress: completedFrac + abandonedFrac,
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 20,
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#1f2937",
          margin: "0 0 20px",
        }}
      >
        Análisis individual
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 24,
        }}
      >
        {/* ── Donut chart: status breakdown ── */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Distribución de cotizaciones
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width={120} height={120} viewBox="0 0 120 120">
              {/* background track */}
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke="#f3f4f6"
                strokeWidth={14}
              />
              {/* completed segment */}
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={DONUT_COLORS.completed}
                strokeWidth={14}
                strokeDasharray={segmentDash(completedFrac)}
                strokeDashoffset={segmentOffset(startAngles.completed)}
                transform={`rotate(-90 ${CX} ${CY})`}
                strokeLinecap="butt"
              />
              {/* abandoned segment */}
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={DONUT_COLORS.abandoned}
                strokeWidth={14}
                strokeDasharray={segmentDash(abandonedFrac)}
                strokeDashoffset={segmentOffset(startAngles.abandoned)}
                transform={`rotate(-90 ${CX} ${CY})`}
                strokeLinecap="butt"
              />
              {/* in_progress segment */}
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={DONUT_COLORS.in_progress}
                strokeWidth={14}
                strokeDasharray={segmentDash(inProgressFrac)}
                strokeDashoffset={segmentOffset(startAngles.in_progress)}
                transform={`rotate(-90 ${CX} ${CY})`}
                strokeLinecap="butt"
              />
              {/* center text */}
              <text
                x={CX}
                y={CY - 6}
                textAnchor="middle"
                fontSize={20}
                fontWeight={700}
                fill="#1f2937"
              >
                {completionRate}%
              </text>
              <text
                x={CX}
                y={CY + 12}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
              >
                completación
              </text>
            </svg>

            {/* Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  color: DONUT_COLORS.completed,
                  label: "Completas",
                  count: completed,
                },
                {
                  color: DONUT_COLORS.abandoned,
                  label: "Abandonadas",
                  count: abandoned,
                },
                {
                  color: DONUT_COLORS.in_progress,
                  label: "En progreso",
                  count: inProgress,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#374151" }}>
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1f2937",
                      marginLeft: "auto",
                    }}
                  >
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bar chart: step abandonment ── */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Paso con más abandonos
          </div>
          {stepEntries.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9ca3af", paddingTop: 12 }}>
              Sin abandonos registrados.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stepEntries.map(([step, count]) => {
                const barPct = (count / maxStepCount) * 100;
                return (
                  <div key={step}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#374151" }}>
                        {stepLabels[step] || step}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#1f2937",
                        }}
                      >
                        {count}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        background: "#f3f4f6",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${barPct}%`,
                          height: "100%",
                          background: "#ef4444",
                          borderRadius: 4,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── KPI cards ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              marginBottom: 2,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Indicadores clave
          </div>
          {[
            {
              label: "Total sesiones",
              value: summary.totalSessions,
              color: "#6b7280",
            },
            {
              label: "Tasa de completación",
              value: `${completionRate}%`,
              color: "#10b981",
            },
            {
              label: "Tasa de abandono",
              value: `${Math.round((abandoned / total) * 100)}%`,
              color: "#ef4444",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                background: "#f8fafc",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {kpi.label}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: kpi.color,
                }}
              >
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface ComportamientoDeClientesProps {
  /** 'ejecutivo' shows only the ejecutivo's portfolio (default).
   *  'admin' shows ALL clients in the portal — used by OP-ComportamientoDeClientes. */
  scope?: "ejecutivo" | "admin";
}

export default function ComportamientoDeClientes({
  scope = "ejecutivo",
}: ComportamientoDeClientesProps = {}) {
  useOutletContext<OutletContext>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { clientUsername } = useParams<{ clientUsername?: string }>();

  const isAdminScope = scope === "admin";
  const CLIENTS_ENDPOINT = isAdminScope
    ? "/api/behavior-tracking/all-clients"
    : "/api/behavior-tracking/clients";
  const ANALYTICS_ENDPOINT = isAdminScope
    ? "/api/behavior-tracking/all-analytics"
    : "/api/behavior-tracking/analytics";
  const TEMPERATURE_ENDPOINT = isAdminScope
    ? "/api/behavior-tracking/temperature?scope=admin"
    : "/api/behavior-tracking/temperature";
  const ROUTE_BASE = isAdminScope
    ? "/admin/op-comportamiento-clientes"
    : "/admin/comportamiento-clientes";
  const QUOTE_VIEW_ROUTE_BASE = isAdminScope
    ? "/admin/op-reporteriaclientes"
    : "/admin/reporteriaclientes";
  const HEADER_TITLE = isAdminScope
    ? "Customer Behavior Tracking [Global]"
    : "Customer Behavior Tracking";
  const HEADER_SUBTITLE = isAdminScope
    ? "Seguimiento de cotizaciones de TODOS los clientes del portal"
    : "Seguimiento de cotizaciones de tus clientes";

  const [clients, setClients] = useState<ClientBehavior[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Detail view
  const [selectedClient, setSelectedClient] = useState<ClientBehavior | null>(
    null,
  );
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Analytics overview
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [view, setView] = useState<"clients" | "analytics">("clients");

  // Modal for clickable summary cards
  const [modalType, setModalType] = useState<
    "iniciadas" | "completadas" | "abandonadas" | null
  >(null);

  // Modal for clickable temperature cards (frío/tibio/caliente/abandonos)
  const [tempModalType, setTempModalType] = useState<
    "frio" | "tibio" | "caliente" | "masAbandonos" | null
  >(null);

  // Client temperature data
  const [temperature, setTemperature] = useState<TemperatureSummary | null>(
    null,
  );

  // Session history filters (client detail)
  const [sessionTab, setSessionTab] = useState<
    "all" | "completed" | "abandoned"
  >("all");
  const [routeFilter, setRouteFilter] = useState("");
  const [sessionPage, setSessionPage] = useState(1);

  // Individual client analytics panel
  const [showClientAnalytics, setShowClientAnalytics] = useState(false);

  // ── Fetch client list ──
  useEffect(() => {
    if (!token) return;
    const fetchClients = async () => {
      setLoading(true);
      try {
        const resp = await fetch(`${API_BASE_URL}${CLIENTS_ENDPOINT}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error("Error al cargar datos");
        const data = await resp.json();
        setClients(data.clients || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [token, CLIENTS_ENDPOINT]);

  // ── Fetch client temperature (frío/tibio/caliente/abandonos) ──
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchTemperature = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}${TEMPERATURE_ENDPOINT}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as TemperatureSummary;
        if (!cancelled) setTemperature(data);
      } catch {
        /* silent */
      }
    };
    fetchTemperature();
    return () => {
      cancelled = true;
    };
  }, [token, TEMPERATURE_ENDPOINT]);

  // ── Fetch analytics ──
  const fetchAnalytics = useCallback(async () => {
    if (!token) return;
    setAnalyticsLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}${ANALYTICS_ENDPOINT}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Error al cargar analytics");
      setAnalytics(await resp.json());
    } catch {
      /* silent */
    } finally {
      setAnalyticsLoading(false);
    }
  }, [token, ANALYTICS_ENDPOINT]);

  useEffect(() => {
    if (view === "analytics" && !analytics) fetchAnalytics();
  }, [view, analytics, fetchAnalytics]);

  // ── Fetch client detail ──
  const openClientDetail = useCallback(
    async (client: ClientBehavior) => {
      setSelectedClient(client);
      setDetailLoading(true);
      setSessionTab("all");
      setRouteFilter("");
      setSessionPage(1);
      setShowClientAnalytics(false);
      navigate(`${ROUTE_BASE}/${encodeURIComponent(client.username)}`, {
        replace: true,
      });
      try {
        const resp = await fetch(
          `${API_BASE_URL}/api/behavior-tracking/client/${encodeURIComponent(client.email)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!resp.ok) throw new Error("Error al cargar detalle");
        setClientDetail(await resp.json());
      } catch {
        setClientDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [token, navigate],
  );

  const handleBack = () => {
    setClientDetail(null);
    navigate(ROUTE_BASE, { replace: true });
  };

  // URL is the single source of truth for which client is open.
  // Intentionally excludes selectedClient to avoid the re-select race condition.
  useEffect(() => {
    if (!clientUsername) {
      setSelectedClient(null);
      setClientDetail(null);
      return;
    }
    if (loading || clients.length === 0) return;
    const decoded = decodeURIComponent(clientUsername).toLowerCase();
    const match = clients.find((c) => c.username.toLowerCase() === decoded);
    if (!match) return;
    setSelectedClient((prev) => {
      if (prev?.username.toLowerCase() === match.username.toLowerCase())
        return prev;
      // Fetch detail for newly selected client
      openClientDetail(match);
      return match;
    });
  }, [clientUsername, clients, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filters ──
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.username.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.nombreuser && c.nombreuser.toLowerCase().includes(q)),
    );
  }, [clients, search]);

  // Sort: clients with activity first, then alphabetical; then expand for multi-company
  const sortedClients = useMemo(() => {
    const sorted = [...filteredClients].sort((a, b) => {
      if (a.stats && !b.stats) return -1;
      if (!a.stats && b.stats) return 1;
      if (a.stats && b.stats) {
        return (
          new Date(b.stats.lastActivity).getTime() -
          new Date(a.stats.lastActivity).getTime()
        );
      }
      return a.username.localeCompare(b.username);
    });
    return expandClients(sorted);
  }, [filteredClients]);

  const uniqueAccountCount = useMemo(
    () => new Set(clients.map((c) => c.email)).size,
    [clients],
  );

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
  const totalInProgress = Math.max(
    0,
    totalStarted - totalCompleted - totalAbandoned,
  );
  const overallRate =
    totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;

  // ═══════════════ LOADING ═══════════════
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
          fontFamily: FONT,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid #f0f0f0",
              borderTop: "3px solid var(--primary-color, #ff6200)",
              borderRadius: "50%",
              animation: "cbt-spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <div style={{ color: "#8d99a8", fontSize: 13 }}>
            Cargando datos de comportamiento...
          </div>
          <style>{`@keyframes cbt-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ═══════════════ ERROR ═══════════════
  if (error) {
    return (
      <div style={{ fontFamily: FONT, padding: 40, textAlign: "center" }}>
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: "24px 32px",
            display: "inline-block",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#dc2626",
              marginBottom: 4,
            }}
          >
            Error
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{error}</div>
        </div>
      </div>
    );
  }

  // ═══════════════ CLIENT DETAIL VIEW ═══════════════
  if (selectedClient) {
    return (
      <div style={{ fontFamily: FONT }}>
        {/* Back button */}
        <button
          onClick={handleBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            color: "#374151",
            marginBottom: 20,
            transition: "all 0.15s",
            fontFamily: FONT,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f9fafb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver
        </button>

        {/* Client header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#232f3e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {selectedClient.username.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#1f2937",
                margin: 0,
              }}
            >
              {selectedClient.username}
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
              {selectedClient.email}
              {selectedClient.nombreuser && ` — ${selectedClient.nombreuser}`}
            </p>
          </div>
          <button
            onClick={() => setShowClientAnalytics((v) => !v)}
            style={{
              padding: "8px 16px",
              background: showClientAnalytics ? "#232f3e" : "none",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: showClientAnalytics ? "#fff" : "#374151",
              fontFamily: FONT,
              flexShrink: 0,
            }}
          >
            {showClientAnalytics ? "Ocultar análisis" : "Ver análisis"}
          </button>
        </div>

        {/* Summary cards */}
        {clientDetail?.summary && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <SummaryCard
              label="Cotizaciones iniciadas"
              value={clientDetail.summary.totalSessions}
            />
            <SummaryCard
              label="Completadas"
              value={clientDetail.summary.completed}
            />
            <SummaryCard
              label="Abandonadas"
              value={clientDetail.summary.abandoned}
            />
            <SummaryCard
              label="Tasa de completación"
              value={
                clientDetail.summary.totalSessions > 0
                  ? `${Math.round((clientDetail.summary.completed / clientDetail.summary.totalSessions) * 100)}%`
                  : "—"
              }
            />
          </div>
        )}

        {/* By type breakdown */}
        {clientDetail?.summary?.byType && (
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#374151",
                margin: "0 0 12px",
              }}
            >
              Desglose por tipo
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {QUOTE_TYPES.map((type) => {
                const data = clientDetail.summary.byType[type];
                if (!data || data.started === 0) return null;
                const rate =
                  data.started > 0
                    ? Math.round((data.completed / data.started) * 100)
                    : 0;
                return (
                  <div
                    key={type}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#fff",
                          background: typeColors[type] || "#6b7280",
                        }}
                      >
                        {type}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        color: "#6b7280",
                        marginTop: 4,
                      }}
                    >
                      <span>Completadas: {data.completed}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        color: "#6b7280",
                        marginTop: 4,
                      }}
                    >
                      <span>Abandonadas: {data.abandoned}</span>
                      <span style={{ fontWeight: 600, color: "#374151" }}>
                        Tasa: {rate}%
                      </span>
                    </div>

                    {/* Mini bar */}
                    <div
                      style={{
                        marginTop: 8,
                        height: 4,
                        borderRadius: 2,
                        background: "#f3f4f6",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${rate}%`,
                          background: typeColors[type] || "#6b7280",
                          borderRadius: 2,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Individual analytics panel ── */}
        {showClientAnalytics && clientDetail?.summary && (
          <ClientAnalyticsPanel detail={clientDetail} />
        )}

        {/* Sessions timeline */}
        <div>
          {/* Tabs + route filter row */}
          {clientDetail?.sessions && clientDetail.sessions.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  background: "#f3f4f6",
                  borderRadius: 8,
                  padding: 3,
                }}
              >
                {(
                  [
                    { key: "all", label: "Todas" },
                    { key: "completed", label: "Completas" },
                    { key: "abandoned", label: "Abandonadas" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setSessionTab(tab.key);
                      setSessionPage(1);
                    }}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: FONT,
                      background:
                        sessionTab === tab.key ? "#fff" : "transparent",
                      color: sessionTab === tab.key ? "#1f2937" : "#6b7280",
                      boxShadow:
                        sessionTab === tab.key
                          ? "0 1px 3px rgba(0,0,0,0.08)"
                          : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Route filter */}
              <input
                type="text"
                value={routeFilter}
                onChange={(e) => {
                  setRouteFilter(e.target.value);
                  setSessionPage(1);
                }}
                placeholder="Filtrar por ruta..."
                style={{
                  padding: "6px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: FONT,
                  outline: "none",
                  width: 200,
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#ff6200")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              />
            </div>
          )}

          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#374151",
              margin: "0 0 12px",
            }}
          >
            Historial de cotizaciones
          </h3>

          {detailLoading ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#8d99a8",
                fontSize: 13,
              }}
            >
              Cargando sesiones...
            </div>
          ) : !clientDetail?.sessions?.length ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#8d99a8",
                fontSize: 13,
              }}
            >
              Este cliente aún no tiene actividad de cotización registrada.
            </div>
          ) : (
            (() => {
              const filtered = clientDetail.sessions.filter((s) => {
                const tabMatch =
                  sessionTab === "all" ||
                  (sessionTab === "completed" && s.status === "completed") ||
                  (sessionTab === "abandoned" && s.status === "abandoned");
                const routeMatch =
                  !routeFilter.trim() ||
                  (s.route
                    ? `${s.route.origin} ${s.route.destination}`
                        .toLowerCase()
                        .includes(routeFilter.toLowerCase())
                    : false);
                return tabMatch && routeMatch;
              });
              const PAGE_SIZE = 6;
              const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
              const paginated = filtered.slice(0, sessionPage * PAGE_SIZE);
              return (
                <>
                  {filtered.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: 40,
                        color: "#8d99a8",
                        fontSize: 13,
                      }}
                    >
                      Sin resultados para los filtros seleccionados.
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {paginated.map((session) => {
                          const sc =
                            statusColors[session.status] ||
                            statusColors.in_progress;
                          return (
                            <div
                              key={session.sessionId}
                              style={{
                                background: "#fff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 10,
                                padding: "14px 18px",
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                flexWrap: "wrap",
                              }}
                            >
                              {/* Type badge */}
                              <span
                                style={{
                                  padding: "3px 10px",
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "#fff",
                                  background:
                                    typeColors[session.quoteType] || "#6b7280",
                                  flexShrink: 0,
                                }}
                              >
                                {session.quoteType}
                              </span>

                              {/* Route */}
                              <div style={{ flex: 1, minWidth: 120 }}>
                                {session.route ? (
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 500,
                                      color: "#1f2937",
                                    }}
                                  >
                                    {session.route.origin} →{" "}
                                    {session.route.destination}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: "#9ca3af",
                                    }}
                                  >
                                    Sin ruta seleccionada
                                  </span>
                                )}
                              </div>

                              {/* Recurring badge */}
                              {session.status === "completed" &&
                                session.quoteType !== "LASTMILE" &&
                                session.isRecurring != null && (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: 20,
                                      fontSize: 10,
                                      fontWeight: 600,
                                      background:
                                        session.isRecurring === false
                                          ? "#fff7ed"
                                          : "#f0fdf4",
                                      color:
                                        session.isRecurring === false
                                          ? "#c2410c"
                                          : "#15803d",
                                      border:
                                        session.isRecurring === false
                                          ? "1px solid #fed7aa"
                                          : "1px solid #bbf7d0",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {session.isRecurring === false
                                      ? "No recurrente"
                                      : "Recurrente"}
                                  </span>
                                )}

                              {/* Last step (if abandoned) */}
                              {session.status === "abandoned" &&
                                session.lastStep && (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "#9ca3af",
                                    }}
                                  >
                                    Último paso:{" "}
                                    {stepLabels[session.lastStep.step] ||
                                      session.lastStep.step}
                                  </span>
                                )}

                              {/* Status */}
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "3px 10px",
                                  borderRadius: 20,
                                  fontSize: 11,
                                  fontWeight: 500,
                                  background: sc.bg,
                                  color: sc.text,
                                  flexShrink: 0,
                                }}
                              >
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: sc.dot,
                                  }}
                                />
                                {statusLabels[session.status]}
                              </span>

                              {/* Quote number + Ver Cotizaciones (completed only) */}
                              {session.status === "completed" && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexShrink: 0,
                                  }}
                                >
                                  {session.quoteNumber && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: "#6b7280",
                                        fontWeight: 500,
                                      }}
                                    >
                                      #{session.quoteNumber}
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(
                                        `${QUOTE_VIEW_ROUTE_BASE}/${selectedClient.username}`,
                                      );
                                    }}
                                    style={{
                                      padding: "3px 10px",
                                      background: "#ff6200",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontFamily: FONT,
                                    }}
                                  >
                                    Ver cotización
                                  </button>
                                </div>
                              )}

                              {/* Date */}
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "#9ca3af",
                                  flexShrink: 0,
                                }}
                              >
                                {formatDate(session.startedAt)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Load more */}
                      {sessionPage < totalPages && (
                        <div style={{ textAlign: "center", marginTop: 16 }}>
                          <button
                            onClick={() => setSessionPage((p) => p + 1)}
                            style={{
                              padding: "8px 24px",
                              background: "none",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#374151",
                              fontFamily: FONT,
                            }}
                          >
                            Ver más ({filtered.length - sessionPage * PAGE_SIZE}{" "}
                            restantes)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()
          )}

          {/* ── Step legend ── */}
          {clientDetail?.sessions && clientDetail.sessions.length > 0 && (
            <div
              style={{
                marginTop: 20,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "14px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#64748b",
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Guía de estados
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 8,
                }}
              >
                {[
                  {
                    icon: "○",
                    color: "#94a3b8",
                    title: "Sin último paso",
                    desc: "El cliente no ingresó una ruta de transporte",
                  },
                  {
                    icon: "●",
                    color: "#f59e0b",
                    title: "Último paso: (2) Selección de ruta",
                    desc: "Ingresó la ruta pero no continuó",
                  },
                  {
                    icon: "●",
                    color: "#3b82f6",
                    title: "Último paso: (3) Detalles de carga",
                    desc: "Ingresó datos de carga pero no finalizó",
                  },
                  {
                    icon: "●",
                    color: "#8b5cf6",
                    title: "Último paso: (4) Incoterm y cargos",
                    desc: "Abandonó en la última etapa",
                  },
                  {
                    icon: "✓",
                    color: "#10b981",
                    title: "Recurrente",
                    desc: "Ruta con tarifa configurada",
                  },
                  {
                    icon: "!",
                    color: "#f97316",
                    title: "No recurrente",
                    desc: "Ruta sin tarifa — requiere tarificación manual",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: item.color,
                        fontWeight: 700,
                        minWidth: 14,
                        marginTop: 1,
                      }}
                    >
                      {item.icon}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#374151",
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════ ANALYTICS VIEW ═══════════════
  if (view === "analytics") {
    return (
      <div style={{ fontFamily: FONT }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1f2937",
                margin: 0,
              }}
            >
              Análisis de cotizaciones
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              Patrones de abandono y comportamiento en el proceso de cotización
            </p>
          </div>
          <button
            onClick={() => setView("clients")}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: "#374151",
              fontFamily: FONT,
            }}
          >
            Ver clientes
          </button>
        </div>

        {analyticsLoading ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "#8d99a8",
              fontSize: 13,
            }}
          >
            Cargando análisis...
          </div>
        ) : !analytics ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "#8d99a8",
              fontSize: 13,
            }}
          >
            No hay datos de análisis disponibles.
          </div>
        ) : (
          <>
            {/* Abandonment by type */}
            <div style={{ marginBottom: 32 }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#374151",
                  margin: "0 0 12px",
                }}
              >
                Tasa de abandono por tipo de cotización
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                {QUOTE_TYPES.map((type) => {
                  const events = analytics.abandonmentByType.filter(
                    (e) => e.quoteType === type,
                  );
                  const started =
                    events.find((e) => e.event === "QUOTE_STARTED")?.count || 0;
                  const completed =
                    events.find((e) => e.event === "QUOTE_COMPLETED")?.count ||
                    0;
                  const abandoned =
                    events.find((e) => e.event === "QUOTE_ABANDONED")?.count ||
                    0;
                  const abandonRate =
                    started > 0 ? Math.round((abandoned / started) * 100) : 0;

                  return (
                    <div
                      key={type}
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 20,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#fff",
                            background: typeColors[type],
                          }}
                        >
                          {type}
                        </span>
                        <span
                          style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: "#1f2937",
                            marginLeft: "auto",
                          }}
                        >
                          {abandonRate}%
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        abandono
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          height: 4,
                          borderRadius: 2,
                          background: "#f3f4f6",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${abandonRate}%`,
                            background: "#ef4444",
                            borderRadius: 2,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          color: "#9ca3af",
                          marginTop: 8,
                        }}
                      >
                        <span>Iniciadas: {started}</span>
                        <span>Completadas: {completed}</span>
                        <span>Abandonadas: {abandoned}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Abandonment by step */}
            {analytics.abandonmentByStep.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#374151",
                    margin: "0 0 12px",
                  }}
                >
                  Pasos con mayor abandono
                </h3>
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  {analytics.abandonmentByStep.map((item, idx) => {
                    const maxCount = analytics.abandonmentByStep[0]?.count || 1;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 18px",
                          borderBottom:
                            idx < analytics.abandonmentByStep.length - 1
                              ? "1px solid #f3f4f6"
                              : "none",
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#fff",
                            background: typeColors[item.quoteType] || "#6b7280",
                            flexShrink: 0,
                          }}
                        >
                          {item.quoteType}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: "#374151",
                            fontWeight: 500,
                            minWidth: 140,
                          }}
                        >
                          {stepLabels[item.step] ||
                            item.step ||
                            "Paso 1 – Ruta"}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            background: "#f3f4f6",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${(item.count / maxCount) * 100}%`,
                              background: "#ef4444",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1f2937",
                            flexShrink: 0,
                          }}
                        >
                          {item.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top routes */}
            {analytics.topRoutes.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#374151",
                    margin: "0 0 12px",
                  }}
                >
                  Rutas más consultadas
                </h3>
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  {analytics.topRoutes.map((route, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 18px",
                        borderBottom:
                          idx < analytics.topRoutes.length - 1
                            ? "1px solid #f3f4f6"
                            : "none",
                      }}
                    >
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#fff",
                          background: typeColors[route.quoteType] || "#6b7280",
                          flexShrink: 0,
                        }}
                      >
                        {route.quoteType}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#1f2937",
                        }}
                      >
                        {route.origin} → {route.destination}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "#9ca3af",
                          marginLeft: "auto",
                          flexShrink: 0,
                        }}
                      >
                        {route.count} consultas
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ═══════════════ CLIENTS LIST VIEW (default) ═══════════════
  return (
    <div style={{ fontFamily: FONT }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#1f2937",
              margin: 0,
            }}
          >
            {HEADER_TITLE}
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
            {HEADER_SUBTITLE}
          </p>
        </div>
        <button
          onClick={() => setView("analytics")}
          style={{
            padding: "8px 16px",
            background: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            color: "#374151",
            fontFamily: FONT,
          }}
        >
          Ver análisis
        </button>
      </div>

      {/* Summary cards */}
      <div className="cb-metrics-strip">
        <SummaryCard label="Cuentas" value={uniqueAccountCount} />
        <SummaryCard label="Empresas" value={sortedClients.length} />
        <SummaryCard
          label="Cotizaciones iniciadas"
          value={totalStarted}
          onClick={() => setModalType("iniciadas")}
        />
        <SummaryCard
          label="Completadas"
          value={totalCompleted}
          onClick={() => setModalType("completadas")}
        />
        <SummaryCard
          label="Abandonadas"
          value={totalAbandoned}
          onClick={() => setModalType("abandonadas")}
        />
        <SummaryCard label="En progreso" value={totalInProgress} />
        <SummaryCard label="Tasa global" value={`${overallRate}%`} />
      </div>

      <div>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
          Clasificación de clientes según actividad de cotizaciones en los
          últimos 30 días
        </p>
      </div>

      {/* Temperature strip (frío/tibio/caliente/más abandonos) */}
      <div className="cb-metrics-strip cb-metrics-strip--four mt-3">
        <SummaryCard
          label="Clientes fríos"
          value={temperature?.counts.frio ?? "—"}
          onClick={
            temperature && temperature.counts.frio > 0
              ? () => setTempModalType("frio")
              : undefined
          }
        />
        <SummaryCard
          label="Clientes tibios"
          value={temperature?.counts.tibio ?? "—"}
          onClick={
            temperature && temperature.counts.tibio > 0
              ? () => setTempModalType("tibio")
              : undefined
          }
        />
        <SummaryCard
          label="Clientes calientes"
          value={temperature?.counts.caliente ?? "—"}
          onClick={
            temperature && temperature.counts.caliente > 0
              ? () => setTempModalType("caliente")
              : undefined
          }
        />
        <SummaryCard
          label="Clientes con más abandonos"
          value={temperature?.counts.masAbandonos ?? "—"}
          onClick={
            temperature && temperature.counts.masAbandonos > 0
              ? () => setTempModalType("masAbandonos")
              : undefined
          }
        />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          style={{
            width: "100%",
            maxWidth: 360,
            padding: "9px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: FONT,
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#ff6200")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
        />
      </div>

      {/* Client cards */}
      {sortedClients.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "#8d99a8",
            fontSize: 13,
          }}
        >
          {search
            ? "No se encontraron clientes."
            : "Aún no hay datos de comportamiento registrados."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sortedClients.map((client) => (
            <div
              key={`${client.email}-${client.username}`}
              onClick={() => openClientDetail(client)}
              style={{
                background: client.parentUsername ? "#fffbf5" : "#fff",
                border: client.parentUsername
                  ? "1px solid #fde68a"
                  : "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "14px 18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                transition: "border-color 0.15s, box-shadow 0.15s",
                flexWrap: "wrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = client.parentUsername
                  ? "#f59e0b"
                  : "rgba(255,98,0,0.35)";
                e.currentTarget.style.boxShadow =
                  "0 2px 10px rgba(255,98,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = client.parentUsername
                  ? "#fde68a"
                  : "#e5e7eb";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: client.parentUsername ? "#f59e0b" : "#232f3e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {client.username.charAt(0).toUpperCase()}
              </div>

              {/* Name/email */}
              <div style={{ flex: 1, minWidth: 120 }}>
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}
                >
                  {client.username}
                </div>
                {client.parentUsername && (
                  <div style={{ fontSize: 11, color: "#d97706", marginTop: 1 }}>
                    Cuenta: {client.parentUsername}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {client.email}
                </div>
              </div>

              {/* Stats */}
              {client.stats ? (
                <>
                  {/* Quote types */}
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {client.stats.quoteTypes.map((type) => (
                      <span
                        key={type}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#fff",
                          background: typeColors[type] || "#6b7280",
                        }}
                      >
                        {type}
                      </span>
                    ))}
                  </div>

                  {/* Numbers */}
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      fontSize: 12,
                      color: "#6b7280",
                      flexShrink: 0,
                    }}
                  >
                    <span>
                      Iniciadas:{" "}
                      <strong style={{ color: "#1f2937" }}>
                        {client.stats.quotesStarted}
                      </strong>
                    </span>
                    <span>
                      Completadas:{" "}
                      <strong style={{ color: "#10b981" }}>
                        {client.stats.quotesCompleted}
                      </strong>
                    </span>
                    <span>
                      Abandonadas:{" "}
                      <strong style={{ color: "#ef4444" }}>
                        {client.stats.quotesAbandoned}
                      </strong>
                    </span>
                  </div>

                  {/* Completion rate */}
                  <div style={{ width: 48, textAlign: "right", flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          client.stats.completionRate >= 70
                            ? "#10b981"
                            : client.stats.completionRate >= 40
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    >
                      {client.stats.completionRate}%
                    </span>
                  </div>

                  {/* Last activity */}
                  <span
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      flexShrink: 0,
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {timeAgo(client.stats.lastActivity)}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#d1d5db" }}>
                  Sin actividad
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: clients who generated started/completed/abandoned quotes ── */}
      {modalType && (
        <div
          onClick={() => setModalType(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "24px 28px",
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              overflowY: "auto",
              fontFamily: FONT,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                {modalType === "iniciadas"
                  ? "Clientes con cotizaciones iniciadas"
                  : modalType === "completadas"
                    ? "Clientes con cotizaciones completadas"
                    : "Clientes con cotizaciones abandonadas"}
              </h2>
              <button
                onClick={() => setModalType(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  color: "#6b7280",
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>

            {/* List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {clients
                .filter((c) => {
                  if (!c.stats) return false;
                  if (modalType === "iniciadas")
                    return c.stats.quotesStarted > 0;
                  if (modalType === "completadas")
                    return c.stats.quotesCompleted > 0;
                  return c.stats.quotesAbandoned > 0;
                })
                .sort((a, b) => {
                  const getVal = (c: ClientBehavior) =>
                    modalType === "iniciadas"
                      ? c.stats!.quotesStarted
                      : modalType === "completadas"
                        ? c.stats!.quotesCompleted
                        : c.stats!.quotesAbandoned;
                  return getVal(b) - getVal(a);
                })
                .map((client) => {
                  const val =
                    modalType === "iniciadas"
                      ? client.stats!.quotesStarted
                      : modalType === "completadas"
                        ? client.stats!.quotesCompleted
                        : client.stats!.quotesAbandoned;
                  const valColor =
                    modalType === "completadas"
                      ? "#10b981"
                      : modalType === "abandonadas"
                        ? "#ef4444"
                        : "#1f2937";
                  return (
                    <div
                      key={`${client.email}-${client.username}`}
                      onClick={() => {
                        setModalType(null);
                        openClientDetail(client);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#f9fafb")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "#232f3e",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {client.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1f2937",
                          }}
                        >
                          {client.username}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {client.email}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: valColor,
                          flexShrink: 0,
                        }}
                      >
                        {val}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: temperature buckets (frío/tibio/caliente/más abandonos) ── */}
      {tempModalType && temperature && (
        <div
          onClick={() => setTempModalType(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "24px 28px",
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              overflowY: "auto",
              fontFamily: FONT,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                {tempModalType === "frio"
                  ? "Clientes fríos (0 cot. completas en 30 días)"
                  : tempModalType === "tibio"
                    ? "Clientes tibios (1–2 cot. completas en 30 días)"
                    : tempModalType === "caliente"
                      ? "Clientes calientes (3+ cot. completas en 30 días)"
                      : "Clientes con más abandonos (4+ consecutivos)"}
              </h2>
              <button
                onClick={() => setTempModalType(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  color: "#6b7280",
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(temperature.lists[tempModalType] || []).map((tc) => {
                const matched = clients.find(
                  (c) => c.email.toLowerCase() === tc.email.toLowerCase(),
                );
                const display =
                  tempModalType === "masAbandonos"
                    ? `${tc.consecutiveAbandons} abandonos`
                    : tempModalType === "frio"
                      ? tc.lastActivity
                        ? `${Math.floor(
                            (Date.now() - new Date(tc.lastActivity).getTime()) /
                              86400000,
                          )} d sin actividad`
                        : "Sin cotizaciones"
                      : `${tc.completed30d} en 30d`;
                const valColor =
                  tempModalType === "caliente"
                    ? "#10b981"
                    : tempModalType === "tibio"
                      ? "#f59e0b"
                      : tempModalType === "frio"
                        ? "#60a5fa"
                        : "#ef4444";
                return (
                  <div
                    key={`${tc.email}-${tc.username}`}
                    onClick={() => {
                      setTempModalType(null);
                      if (matched) openClientDetail(matched);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      cursor: matched ? "pointer" : "default",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f9fafb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "#232f3e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {tc.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1f2937",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tc.username}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tc.email}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: valColor,
                        flexShrink: 0,
                      }}
                    >
                      {display}
                    </span>
                  </div>
                );
              })}
              {temperature.lists[tempModalType].length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: 12,
                    padding: 20,
                  }}
                >
                  Sin clientes en esta categoría
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small summary card sub-component ──
function SummaryCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number | string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`cb-metrics-strip__item${onClick ? " cb-metrics-strip__item--clickable" : ""}`}
    >
      <div className="cb-metrics-strip__label">{label}</div>
      <div className="cb-metrics-strip__value">{value}</div>
      {onClick && (
        <div style={{ fontSize: 10, color: "#d1d5db", marginTop: 4 }}>
          Ver clientes →
        </div>
      )}
    </div>
  );
}
