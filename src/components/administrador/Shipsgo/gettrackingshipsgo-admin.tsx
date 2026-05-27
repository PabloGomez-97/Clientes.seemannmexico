// Ejecutivo Tracking (own clients only) — Reuses ShipsGoTracking + CreateShipmentForm / CreateOceanShipmentForm
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import ShipsGoTracking from "../../Sidebar/Shipsgotracking";
import CreateShipmentForm from "../../Sidebar/New-tracking";
import CreateOceanShipmentForm from "../../Sidebar/New-ocean-tracking";
import type {
  AirShipment,
  OceanShipment,
  AirResponse,
  OceanResponse,
} from "../../Sidebar/shipsgo/types";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

interface Cliente {
  id: string;
  email: string;
  username: string;
  nombreuser?: string;
  createdAt: string;
  usernames?: string[];
  parentUsername?: string;
}

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

type CreateFormType = "air" | "ocean" | null;

interface CreateFormState {
  type: Exclude<CreateFormType, null>;
  referenceUsername: string;
}

function ShipsGoTrackingAdmin() {
  const { token } = useAuth();
  const { clientUsername } = useParams<{ clientUsername?: string }>();
  const navigate = useNavigate();

  // Client list
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Shipment counts per reference (for summary badges)
  const [airShipments, setAirShipments] = useState<AirShipment[]>([]);
  const [oceanShipments, setOceanShipments] = useState<OceanShipment[]>([]);
  const [shipmentsLoaded, setShipmentsLoaded] = useState(false);

  // Selected client
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);

  // Create tracking modal
  const [showCreateForm, setShowCreateForm] = useState<CreateFormState | null>(
    null,
  );

  // Key to force remount ShipsGoTracking after creating a new tracking
  const [trackingKey, setTrackingKey] = useState(0);
  const [sortMode, setSortMode] = useState<"az" | "recent" | "subcuentas">(
    "az",
  );

  // ── Fetch ejecutivo's own clients via /api/ejecutivo/clientes ──
  useEffect(() => {
    const fetchClientes = async () => {
      if (!token) return;
      setClientsLoading(true);
      try {
        const resp = await fetch("/api/ejecutivo/clientes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error("Error al cargar clientes");
        const data = await resp.json();
        const raw: Cliente[] = Array.isArray(data.clientes)
          ? data.clientes
          : [];
        const users = expandClients(raw).sort((a, b) =>
          a.username.localeCompare(b.username, "es", { sensitivity: "base" }),
        );
        setClientes(users);
      } catch (e) {
        setClientsError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClientes();
  }, [token]);

  // ── Fetch all shipments for counts ──
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [airRes, oceanRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/shipsgo/shipments`),
          fetch(`${API_BASE_URL}/api/shipsgo/ocean/shipments`),
        ]);
        if (airRes.ok) {
          const airData: AirResponse = await airRes.json();
          setAirShipments(airData.shipments);
        }
        if (oceanRes.ok) {
          const oceanData: OceanResponse = await oceanRes.json();
          setOceanShipments(oceanData.shipments);
        }
      } catch {
        // Non-critical: counts just won't show
      } finally {
        setShipmentsLoaded(true);
      }
    };
    fetchAll();
  }, []);

  // ── Count shipments per client (using username only — no usernames array from this endpoint) ──
  const clientShipmentCounts = useMemo(() => {
    const map = new Map<string, { air: number; ocean: number }>();
    for (const client of clientes) {
      const air = airShipments.filter(
        (s) => s.reference === client.username,
      ).length;
      const ocean = oceanShipments.filter(
        (s) => s.reference === client.username,
      ).length;
      map.set(client.username, { air, ocean });
    }
    return map;
  }, [clientes, airShipments, oceanShipments]);

  // Total shipments (only for this ejecutivo's clients)
  const totalAir = useMemo(() => {
    const names = new Set(clientes.map((c) => c.username));
    return airShipments.filter(
      (s) => s.reference != null && names.has(s.reference),
    ).length;
  }, [clientes, airShipments]);

  const totalOcean = useMemo(() => {
    const names = new Set(clientes.map((c) => c.username));
    return oceanShipments.filter(
      (s) => s.reference != null && names.has(s.reference),
    ).length;
  }, [clientes, oceanShipments]);

  // ── Filtered clients ──
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

  const handleSelectClient = useCallback(
    (client: Cliente) => {
      setShowCreateForm(null);
      setTrackingKey((k) => k + 1);
      navigate(`/admin/trackeos/${encodeURIComponent(client.username)}`, {
        replace: true,
      });
    },
    [navigate],
  );

  const handleBack = useCallback(() => {
    setShowCreateForm(null);
    navigate("/admin/trackeos", { replace: true });
  }, [navigate]);

  // URL is the single source of truth for which client is open.
  // Intentionally excludes selectedClient to avoid the re-select race condition.
  useEffect(() => {
    if (!clientUsername) {
      setSelectedClient(null);
      return;
    }
    if (clientsLoading || clientes.length === 0) return;
    const match = clientes.find(
      (c) =>
        c.username.toLowerCase() ===
        decodeURIComponent(clientUsername).toLowerCase(),
    );
    if (!match) return;
    setSelectedClient((prev) =>
      prev?.username.toLowerCase() === match.username.toLowerCase()
        ? prev
        : match,
    );
  }, [clientUsername, clientes, clientsLoading]);

  const handleNewTracking = useCallback(
    (type: "air" | "ocean", referenceUsername: string) => {
      setShowCreateForm({ type, referenceUsername });
    },
    [],
  );

  const handleCreateSuccess = useCallback(() => {
    setShowCreateForm(null);
    setTrackingKey((k) => k + 1);
  }, []);

  const handleCreateCancel = useCallback(() => {
    setShowCreateForm(null);
  }, []);

  // ── Loading ──
  if (clientsLoading) {
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
              animation: "sgadm-spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <div style={{ color: "#8d99a8", fontSize: 13 }}>
            Cargando clientes...
          </div>
          <style>{`@keyframes sgadm-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (clientsError) {
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
          <div style={{ fontSize: 13, color: "#6b7280" }}>{clientsError}</div>
        </div>
      </div>
    );
  }

  // ── Client Detail View (reuses ShipsGoTracking) ──
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
          Volver a la lista
        </button>

        {/* Client Header */}
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
            {(selectedClient.username || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                {selectedClient.username}
              </h1>
              {selectedClient.parentUsername && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "#fef3c7",
                    color: "#92400e",
                    whiteSpace: "nowrap",
                  }}
                >
                  Cuenta: {selectedClient.parentUsername}
                </span>
              )}
            </div>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "2px 0 0" }}>
              {selectedClient.email}
            </p>
          </div>
        </div>

        {/* Create form modal overlay */}
        {showCreateForm && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreateForm(null);
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                maxWidth: 640,
                width: "100%",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 24px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#1f2937",
                    }}
                  >
                    Crear tracking{" "}
                    {showCreateForm.type === "air" ? "aéreo" : "marítimo"}
                  </h3>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 13,
                      color: "#6b7280",
                    }}
                  >
                    Para: <strong>{showCreateForm.referenceUsername}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateForm(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 20,
                    color: "#9ca3af",
                    padding: 4,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: "0 8px" }}>
                {showCreateForm.type === "air" ? (
                  <CreateShipmentForm
                    referenceUsername={showCreateForm.referenceUsername}
                    onSuccess={handleCreateSuccess}
                    onCancel={handleCreateCancel}
                  />
                ) : (
                  <CreateOceanShipmentForm
                    referenceUsername={showCreateForm.referenceUsername}
                    onSuccess={handleCreateSuccess}
                    onCancel={handleCreateCancel}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reuse ShipsGoTracking for the client */}
        <div key={`${selectedClient.username}-${trackingKey}`}>
          <ShipsGoTracking
            filterUsername={selectedClient.username}
            onNewTracking={(type) =>
              handleNewTracking(type, selectedClient.username)
            }
          />
        </div>
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
          flexWrap: "wrap",
          gap: 8,
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
            Rastreo de Envíos
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
            Selecciona un cliente para ver y gestionar sus envíos.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {/* Pill: clientes */}
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
              {clientes.length}
            </strong>{" "}
            clientes
          </div>
          {/* Pills: shipment counts */}
          {shipmentsLoaded && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 20,
                  fontSize: 12,
                  color: "#2563eb",
                }}
              >
                <span>✈️</span>
                <strong style={{ fontWeight: 600 }}>{totalAir}</strong> aéreos
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 20,
                  fontSize: 12,
                  color: "#16a34a",
                }}
              >
                <span>🚢</span>
                <strong style={{ fontWeight: 600 }}>{totalOcean}</strong>{" "}
                marítimos
              </div>
            </>
          )}
          {/* Botón actualizar */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Recargar"
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
          </button>
        </div>
      </div>

      {/* Search */}
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

      {/* Client List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sortedClients.map((client) => {
          const counts = clientShipmentCounts.get(client.username);
          const airCount = counts?.air ?? 0;
          const oceanCount = counts?.ocean ?? 0;
          const totalCount = airCount + oceanCount;

          return (
            <div
              key={`${client.id}-${client.username}`}
              onClick={() => handleSelectClient(client)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#ff9900";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "#232f3e",
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

              {/* Client info */}
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

              {/* Shipment counts */}
              {shipmentsLoaded && totalCount > 0 && (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {airCount > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "#eff6ff",
                        color: "#2563eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ✈️ {airCount}
                    </span>
                  )}
                  {oceanCount > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "#f0fdf4",
                        color: "#16a34a",
                        whiteSpace: "nowrap",
                      }}
                    >
                      🚢 {oceanCount}
                    </span>
                  )}
                </div>
              )}

              {/* Arrow */}
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
              : "No hay clientes asignados."}
        </div>
      )}
    </div>
  );
}

export default ShipsGoTrackingAdmin;
