// src/components/shipments/EXWChargesView.tsx — Cobros EXW por cliente (air-shipments)
import { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { useClientOverride } from "../../../contexts/ClientOverrideContext";

interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
  onLogout: () => void;
}

interface EXWRow {
  id: number | string;
  operationNumber: string;
  clientName: string;
  consignee: string;
  origen: string;
  direccion: string;
  kgCargamento: number;
  exwValue: number;
}

interface EXWChargesViewProps {
  clientUsernames?: string[];
}

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = "exw_charges_client_cache";

function getCacheKey(username: string) {
  return `${CACHE_KEY_PREFIX}_${username}`;
}

function getCachedRows(username: string): EXWRow[] | null {
  try {
    const raw = localStorage.getItem(getCacheKey(username));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { data?: EXWRow[]; ts?: number };
    if (!parsed.ts || Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(username));
      return null;
    }

    return Array.isArray(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

function setCachedRows(username: string, rows: EXWRow[]) {
  try {
    localStorage.setItem(
      getCacheKey(username),
      JSON.stringify({ data: rows, ts: Date.now() }),
    );
  } catch {
    // Ignore quota/storage failures.
  }
}

function clearCachedRows(username: string) {
  try {
    localStorage.removeItem(getCacheKey(username));
  } catch {
    // Ignore storage failures.
  }
}

function cleanAddress(addr: string | null | undefined): string {
  if (!addr) return "—";
  return addr
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatKg(value: number | string | null | undefined) {
  const n = Number(value) || 0;
  // Always show two decimals, decimal separator as comma, no thousand separators
  return n.toFixed(2).replace(".", ",");
}

function formatExw(value: number | string | null | undefined) {
  const n = Number(value) || 0;
  // If integer (no cents), show without decimals; otherwise show two decimals with comma
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(".", ",");
}

function EXWChargesView({ clientUsernames }: EXWChargesViewProps) {
  const { accessToken } = useOutletContext<OutletContext>();
  const clientOverride = useClientOverride();
  const { activeUsername: authUsername } = useAuth();
  const activeUsername = clientOverride || authUsername;
  const usernames = useMemo(() => {
    const source =
      clientUsernames && clientUsernames.length > 0
        ? clientUsernames
        : activeUsername
          ? [activeUsername]
          : [];

    return Array.from(
      new Set(source.map((username) => username.trim()).filter(Boolean)),
    );
  }, [activeUsername, clientUsernames]);
  const isAllClientsView = usernames.length > 1;
  const cacheKey = useMemo(
    () => usernames.slice().sort().join("|"),
    [usernames],
  );

  const [rows, setRows] = useState<EXWRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOrigen, setFilterOrigen] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (!accessToken || usernames.length === 0 || !cacheKey) return;

      if (!forceRefresh) {
        const cachedRows = getCachedRows(cacheKey);
        if (cachedRows) {
          setRows(cachedRows);
          setError(null);
          setLoading(false);
          setProgress({ current: 0, total: 0 });
          return;
        }
      } else {
        clearCachedRows(cacheKey);
      }

      setLoading(true);
      setError(null);
      setRows([]);
      setProgress({ current: 0, total: 0 });

      try {
        // 1. Fetch all air-shipment IDs for the selected client scope
        const allShipments: Array<{ id: string | number; clientName: string }> =
          [];
        const seenIds = new Set<string | number>();
        const itemsPerPage = 50;

        for (const username of usernames) {
          let page = 1;

          while (true) {
            const params = new URLSearchParams({
              ConsigneeName: username,
              Page: page.toString(),
              ItemsPerPage: itemsPerPage.toString(),
              SortBy: "newest",
            });

            const res = await fetch(
              `https://api.linbis.com/air-shipments?${params}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
              },
            );

            if (!res.ok) {
              if (res.status === 401)
                throw new Error("Token inválido o expirado.");
              throw new Error(`Error ${res.status}: ${res.statusText}`);
            }

            const shipments: Record<string, unknown>[] = await res.json();
            if (!shipments.length) break;

            for (const s of shipments) {
              if (s.id && !seenIds.has(s.id as string | number)) {
                allShipments.push({
                  id: s.id as string | number,
                  clientName: username,
                });
                seenIds.add(s.id as string | number);
              }
              if (Array.isArray(s.subShipments)) {
                for (const sub of s.subShipments as Record<string, unknown>[]) {
                  if (sub.id && !seenIds.has(sub.id as string | number)) {
                    allShipments.push({
                      id: sub.id as string | number,
                      clientName: username,
                    });
                    seenIds.add(sub.id as string | number);
                  }
                }
              }
            }

            if (shipments.length < itemsPerPage) break;
            page++;
          }
        }

        setProgress({ current: 0, total: allShipments.length });

        // 2. Fetch details in batches; keep only those with EXW CHARGES
        const results: EXWRow[] = [];
        const batchSize = 5;

        for (let i = 0; i < allShipments.length; i += batchSize) {
          const batch = allShipments.slice(i, i + batchSize);

          const promises = batch.map(async ({ id, clientName }) => {
            try {
              const res = await fetch(
                `https://api.linbis.com/air-shipments/details/${id}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                  },
                },
              );
              if (!res.ok) return null;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const detail: any = await res.json();

              // Only keep shipments that have an EXW CHARGES charge
              const exwCharge = (detail.charges ?? []).find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (c: any) =>
                  typeof c.description === "string" &&
                  c.description.toUpperCase().trim() === "EXW CHARGES",
              );
              if (!exwCharge) return null;

              const consignee =
                detail.consignee?.name ||
                detail.commodities?.[0]?.consignee ||
                "—";
              const operationNumber = detail.number || "—";
              const origen = detail.from?.code || "—";
              const direccion = cleanAddress(detail.shipperAddress);
              const kgCargamento =
                detail.commodities?.[0]?.volWeight ??
                detail.totalCargoDetails?.volumeWeight?.value ??
                0;
              const exwValue = exwCharge.rateMoney?.value ?? 0;

              return {
                id,
                operationNumber,
                clientName,
                consignee,
                origen,
                direccion,
                kgCargamento,
                exwValue,
              } as EXWRow;
            } catch {
              return null;
            }
          });

          const batchResults = await Promise.all(promises);
          for (const r of batchResults) {
            if (r) results.push(r);
          }

          setProgress({
            current: Math.min(i + batchSize, allShipments.length),
            total: allShipments.length,
          });
        }

        setCachedRows(cacheKey, results);
        setRows(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    },
    [accessToken, cacheKey, usernames],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unique origin codes for the filter dropdown
  const uniqueOrigenes = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.origen))).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!filterOrigen) return rows;
    return rows.filter((r) => r.origen === filterOrigen);
  }, [rows, filterOrigen]);

  return (
    <div style={{ fontFamily: FONT }}>
      <style>{`.exw-addr-scroll { -ms-overflow-style: none; scrollbar-width: none; }
.exw-addr-scroll::-webkit-scrollbar { display: none; }`}</style>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            Cobros EXW
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            {isAllClientsView
              ? `Operaciones aéreas con cargos EXW de ${usernames.length} clientes`
              : "Operaciones aéreas con cargos EXW"}
          </p>
        </div>
        <div
          style={{
            marginTop: 8,
            color: "#b91c1c",
            fontSize: 13,
            textAlign: "center",
            width: "100%",
          }}
        >
          Los cobros EXW tienen una estadía de 24hrs, si crees que hay nuevos
          cobros, presiona el botón <strong>Actualizar</strong>
        </div>
        <button
          onClick={() => void fetchData(true)}
          disabled={loading}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            background: loading ? "#94a3b8" : "#ff9900",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: FONT,
          }}
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#dc2626",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading progress */}
      {loading && (
        <div
          style={{
            padding: "20px 0",
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              border: "3px solid #f0f0f0",
              borderTop: "3px solid #ff9900",
              borderRadius: "50%",
              animation: "exw-spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          {progress.total > 0 ? (
            <span>
              Analizando operaciones… {progress.current} / {progress.total}
            </span>
          ) : (
            <span>Cargando envíos aéreos…</span>
          )}
          <style>{`@keyframes exw-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Filter by Origin */}
      {!loading && rows.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
            Filtrar por Origen:
          </label>
          <select
            value={filterOrigen}
            onChange={(e) => setFilterOrigen(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#fff",
              color: "#334155",
              minWidth: 140,
              fontFamily: FONT,
            }}
          >
            <option value="">Todos</option>
            {uniqueOrigenes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {filteredRows.length} resultado
            {filteredRows.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {isAllClientsView && (
                    <th
                      style={{
                        padding: "12px 16px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#64748b",
                        textAlign: "left",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "2px solid #e2e8f0",
                        whiteSpace: "nowrap",
                        width: 160,
                      }}
                    >
                      Cliente
                    </th>
                  )}
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "2px solid #e2e8f0",
                      whiteSpace: "nowrap",
                      width: 120,
                    }}
                  >
                    N° Operación
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "2px solid #e2e8f0",
                      whiteSpace: "nowrap",
                      width: 100,
                    }}
                  >
                    Origen
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "2px solid #e2e8f0",
                      whiteSpace: "nowrap",
                      width: "45%",
                    }}
                  >
                    Dirección
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "2px solid #e2e8f0",
                      whiteSpace: "nowrap",
                      width: 140,
                    }}
                  >
                    KG Cargamento
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "2px solid #e2e8f0",
                      whiteSpace: "nowrap",
                      width: 140,
                    }}
                  >
                    EXW Charges (USD)
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAllClientsView ? 6 : 5}
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: 14,
                      }}
                    >
                      No se encontraron operaciones con EXW Charges.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, i) => (
                    <tr
                      key={row.id}
                      style={{
                        background: i % 2 === 0 ? "#fff" : "#f8fafc",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {isAllClientsView && (
                        <td
                          style={{
                            padding: "10px 16px",
                            fontSize: 13,
                            color: "#334155",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.clientName}
                        </td>
                      )}
                      <td
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#334155",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.operationNumber}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#334155",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            background: "#e0f2fe",
                            color: "#0369a1",
                            borderRadius: 4,
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {row.origen}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#475569",
                        }}
                        title={row.direccion}
                      >
                        <div
                          className="exw-addr-scroll"
                          style={{ overflowX: "auto", whiteSpace: "nowrap" }}
                        >
                          {row.direccion}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#334155",
                          fontWeight: 500,
                        }}
                      >
                        {formatKg(row.kgCargamento)}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#16a34a",
                          fontWeight: 600,
                        }}
                      >
                        {"$ " + formatExw(row.exwValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default EXWChargesView;
