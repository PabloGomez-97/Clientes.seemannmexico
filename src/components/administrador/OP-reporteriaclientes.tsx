// src/components/administrador/OP-reporteriaclientes.tsx — Client portal view for Operaciones (ALL clients)
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ClientOverrideProvider } from "../../contexts/ClientOverrideContext";
import AirShipmentsView from "../shipments/AirShipmentsView";
import OceanShipmentsView from "../shipments/OceanShipmentsView";
import GroundShipmentsView from "../shipments/GroundShipmentsView";
import EXWChargesView from "./Cobros-EXW/EXWChargesView";
import QuotesView from "../Sidebar/QuotesView";
import ClientTrackingView from "./ClientTrackingView";
import { ReporteriaClientesProvider } from "../../contexts/ReporteriaClientesContext";
import SettingsClient from "../settings/SettingsClient";

interface OutletContext {
  accessToken: string;
  onLogout: () => void;
}

interface Cliente {
  id: string;
  email: string;
  username: string;
  nombreuser?: string;
  createdAt: string;
  usernames?: string[];
  parentUsername?: string;
}

/** Expand users with multiple company names into separate list entries */
function expandClients(rawClients: Cliente[]): Cliente[] {
  const expanded: Cliente[] = [];
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

// ── Cache helpers (1 hour TTL) ──
const CACHE_TTL = 60 * 60 * 1000;
const CLIENTS_CACHE_KEY = "op_rc_clients_list_v2";

function getCachedClients(): Cliente[] | null {
  try {
    const raw = localStorage.getItem(CLIENTS_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(CLIENTS_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedClients(data: Cliente[]) {
  try {
    localStorage.setItem(
      CLIENTS_CACHE_KEY,
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function OPReporteriaClientes() {
  useOutletContext<OutletContext>();
  const { token } = useAuth();
  const { t } = useTranslation();
  const { clientUsername } = useParams<{ clientUsername?: string }>();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [showAllExw, setShowAllExw] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "air" | "ocean" | "ground" | "quotes" | "exw" | "tracking" | "settings"
  >("air");
  const [quoteFilterNumber, setQuoteFilterNumber] = useState<
    string | undefined
  >();
  const [trackingInitialTab, setTrackingInitialTab] = useState<"air" | "ocean">(
    "air",
  );
  const [opsOpen, setOpsOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"az" | "recent" | "subcuentas">(
    "az",
  );

  // ── Fetch ALL clients list (via /api/admin/users, with cache) ──
  useEffect(() => {
    const fetchClientes = async () => {
      if (!token) return;

      const cached = getCachedClients();
      if (cached) {
        setClientes(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const resp = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (!resp.ok)
          throw new Error(data?.error || "Error al cargar clientes");
        // Filter out Ejecutivo users (only show actual clients)
        const raw: Cliente[] = (
          Array.isArray(data?.users) ? data.users : []
        ).filter((u: Cliente) => u.username !== "Ejecutivo");
        const lista = expandClients(raw).sort((a, b) =>
          a.username.localeCompare(b.username, "es", { sensitivity: "base" }),
        );
        setClientes(lista);
        setCachedClients(lista);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [token]);

  const handleSelectClient = useCallback(
    (cliente: Cliente) => {
      setShowAllExw(false);
      setSelectedClient(cliente);
      setActiveTab("air");
      setOpsOpen(false);
      navigate(
        `/admin/op-reporteriaclientes/${encodeURIComponent(cliente.username)}`,
        { replace: true },
      );
    },
    [navigate],
  );

  const handleSelectAllExw = useCallback(() => {
    setSelectedClient(null);
    setShowAllExw(true);
  }, []);

  const handleBack = () => {
    setShowAllExw(false);
    setOpsOpen(false);
    navigate("/admin/op-reporteriaclientes", { replace: true });
  };

  // URL is the single source of truth for which client is open.
  // Intentionally excludes selectedClient to avoid the re-select race condition.
  useEffect(() => {
    if (!clientUsername) {
      setSelectedClient(null);
      return;
    }
    if (loading || clientes.length === 0) return;
    const match = clientes.find(
      (c) => c.username.toLowerCase() === clientUsername.toLowerCase(),
    );
    if (!match) return;
    setSelectedClient((prev) =>
      prev?.username.toLowerCase() === match.username.toLowerCase()
        ? prev
        : match,
    );
    setActiveTab("air");
  }, [clientUsername, clientes, loading]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clientes;
    const q = searchQuery.toLowerCase();
    return clientes.filter(
      (c) =>
        c.username.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.nombreuser && c.nombreuser.toLowerCase().includes(q)) ||
        (c.parentUsername && c.parentUsername.toLowerCase().includes(q)),
    );
  }, [clientes, searchQuery]);

  const sortedClients = useMemo(() => {
    let list = [...filteredClients];
    if (sortMode === "az") {
      list.sort((a, b) =>
        a.username.localeCompare(b.username, "es", { sensitivity: "base" }),
      );
    } else if (sortMode === "recent") {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sortMode === "subcuentas") {
      list = list.filter((c) => !!c.parentUsername);
    }
    return list;
  }, [filteredClients, sortMode]);

  const uniqueAccountCount = useMemo(
    () => new Set(clientes.map((c) => c.id)).size,
    [clientes],
  );

  // ── Loading state ──
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
              borderTop: "3px solid #ff9900",
              borderRadius: "50%",
              animation: "oprc-spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <div style={{ color: "#8d99a8", fontSize: 13 }}>
            Cargando clientes...
          </div>
          <style>{`@keyframes oprc-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Error state ──
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

  if (showAllExw) {
    return (
      <div style={{ fontFamily: FONT }}>
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
          Volver a la lista
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 20,
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
            EXW
          </div>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1f2937",
                margin: 0,
              }}
            >
              All EXW Charges
            </h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "2px 0 0" }}>
              Consolidado de cobros EXW para los {clientes.length} clientes del
              portal.
            </p>
          </div>
        </div>

        <EXWChargesView
          clientUsernames={clientes.map((client) => client.username)}
        />
      </div>
    );
  }

  // ── Client Detail View ──
  if (selectedClient) {
    const openTrackingTab = (tab?: "air" | "ocean") => {
      setTrackingInitialTab(tab ?? "air");
      setActiveTab("tracking");
    };
    const openQuotesTab = (quoteNumber?: string) => {
      setQuoteFilterNumber(quoteNumber);
      setActiveTab("quotes");
    };

    return (
      <div style={{ fontFamily: FONT }}>
        {/* ── Client context header con breadcrumb y tabs ── */}
        <div
          style={{
            marginBottom: 24,
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            marginLeft: -24,
            marginRight: -24,
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          {/* Fila superior: breadcrumb + botón volver */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 16,
              paddingBottom: 10,
            }}
          >
            {/* Breadcrumb */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              <svg
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Directorio de clientes</span>
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span style={{ color: "#1f2937", fontWeight: 500 }}>
                {selectedClient.username}
              </span>
            </div>
            {/* Botón volver */}
            <button
              onClick={handleBack}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                color: "#6b7280",
                transition: "all 0.15s",
                fontFamily: FONT,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f9fafb";
                e.currentTarget.style.borderColor = "#d1d5db";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.borderColor = "#e5e7eb";
              }}
            >
              <svg
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Volver a la lista
            </button>
          </div>

          {/* Nombre del cliente e info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "#232f3e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {(selectedClient.username || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h1
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#1f2937",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {selectedClient.username}
              </h1>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                {selectedClient.parentUsername && (
                  <span
                    style={{
                      background: "#fef3c7",
                      color: "#92400e",
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "1px 6px",
                      borderRadius: 3,
                      marginRight: 6,
                    }}
                  >
                    Cuenta: {selectedClient.parentUsername}
                  </span>
                )}
                {selectedClient.email} · Registrado el{" "}
                {new Date(selectedClient.createdAt).toLocaleDateString(
                  "es-CL",
                  { day: "2-digit", month: "short", year: "numeric" },
                )}
              </p>
            </div>
          </div>

          {/* Tabs con borde superior activo */}
          <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
            {/* Cotizaciones */}
            <button
              onClick={() => {
                setActiveTab("quotes");
                setOpsOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                background: activeTab === "quotes" ? "#fff" : "none",
                border: "none",
                borderTop:
                  activeTab === "quotes"
                    ? "2px solid #ff6200"
                    : "2px solid transparent",
                borderRadius: "4px 4px 0 0",
                marginBottom: -1,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: activeTab === "quotes" ? 600 : 400,
                color: activeTab === "quotes" ? "#ff6200" : "#6b7280",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                fontFamily: FONT,
              }}
            >
              Cotizaciones
            </button>

            {/* Operaciones accordion trigger */}
            <button
              onClick={() => setOpsOpen((o) => !o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                background:
                  activeTab === "air" ||
                  activeTab === "ocean" ||
                  activeTab === "ground"
                    ? "#fff"
                    : "none",
                border: "none",
                borderTop:
                  activeTab === "air" ||
                  activeTab === "ocean" ||
                  activeTab === "ground"
                    ? "2px solid #ff6200"
                    : "2px solid transparent",
                borderRadius: "4px 4px 0 0",
                marginBottom: -1,
                cursor: "pointer",
                fontSize: 12,
                fontWeight:
                  activeTab === "air" ||
                  activeTab === "ocean" ||
                  activeTab === "ground"
                    ? 600
                    : 400,
                color:
                  activeTab === "air" ||
                  activeTab === "ocean" ||
                  activeTab === "ground"
                    ? "#ff6200"
                    : "#6b7280",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                fontFamily: FONT,
              }}
            >
              Operaciones
              <svg
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                style={{
                  transform: opsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Seguimientos */}
            <button
              onClick={() => {
                setActiveTab("tracking");
                setOpsOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                background: activeTab === "tracking" ? "#fff" : "none",
                border: "none",
                borderTop:
                  activeTab === "tracking"
                    ? "2px solid #ff6200"
                    : "2px solid transparent",
                borderRadius: "4px 4px 0 0",
                marginBottom: -1,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: activeTab === "tracking" ? 600 : 400,
                color: activeTab === "tracking" ? "#ff6200" : "#6b7280",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                fontFamily: FONT,
              }}
            >
              Seguimientos
            </button>

            {/* Configuraciones */}
            <button
              onClick={() => {
                setActiveTab("settings");
                setOpsOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                background: activeTab === "settings" ? "#fff" : "none",
                border: "none",
                borderTop:
                  activeTab === "settings"
                    ? "2px solid #ff6200"
                    : "2px solid transparent",
                borderRadius: "4px 4px 0 0",
                marginBottom: -1,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: activeTab === "settings" ? 600 : 400,
                color: activeTab === "settings" ? "#ff6200" : "#6b7280",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                fontFamily: FONT,
              }}
            >
              Configuraciones
            </button>
          </div>
          {/* Operaciones accordion panel */}
          <div
            style={{
              maxHeight: opsOpen ? "120px" : "0",
              overflow: "hidden",
              transition: "max-height 0.22s ease",
            }}
          >
            <ul
              style={{
                listStyle: "none",
                margin: "4px 0 6px 28px",
                padding: "0",
                borderLeft: "2px solid rgba(141, 153, 168, 0.2)",
              }}
            >
              {(
                [
                  { key: "air" as const, label: "Aéreo" },
                  { key: "ocean" as const, label: "Marítimo" },
                  { key: "ground" as const, label: "Terrestre" },
                ] as const
              ).map((op) => (
                <li key={op.key}>
                  <button
                    onClick={() => {
                      setActiveTab(op.key);
                      setOpsOpen(false);
                    }}
                    style={{
                      display: "block",
                      padding: "8px 16px",
                      background: "none",
                      border: "none",
                      borderLeft:
                        activeTab === op.key
                          ? "2px solid #ff6200"
                          : "2px solid transparent",
                      marginLeft: "-2px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: activeTab === op.key ? 600 : 400,
                      color: activeTab === op.key ? "#1f2937" : "#6b7280",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                      fontFamily: FONT,
                    }}
                  >
                    {op.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ReporteriaClientesProvider
          value={{ openTrackingTab, openQuotesTab, quoteFilterNumber }}
        >
          <ClientOverrideProvider value={selectedClient.username}>
            {activeTab === "air" && <AirShipmentsView />}
            {activeTab === "ocean" && <OceanShipmentsView />}
            {activeTab === "ground" && <GroundShipmentsView />}
            {activeTab === "quotes" && (
              <QuotesView initialQuoteFilter={quoteFilterNumber} />
            )}
            {activeTab === "tracking" && (
              <ClientTrackingView
                clientUsername={selectedClient.username}
                initialTrackingTab={trackingInitialTab}
              />
            )}
            {activeTab === "settings" && (
              <SettingsClient
                reference={selectedClient.username}
                username={selectedClient.nombreuser || selectedClient.username}
                email={selectedClient.email}
                allowPasswordChange={false}
              />
            )}
          </ClientOverrideProvider>
        </ReporteriaClientesProvider>
      </div>
    );
  }

  // ── Client List View ──
  return (
    <div style={{ fontFamily: FONT, maxWidth: 1200 }}>
      {/* ── Header compacto con stats y acciones ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
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
            Todos los Clientes
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
            Selecciona un cliente para ver su portal personalizado con sus
            cotizaciones, envíos y más.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Pill: cuentas */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 20,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <svg
              width="13"
              height="13"
              fill="none"
              stroke="#ff6200"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <strong style={{ color: "#1f2937", fontWeight: 500 }}>
              {uniqueAccountCount}
            </strong>{" "}
            cuentas
            {clientes.length > uniqueAccountCount && (
              <>
                {" "}
                ·{" "}
                <strong style={{ color: "#1f2937", fontWeight: 500 }}>
                  {clientes.length}
                </strong>{" "}
                empresas
              </>
            )}
          </div>
          {/* Botón actualizar */}
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(CLIENTS_CACHE_KEY);
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
            title="Limpiar caché y recargar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: 12,
              color: "#6b7280",
              fontFamily: FONT,
            }}
          >
            <svg
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Actualizar
            <span style={{ fontSize: 10, color: "#d1d5db" }}>
              {getCachedClients() ? "· caché activo" : ""}
            </span>
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            transition: "border-color 0.15s",
          }}
        >
          <svg width="16" height="16" fill="#9ca3af" viewBox="0 0 16 16">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar cliente por nombre, empresa o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "#1f2937",
              background: "transparent",
              fontFamily: FONT,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9ca3af",
                padding: 2,
                fontSize: 16,
              }}
            >
              ×
            </button>
          )}
        </div>
        {searchQuery && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
            {filteredClients.length} resultado
            {filteredClients.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── Chips de ordenamiento ── */}
      <div
        style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}
      >
        {(
          [
            { key: "az" as const, label: "A → Z" },
            { key: "recent" as const, label: "Más recientes" },
            { key: "subcuentas" as const, label: "Solo subcuentas" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortMode(opt.key)}
            style={{
              padding: "4px 12px",
              background: sortMode === opt.key ? "#fff7ed" : "#fff",
              border:
                sortMode === opt.key
                  ? "1px solid #ff6200"
                  : "1px solid #e5e7eb",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: sortMode === opt.key ? 500 : 400,
              color: sortMode === opt.key ? "#9a3412" : "#6b7280",
              transition: "all 0.15s",
              fontFamily: FONT,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sortedClients.map((client) => {
          return (
            <div
              key={`${client.id}-${client.username}`}
              onClick={() => handleSelectClient(client)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                background: client.parentUsername ? "#fffbf5" : "#fff",
                border: client.parentUsername
                  ? "1px solid #fde68a"
                  : "1px solid #e5e7eb",
                borderRadius: 10,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#ff9900";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = client.parentUsername
                  ? "#fde68a"
                  : "#e5e7eb";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: client.parentUsername ? "#f59e0b" : "#232f3e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {(client.username || "?").charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1f2937",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {client.username}
                  </div>
                  {client.parentUsername && (
                    <span
                      style={{
                        background: "#fef3c7",
                        color: "#92400e",
                        fontSize: 10,
                        fontWeight: 500,
                        padding: "1px 6px",
                        borderRadius: 3,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      subcuenta de {client.parentUsername}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {client.email}
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>
                {new Date(client.createdAt).toLocaleDateString("es-CL", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>

              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          );
        })}

        {clientes.length > 0 && (
          <button
            type="button"
            onClick={handleSelectAllExw}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              padding: "16px 18px",
              background: "#fff7ed",
              border: "1px dashed #fb923c",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.15s",
              textAlign: "left",
              fontFamily: FONT,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#ffedd5";
              e.currentTarget.style.borderColor = "#f97316";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff7ed";
              e.currentTarget.style.borderColor = "#fb923c";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "#ff6200",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                EXW
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#9a3412",
                  }}
                >
                  All EXW Charges
                </div>
                <div style={{ fontSize: 12, color: "#c2410c" }}>
                  Ver cobros EXW consolidados de todos los clientes del portal.
                </div>
              </div>
            </div>

            <svg
              width="16"
              height="16"
              fill="none"
              stroke="#c2410c"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {sortedClients.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#9ca3af",
            fontSize: 14,
          }}
        >
          {sortMode === "subcuentas"
            ? "Ningún cliente tiene subcuentas asignadas."
            : searchQuery
              ? `No se encontraron clientes para "${searchQuery}"`
              : "No hay clientes registrados en el portal."}
        </div>
      )}
    </div>
  );
}

export default OPReporteriaClientes;
