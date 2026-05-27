// src/components/administrador/Documentacion.tsx — Gestión de documentos para ejecutivos
import { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { DocumentosUnificadosView } from "../Sidebar/Documents/DocumentosUnificadosView";

interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
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

const CACHE_TTL = 60 * 60 * 1000;
const CLIENTS_CACHE_KEY = "rc_clients_list";
const DOCUMENT_COUNTS_CACHE_KEY = "doc_client_counts_v1";
const DOCUMENT_COUNTS_TTL = 3 * 60 * 60 * 1000;
const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

type DocumentCounts = Record<string, number>;

function normalizeAccountName(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function buildClientList(rawClients: Cliente[]): Cliente[] {
  const expanded: Cliente[] = [];
  const seenEntries = new Set<string>();

  for (const client of rawClients) {
    const names = Array.from(
      new Map(
        (client.usernames?.length ? client.usernames : [client.username])
          .map((name) => String(name || "").trim())
          .filter(Boolean)
          .map((name) => [normalizeAccountName(name), name] as const),
      ).values(),
    );

    const primaryUsername = names[0] || String(client.username || "").trim();

    for (const name of names) {
      const entryKey = `${client.id}:${normalizeAccountName(name)}`;
      if (seenEntries.has(entryKey)) {
        continue;
      }
      seenEntries.add(entryKey);

      expanded.push({
        ...client,
        username: name,
        usernames: names,
        parentUsername: name !== primaryUsername ? primaryUsername : undefined,
      });
    }
  }

  return expanded;
}

function normalizeClients(rawClients: Cliente[]) {
  return buildClientList(rawClients);
}

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
    /* quota exceeded */
  }
}

function getCachedDocumentCounts(): DocumentCounts | null {
  try {
    const raw = localStorage.getItem(DOCUMENT_COUNTS_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > DOCUMENT_COUNTS_TTL) {
      localStorage.removeItem(DOCUMENT_COUNTS_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedDocumentCounts(data: DocumentCounts) {
  try {
    localStorage.setItem(
      DOCUMENT_COUNTS_CACHE_KEY,
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
    /* quota exceeded */
  }
}

function Documentacion() {
  useOutletContext<OutletContext>();
  const { token } = useAuth();
  const { clientUsername } = useParams<{ clientUsername?: string }>();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [documentCounts, setDocumentCounts] = useState<DocumentCounts>({});
  const [sortMode, setSortMode] = useState<"az" | "recent" | "subcuentas">(
    "az",
  );

  // Fetch clients
  useEffect(() => {
    const fetchClientes = async () => {
      if (!token) return;
      const cached = getCachedClients();
      if (cached) {
        const normalizedCached = normalizeClients(cached).sort((a, b) =>
          a.username.localeCompare(b.username, "es", { sensitivity: "base" }),
        );
        setClientes(normalizedCached);
        setCachedClients(normalizedCached);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const resp = await fetch("/api/ejecutivo/clientes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (!resp.ok)
          throw new Error(data?.error || "Error al cargar clientes");
        const raw: Cliente[] = Array.isArray(data?.clientes)
          ? data.clientes
          : [];
        const lista = buildClientList(raw).sort((a, b) =>
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

  useEffect(() => {
    let cancelled = false;

    const fetchDocumentCounts = async () => {
      if (!token || clientes.length === 0) return;

      const cachedCounts = getCachedDocumentCounts();
      if (cachedCounts) {
        if (!cancelled) {
          setDocumentCounts(cachedCounts);
        }
        return;
      }

      try {
        const entries = await Promise.all(
          clientes.map(async (client) => {
            try {
              const resp = await fetch(
                `/api/documents/all?ownerUsername=${encodeURIComponent(client.username)}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              if (!resp.ok) return [client.username, 0] as const;

              const data = await resp.json();
              const total =
                (Array.isArray(data?.air) ? data.air.length : 0) +
                (Array.isArray(data?.ocean) ? data.ocean.length : 0) +
                (Array.isArray(data?.ground) ? data.ground.length : 0) +
                (Array.isArray(data?.quotes) ? data.quotes.length : 0);
              return [client.username, total] as const;
            } catch {
              return [client.username, 0] as const;
            }
          }),
        );

        if (cancelled) return;

        const nextCounts: DocumentCounts = Object.fromEntries(entries);
        setDocumentCounts(nextCounts);
        setCachedDocumentCounts(nextCounts);
      } catch {
        if (!cancelled) {
          setDocumentCounts({});
        }
      }
    };

    fetchDocumentCounts();

    return () => {
      cancelled = true;
    };
  }, [clientes, token]);

  const handleSelectClient = useCallback(
    (cliente: Cliente) => {
      navigate(`/admin/documentacion/${encodeURIComponent(cliente.username)}`, {
        replace: true,
      });
    },
    [navigate],
  );

  const handleBack = () => navigate("/admin/documentacion", { replace: true });

  // URL is source of truth
  useEffect(() => {
    if (!clientUsername) {
      setSelectedClient(null);
      return;
    }
    if (loading || clientes.length === 0) return;
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

  const multiAccountCount = useMemo(
    () => clientes.filter((c) => c.parentUsername).length,
    [clientes],
  );

  // Loading state
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
              width: 28,
              height: 28,
              border: "3px solid #f0f0f0",
              borderTop: "3px solid #2563eb",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            Cargando clientes...
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Error state
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
              fontSize: 14,
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

  // ── Client Document View ──
  if (selectedClient) {
    const accountCount = selectedClient.usernames?.length || 1;
    return (
      <div style={{ fontFamily: FONT, maxWidth: 1200 }}>
        {/* Back + Client header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 20,
          }}
        >
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
              fontFamily: FONT,
              flexShrink: 0,
              transition: "all 0.15s",
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

          {/* Avatar + info */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1f2937" }}>
                {selectedClient.username}
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
                {selectedClient.parentUsername && (
                  <span
                    style={{
                      background: "#fef3c7",
                      color: "#92400e",
                      fontSize: 12,
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: 4,
                      marginRight: 8,
                    }}
                  >
                    Cuenta: {selectedClient.parentUsername}
                  </span>
                )}
                {selectedClient.email}
                {accountCount > 1 && (
                  <span style={{ marginLeft: 8, color: "#9ca3af" }}>
                    · {accountCount} cuentas
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <DocumentosUnificadosView ownerUsername={selectedClient.username} />
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
            Documentación de clientes
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
            Selecciona un cliente para ver sus documentos cargados y
            cotizaciones.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 14px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <svg width="14" height="14" fill="#9ca3af" viewBox="0 0 16 16">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar cliente..."
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
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {searchQuery && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>
          {filteredClients.length} resultado
          {filteredClients.length !== 1 ? "s" : ""}
        </div>
      )}

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

      {/* Client list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {sortedClients.map((client) => (
          <div
            key={`${client.id}:${normalizeAccountName(client.username)}`}
            onClick={() => handleSelectClient(client)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#2563eb";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
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
            <div style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
              {new Date(client.createdAt).toLocaleDateString("es-CL", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div
              style={{
                minWidth: 56,
                textAlign: "right",
                fontSize: 11,
                fontWeight: 600,
                color: "#374151",
                flexShrink: 0,
              }}
            >
              {documentCounts[client.username] ?? 0} doc
              {(documentCounts[client.username] ?? 0) !== 1 ? "s" : ""}
            </div>
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="#d1d5db"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        ))}
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
              ? `Sin resultados para "${searchQuery}"`
              : "No hay clientes asignados."}
        </div>
      )}
    </div>
  );
}

export default Documentacion;
