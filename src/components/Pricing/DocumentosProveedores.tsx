import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import LoadingTips from "../../components/shipments/LoadingTips";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

type Categoria = "AEREO" | "FCL" | "LCL";
type CategoriaFilter = Categoria | "TODOS";

interface ArchivoItem {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoBytes: number;
  categoria: Categoria;
  proveedorNombre: string;
  createdAt: string;
}

const CATEGORY_TABS: { key: CategoriaFilter; label: string; color: string }[] =
  [
    { key: "TODOS", label: "Todos", color: "#6b7280" },
    { key: "AEREO", label: "Aéreo", color: "var(--primary-color, #ff6200)" },
    { key: "FCL", label: "FCL", color: "#2563eb" },
    { key: "LCL", label: "LCL", color: "#059669" },
  ];

const CATEGORY_BADGE: Record<
  Categoria,
  { label: string; bg: string; color: string }
> = {
  AEREO: { label: "Aéreo", bg: "#fff7ed", color: "#c2410c" },
  FCL: { label: "FCL", bg: "#eff6ff", color: "#1d4ed8" },
  LCL: { label: "LCL", bg: "#f0fdf4", color: "#15803d" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function DocumentosProveedores() {
  const { token } = useAuth();
  const [archivos, setArchivos] = useState<ArchivoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoriaFilter, setCategoriaFilter] =
    useState<CategoriaFilter>("TODOS");
  const [proveedorFilter, setProveedorFilter] = useState<string>("TODOS");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/proveedor-archivos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setArchivos(data.archivos);
        } else {
          setError(data.error || "Error al cargar documentos");
        }
      } catch {
        setError("Error de conexión al cargar documentos");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [token]);

  // Derive sorted provider list from the fetched files
  const proveedores = [...new Set(archivos.map((a) => a.proveedorNombre))].sort(
    (a, b) => a.localeCompare(b),
  );

  // Apply filters
  const archivosVisible = archivos.filter((a) => {
    if (proveedorFilter !== "TODOS" && a.proveedorNombre !== proveedorFilter)
      return false;
    if (categoriaFilter !== "TODOS" && a.categoria !== categoriaFilter)
      return false;
    return true;
  });

  // File count per provider (for badges in the selector)
  const countByProveedor = archivos.reduce<Record<string, number>>((acc, a) => {
    acc[a.proveedorNombre] = (acc[a.proveedorNombre] || 0) + 1;
    return acc;
  }, {});

  const downloadFile = async (archivo: ArchivoItem) => {
    setDownloadError(null);
    try {
      const res = await fetch(
        `/api/proveedor-archivos/${archivo.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!data.success) {
        setDownloadError("Error al descargar el archivo");
        return;
      }
      const link = document.createElement("a");
      link.href = data.archivo.contenidoBase64;
      link.download = data.archivo.nombreArchivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setDownloadError("Error de conexión al descargar");
    }
  };

  const activeTab = CATEGORY_TABS.find((t) => t.key === categoriaFilter)!;

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{ fontSize: 22, fontWeight: 700, color: "#1f2937", margin: 0 }}
        >
          Documentos Proveedores
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
          Visualiza todos los archivos subidos por los proveedores
        </p>
      </div>

      {/* Stats row */}
      {!loading && archivos.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: "10px 20px",
              backgroundColor: "#f9fafb",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              color: "#374151",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 18, color: "#111827" }}>
              {archivos.length}
            </span>{" "}
            documentos en total
          </div>
          <div
            style={{
              padding: "10px 20px",
              backgroundColor: "#f9fafb",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              color: "#374151",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 18, color: "#111827" }}>
              {proveedores.length}
            </span>{" "}
            proveedores
          </div>
        </div>
      )}

      {/* Provider filter */}
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "block",
            marginBottom: 8,
          }}
        >
          Filtrar por proveedor
        </label>
        <select
          value={proveedorFilter}
          onChange={(e) => setProveedorFilter(e.target.value)}
          style={{
            fontFamily: FONT,
            fontSize: 14,
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
            color: "#1f2937",
            cursor: "pointer",
            minWidth: 280,
            outline: "none",
          }}
        >
          <option value="TODOS">
            Todos los proveedores ({archivos.length} archivos)
          </option>
          {proveedores.map((p) => (
            <option key={p} value={p}>
              {p} ({countByProveedor[p] ?? 0} archivos)
            </option>
          ))}
        </select>
      </div>

      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid #e5e7eb",
          marginBottom: 24,
        }}
      >
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setCategoriaFilter(t.key)}
            style={{
              fontFamily: FONT,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: categoriaFilter === t.key ? 600 : 400,
              color: categoriaFilter === t.key ? t.color : "#6b7280",
              background: "none",
              border: "none",
              borderBottom:
                categoriaFilter === t.key
                  ? `2px solid ${t.color}`
                  : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -2,
              transition: "all 0.15s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error message */}
      {(error || downloadError) && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          {error || downloadError}
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingTips />}

      {/* Empty state */}
      {!loading && archivosVisible.length === 0 && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "56px 20px",
            color: "#9ca3af",
          }}
        >
          <p style={{ fontSize: 15, marginBottom: 4 }}>
            {archivos.length === 0
              ? "Ningún proveedor ha subido documentos aún"
              : "No hay documentos para el filtro seleccionado"}
          </p>
        </div>
      )}

      {/* File list */}
      {!loading && archivosVisible.length > 0 && (
        <>
          <p
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginBottom: 12,
              textAlign: "right",
            }}
          >
            {archivosVisible.length} documento
            {archivosVisible.length !== 1 ? "s" : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {archivosVisible.map((a) => {
              const badge = CATEGORY_BADGE[a.categoria];
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    gap: 12,
                    transition: "border-color 0.12s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = activeTab.color)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "#e5e7eb")
                  }
                >
                  {/* File info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#1f2937",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.nombreArchivo}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Provider badge */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#374151",
                          backgroundColor: "#f3f4f6",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        {a.proveedorNombre}
                      </span>
                      {/* Category badge */}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: badge.color,
                          backgroundColor: badge.bg,
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        {badge.label}
                      </span>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>
                        {formatBytes(a.tamanoBytes)} — {formatDate(a.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={() => downloadFile(a)}
                    style={{
                      fontFamily: FONT,
                      padding: "7px 16px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#fff",
                      color: "#374151",
                      fontSize: 12,
                      cursor: "pointer",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Descargar
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
