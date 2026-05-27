// src/components/administrador/Auditoria.tsx
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../auth/AuthContext";

// ============================================================================
// TIPOS
// ============================================================================

interface AuditEntry {
  _id: string;
  usuario: string;
  email: string;
  rol: "cliente" | "ejecutivo";
  ejecutivo: string | null;
  ejecutivoEmail: string | null;
  accion: string;
  categoria: string;
  descripcion: string;
  detalles: Record<string, unknown>;
  clienteAfectado: string | null;
  ip: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuditStats {
  [key: string]: number;
}

type CategoriaFilter =
  | ""
  | "COTIZACION"
  | "TRACKING"
  | "PRICING"
  | "GESTION_USUARIOS"
  | "GESTION_EJECUTIVOS";

// ============================================================================
// CONSTANTES DE DISEÑO
// ============================================================================

const CATEGORIAS: {
  value: CategoriaFilter;
  label: string;
  icon: string;
  color: string;
}[] = [
  { value: "", label: "Todas", icon: "fa fa-layer-group", color: "#6c757d" },
  {
    value: "COTIZACION",
    label: "Cotizaciones",
    icon: "fa fa-file-invoice",
    color: "#0d6efd",
  },
  {
    value: "TRACKING",
    label: "Tracking",
    icon: "fa fa-route",
    color: "#198754",
  },
  {
    value: "PRICING",
    label: "Pricing",
    icon: "fa fa-dollar-sign",
    color: "#ffc107",
  },
  {
    value: "GESTION_USUARIOS",
    label: "Usuarios",
    icon: "fa fa-users",
    color: "#6f42c1",
  },
  {
    value: "GESTION_EJECUTIVOS",
    label: "Ejecutivos",
    icon: "fa fa-briefcase",
    color: "#dc3545",
  },
];

const ACCION_BADGES: Record<string, { bg: string; text: string }> = {
  // Cotizaciones cliente
  COTIZACION_AIR_CREADA: { bg: "#cfe2ff", text: "#084298" },
  COTIZACION_FCL_CREADA: { bg: "#cfe2ff", text: "#084298" },
  COTIZACION_LCL_CREADA: { bg: "#cfe2ff", text: "#084298" },
  // Cotizaciones ejecutivo
  COTIZACION_AIR_EJECUTIVO: { bg: "#e0cffc", text: "#3d0a91" },
  COTIZACION_FCL_EJECUTIVO: { bg: "#e0cffc", text: "#3d0a91" },
  COTIZACION_LCL_EJECUTIVO: { bg: "#e0cffc", text: "#3d0a91" },
  // Tracking
  TRACKING_CREADO: { bg: "#d1e7dd", text: "#0f5132" },
  TRACKING_ELIMINADO: { bg: "#f8d7da", text: "#842029" },
  TRACKING_FOLLOWER_AGREGADO: { bg: "#cff4fc", text: "#055160" },
  TRACKING_FOLLOWER_ELIMINADO: { bg: "#f8d7da", text: "#842029" },
  // Pricing creados
  PRICING_AIR_CREADO: { bg: "#fff3cd", text: "#664d03" },
  PRICING_FCL_CREADO: { bg: "#fff3cd", text: "#664d03" },
  PRICING_LCL_CREADO: { bg: "#fff3cd", text: "#664d03" },
  // Pricing actualizados
  PRICING_AIR_ACTUALIZADO: { bg: "#cff4fc", text: "#055160" },
  PRICING_FCL_ACTUALIZADO: { bg: "#cff4fc", text: "#055160" },
  PRICING_LCL_ACTUALIZADO: { bg: "#cff4fc", text: "#055160" },
  // Pricing eliminados
  PRICING_AIR_ELIMINADO: { bg: "#f8d7da", text: "#842029" },
  PRICING_FCL_ELIMINADO: { bg: "#f8d7da", text: "#842029" },
  PRICING_LCL_ELIMINADO: { bg: "#f8d7da", text: "#842029" },
  // Usuarios
  USUARIO_CREADO: { bg: "#d1e7dd", text: "#0f5132" },
  USUARIO_ACTUALIZADO: { bg: "#cff4fc", text: "#055160" },
  USUARIO_ELIMINADO: { bg: "#f8d7da", text: "#842029" },
  // Ejecutivos
  EJECUTIVO_CREADO: { bg: "#d1e7dd", text: "#0f5132" },
  EJECUTIVO_ACTUALIZADO: { bg: "#cff4fc", text: "#055160" },
  EJECUTIVO_ELIMINADO: { bg: "#f8d7da", text: "#842029" },
};

const ACCION_LABELS: Record<string, string> = {
  COTIZACION_AIR_CREADA: "Cotización Aérea",
  COTIZACION_FCL_CREADA: "Cotización FCL",
  COTIZACION_LCL_CREADA: "Cotización LCL",
  COTIZACION_AIR_EJECUTIVO: "Cotización Aérea (Ejec)",
  COTIZACION_FCL_EJECUTIVO: "Cotización FCL (Ejec)",
  COTIZACION_LCL_EJECUTIVO: "Cotización LCL (Ejec)",
  TRACKING_CREADO: "Tracking Creado",
  TRACKING_ELIMINADO: "Tracking Eliminado",
  TRACKING_FOLLOWER_AGREGADO: "Follower Agregado",
  TRACKING_FOLLOWER_ELIMINADO: "Follower Eliminado",
  PRICING_AIR_CREADO: "Tarifa Aérea Creada",
  PRICING_FCL_CREADO: "Tarifa FCL Creada",
  PRICING_LCL_CREADO: "Tarifa LCL Creada",
  PRICING_AIR_ACTUALIZADO: "Tarifa Aérea Editada",
  PRICING_FCL_ACTUALIZADO: "Tarifa FCL Editada",
  PRICING_LCL_ACTUALIZADO: "Tarifa LCL Editada",
  PRICING_AIR_ELIMINADO: "Tarifa Aérea Eliminada",
  PRICING_FCL_ELIMINADO: "Tarifa FCL Eliminada",
  PRICING_LCL_ELIMINADO: "Tarifa LCL Eliminada",
  USUARIO_CREADO: "Usuario Creado",
  USUARIO_ACTUALIZADO: "Usuario Actualizado",
  USUARIO_ELIMINADO: "Usuario Eliminado",
  EJECUTIVO_CREADO: "Ejecutivo Creado",
  EJECUTIVO_ACTUALIZADO: "Ejecutivo Actualizado",
  EJECUTIVO_ELIMINADO: "Ejecutivo Eliminado",
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

function Auditoria() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<AuditStats>({});

  // Filtros
  const [categoriaFilter, setCategoriaFilter] = useState<CategoriaFilter>("");
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Debounced search
  const [debouncedBusqueda, setDebouncedBusqueda] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedBusqueda(busqueda), 400);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
        });
        if (categoriaFilter) params.append("categoria", categoriaFilter);
        if (debouncedBusqueda) params.append("busqueda", debouncedBusqueda);
        if (fechaDesde) params.append("desde", fechaDesde);
        if (fechaHasta) params.append("hasta", fechaHasta);

        const res = await fetch(`/api/audit?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Error al obtener auditoría");

        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination);
        setStats(data.stats || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    [
      token,
      categoriaFilter,
      debouncedBusqueda,
      fechaDesde,
      fechaHasta,
      pagination.limit,
    ],
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const d = new Date(dateString);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffH < 24) return `Hace ${diffH}h`;
    if (diffD < 7) return `Hace ${diffD}d`;
    return formatDate(dateString);
  };

  const totalEvents = Object.values(stats).reduce((a, b) => a + b, 0);

  const getAccionBadge = (accion: string) => {
    const style = ACCION_BADGES[accion] || { bg: "#e2e3e5", text: "#41464b" };
    return style;
  };

  const renderDetalles = (detalles: Record<string, unknown>) => {
    const entries = Object.entries(detalles).filter(
      ([, v]) => v !== null && v !== undefined && v !== "",
    );
    if (entries.length === 0) return null;
    return (
      <div style={{ marginTop: "8px" }}>
        <table
          style={{
            width: "100%",
            fontSize: "12px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td
                  style={{
                    padding: "4px 8px",
                    fontWeight: 600,
                    color: "#6c757d",
                    whiteSpace: "nowrap",
                    width: "120px",
                  }}
                >
                  {key}
                </td>
                <td
                  style={{
                    padding: "4px 8px",
                    color: "#212529",
                    wordBreak: "break-word",
                  }}
                >
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1400px",
        margin: "0 auto",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #232f3e, #37475a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i
              className="fa fa-shield-alt"
              style={{ color: "#ff9900", fontSize: "22px" }}
            />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 700,
                color: "#1a1a2e",
              }}
            >
              Centro de Auditoría
            </h1>
            <p style={{ margin: 0, fontSize: "14px", color: "#6c757d" }}>
              Registro completo de actividades del sistema
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #232f3e, #37475a)",
            borderRadius: "12px",
            padding: "20px",
            color: "white",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              opacity: 0.8,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Total Eventos
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, marginTop: "4px" }}>
            {totalEvents.toLocaleString()}
          </div>
        </div>
        {CATEGORIAS.filter((c) => c.value).map((cat) => (
          <div
            key={cat.value}
            onClick={() =>
              setCategoriaFilter(categoriaFilter === cat.value ? "" : cat.value)
            }
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "20px",
              border:
                categoriaFilter === cat.value
                  ? `2px solid ${cat.color}`
                  : "1px solid #e9ecef",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow:
                categoriaFilter === cat.value
                  ? `0 0 0 3px ${cat.color}22`
                  : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <i
                className={cat.icon}
                style={{ color: cat.color, fontSize: "14px" }}
              />
              <span
                style={{ fontSize: "12px", color: "#6c757d", fontWeight: 500 }}
              >
                {cat.label}
              </span>
            </div>
            <div
              style={{ fontSize: "24px", fontWeight: 700, color: "#212529" }}
            >
              {(stats[cat.value] || 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #e9ecef",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "flex-end",
          }}
        >
          {/* Búsqueda */}
          <div style={{ flex: "1 1 280px" }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#6c757d",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Buscar
            </label>
            <div style={{ position: "relative" }}>
              <i
                className="fa fa-search"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#adb5bd",
                  fontSize: "14px",
                }}
              />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Usuario, email, descripción..."
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  border: "1px solid #dee2e6",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
              />
            </div>
          </div>

          {/* Fecha Desde */}
          <div style={{ flex: "0 1 180px" }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#6c757d",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #dee2e6",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {/* Fecha Hasta */}
          <div style={{ flex: "0 1 180px" }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#6c757d",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #dee2e6",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {/* Reset */}
          <button
            onClick={() => {
              setCategoriaFilter("");
              setBusqueda("");
              setFechaDesde("");
              setFechaHasta("");
            }}
            style={{
              padding: "10px 16px",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              background: "#f8f9fa",
              cursor: "pointer",
              fontSize: "14px",
              color: "#495057",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <i className="fa fa-redo" style={{ fontSize: "12px" }} />
            Limpiar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#f8d7da",
            border: "1px solid #f5c2c7",
            borderRadius: "8px",
            padding: "12px 16px",
            color: "#842029",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          <i
            className="fa fa-exclamation-triangle"
            style={{ marginRight: "8px" }}
          />
          {error}
        </div>
      )}

      {/* Activity Log Table */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e9ecef",
          overflow: "hidden",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e9ecef",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{ fontSize: "16px", fontWeight: 600, color: "#212529" }}
            >
              Registro de Actividades
            </span>
            <span
              style={{ marginLeft: "8px", fontSize: "13px", color: "#6c757d" }}
            >
              ({pagination.total.toLocaleString()} resultado
              {pagination.total !== 1 ? "s" : ""})
            </span>
          </div>
          <button
            onClick={() => fetchLogs(pagination.page)}
            disabled={loading}
            style={{
              padding: "6px 14px",
              border: "1px solid #dee2e6",
              borderRadius: "6px",
              background: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              color: "#495057",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <i
              className={`fa fa-sync-alt ${loading ? "fa-spin" : ""}`}
              style={{ fontSize: "12px" }}
            />
            Actualizar
          </button>
        </div>

        {/* Loading */}
        {loading && logs.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <i
              className="fa fa-spinner fa-spin"
              style={{
                fontSize: "32px",
                color: "#6c757d",
                marginBottom: "12px",
              }}
            />
            <p style={{ color: "#6c757d", fontSize: "14px" }}>
              Cargando registros de auditoría...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && logs.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <i
              className="fa fa-clipboard-list"
              style={{
                fontSize: "48px",
                color: "#dee2e6",
                marginBottom: "16px",
              }}
            />
            <p style={{ color: "#6c757d", fontSize: "16px", fontWeight: 500 }}>
              No se encontraron registros
            </p>
            <p style={{ color: "#adb5bd", fontSize: "14px" }}>
              Intenta cambiar los filtros de búsqueda
            </p>
          </div>
        )}

        {/* Rows */}
        {logs.map((log) => {
          const badge = getAccionBadge(log.accion);
          const isExpanded = expandedRow === log._id;
          const catInfo = CATEGORIAS.find((c) => c.value === log.categoria);

          return (
            <div
              key={log._id}
              onClick={() => setExpandedRow(isExpanded ? null : log._id)}
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #f0f0f0",
                cursor: "pointer",
                transition: "background-color 0.1s",
                backgroundColor: isExpanded ? "#f8f9fa" : "#fff",
              }}
              onMouseEnter={(e) => {
                if (!isExpanded)
                  e.currentTarget.style.backgroundColor = "#fafbfc";
              }}
              onMouseLeave={(e) => {
                if (!isExpanded) e.currentTarget.style.backgroundColor = "#fff";
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                {/* Icono categoría */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: `${catInfo?.color || "#6c757d"}15`,
                    flexShrink: 0,
                  }}
                >
                  <i
                    className={catInfo?.icon || "fa fa-circle"}
                    style={{
                      color: catInfo?.color || "#6c757d",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* Contenido principal */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginBottom: "4px",
                    }}
                  >
                    {/* Badge de acción */}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: badge.bg,
                        color: badge.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ACCION_LABELS[log.accion] || log.accion}
                    </span>

                    {/* Descripción */}
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#212529",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.descripcion}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Usuario */}
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#6c757d",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <i
                        className={
                          log.rol === "ejecutivo"
                            ? "fa fa-user-tie"
                            : "fa fa-user"
                        }
                        style={{ fontSize: "10px" }}
                      />
                      {log.usuario}
                      {log.ejecutivo && (
                        <span style={{ color: "#0d6efd", fontWeight: 500 }}>
                          {" "}
                          ({log.ejecutivo})
                        </span>
                      )}
                    </span>

                    {/* Cliente afectado */}
                    {log.clienteAfectado && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#6f42c1",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <i
                          className="fa fa-arrow-right"
                          style={{ fontSize: "9px" }}
                        />
                        Cliente: {log.clienteAfectado}
                      </span>
                    )}

                    {/* Fecha */}
                    <span
                      style={{ fontSize: "12px", color: "#adb5bd" }}
                      title={formatDate(log.createdAt)}
                    >
                      <i
                        className="fa fa-clock"
                        style={{ fontSize: "10px", marginRight: "4px" }}
                      />
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Expand arrow */}
                <i
                  className="fa fa-chevron-down"
                  style={{
                    fontSize: "12px",
                    color: "#adb5bd",
                    transition: "transform 0.2s",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    flexShrink: 0,
                  }}
                />
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px 16px",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #e9ecef",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      fontSize: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <div>
                      <strong>Email:</strong> {log.email}
                    </div>
                    <div>
                      <strong>Rol:</strong>{" "}
                      {log.rol === "ejecutivo" ? "Ejecutivo" : "Cliente"}
                    </div>
                    <div>
                      <strong>Fecha exacta:</strong> {formatDate(log.createdAt)}
                    </div>
                    <div>
                      <strong>IP:</strong> {log.ip || "N/A"}
                    </div>
                    {log.ejecutivo && (
                      <div>
                        <strong>Ejecutivo:</strong> {log.ejecutivo} (
                        {log.ejecutivoEmail})
                      </div>
                    )}
                    {log.clienteAfectado && (
                      <div>
                        <strong>Cliente afectado:</strong> {log.clienteAfectado}
                      </div>
                    )}
                  </div>
                  {Object.keys(log.detalles).length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#495057",
                          marginBottom: "4px",
                          marginTop: "8px",
                        }}
                      >
                        Detalles de la operación:
                      </div>
                      {renderDetalles(log.detalles)}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            marginTop: "20px",
            flexWrap: "wrap",
          }}
        >
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchLogs(pagination.page - 1)}
            style={{
              padding: "8px 14px",
              border: "1px solid #dee2e6",
              borderRadius: "6px",
              background: "#fff",
              cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
              fontSize: "13px",
              opacity: pagination.page <= 1 ? 0.5 : 1,
            }}
          >
            <i className="fa fa-chevron-left" style={{ fontSize: "11px" }} />
          </button>

          {/* Page Numbers */}
          {Array.from(
            { length: Math.min(5, pagination.totalPages) },
            (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => fetchLogs(pageNum)}
                  style={{
                    padding: "8px 14px",
                    border: "1px solid #dee2e6",
                    borderRadius: "6px",
                    background:
                      pageNum === pagination.page ? "#232f3e" : "#fff",
                    color: pageNum === pagination.page ? "#fff" : "#495057",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: pageNum === pagination.page ? 600 : 400,
                    minWidth: "40px",
                  }}
                >
                  {pageNum}
                </button>
              );
            },
          )}

          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchLogs(pagination.page + 1)}
            style={{
              padding: "8px 14px",
              border: "1px solid #dee2e6",
              borderRadius: "6px",
              background: "#fff",
              cursor:
                pagination.page >= pagination.totalPages
                  ? "not-allowed"
                  : "pointer",
              fontSize: "13px",
              opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
            }}
          >
            <i className="fa fa-chevron-right" style={{ fontSize: "11px" }} />
          </button>

          <span
            style={{ fontSize: "13px", color: "#6c757d", marginLeft: "8px" }}
          >
            Página {pagination.page} de {pagination.totalPages}
          </span>
        </div>
      )}
    </div>
  );
}

export default Auditoria;
