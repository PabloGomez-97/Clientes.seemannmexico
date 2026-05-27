// src/components/administrador/clientes-ejecutivos.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";

type Cliente = {
  id: string;
  email: string;
  username: string;
  nombreuser?: string;
  createdAt: string;
};

function Clientesejecutivos() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/ejecutivo/clientes", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data?.error || "Error al cargar clientes");
      }

      setClientes(Array.isArray(data?.clientes) ? data.clientes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const rows = useMemo(() => {
    return clientes.map((c) => ({
      ...c,
      createdAtFmt: new Date(c.createdAt).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  }, [clientes]);

  return (
    <div className="container-fluid">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 18,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#1f2937",
              marginBottom: 6,
            }}
          >
            Mis clientes
          </h2>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Clientes asociados a su ejecutivo
          </p>
        </div>

        <button
          onClick={fetchClientes}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#93c5fd" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 12,
            color: "#991b1b",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h5
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Clientes asociados
            </h5>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              {rows.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            No hay clientes asociados a este ejecutivo.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#fff" }}>
                  <th
                    style={{
                      padding: "12px 18px",
                      textAlign: "left",
                      fontSize: 12,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Cliente
                  </th>
                  <th
                    style={{
                      padding: "12px 18px",
                      textAlign: "left",
                      fontSize: 12,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      padding: "12px 18px",
                      textAlign: "left",
                      fontSize: 12,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Creado
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td
                      style={{
                        padding: "14px 18px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 600,
                      }}
                    >
                      {c.username}
                      {c.username ? (
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "#6b7280",
                            marginTop: 2,
                          }}
                        >
                          {c.nombreuser}
                        </div>
                      ) : null}
                    </td>
                    <td
                      style={{
                        padding: "14px 18px",
                        fontSize: 14,
                        color: "#374151",
                      }}
                    >
                      {c.email}
                    </td>
                    <td
                      style={{
                        padding: "14px 18px",
                        fontSize: 14,
                        color: "#6b7280",
                      }}
                    >
                      {(c as any).createdAtFmt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Clientesejecutivos;
