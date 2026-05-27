import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useTranslation } from "react-i18next";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const quickActions = [
  {
    key: "gestionar",
    title: "Gestionar Tarifas",
    description:
      "Agrega y administra tarifas aéreas, FCL y LCL en nombre de los proveedores",
    icon: "fa fa-edit",
    path: "/admin/pricing",
    accent: "var(--primary-color, #ff6200)",
    bgHover: "#fff7ed",
    features: [
      "Agregar tarifas en nombre de proveedores",
      "Editar y eliminar tarifas existentes",
      "Tarifas Aéreas, FCL y LCL",
    ],
  },
  {
    key: "completo",
    title: "Tarifario Completo",
    description:
      "Visualiza todas las tarifas de todos los proveedores en un solo lugar",
    icon: "fa fa-table",
    path: "/admin/tarifario-completo",
    accent: "#2563eb",
    bgHover: "#eff6ff",
    features: [
      "Vista consolidada de todas las tarifas",
      "Filtros por proveedor y servicio",
      "Todos los proveedores en un panel",
    ],
  },
  {
    key: "documentos",
    title: "Documentos Proveedores",
    description: "Revisa los archivos y documentos subidos por los proveedores",
    icon: "fa fa-folder-open",
    path: "/admin/documentos-proveedores",
    accent: "#059669",
    bgHover: "#f0fdf4",
    features: [
      "Archivos Excel y CSV de proveedores",
      "Organizados por categoría",
      "Descarga y gestión de documentos",
    ],
  },
  {
    key: "cotizador",
    title: "Cotizador",
    description: "Genera cotizaciones de envíos aéreos, marítimos y terrestres",
    icon: "fa fa-calculator",
    path: "/admin/cotizador-administrador",
    accent: "#7c3aed",
    bgHover: "#f5f3ff",
    features: [
      "Cotizaciones Aéreas, FCL y LCL",
      "Basado en tarifas de proveedores",
      "Envío rápido a clientes",
    ],
  },
];

export default function HomePricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const nombreUsuario = user?.nombreuser || user?.email || "Pricing";

  return (
    <div
      style={{
        fontFamily: FONT,
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
        padding: "32px 24px",
        margin: "-24px",
        marginBottom: 0,
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Welcome */}
        <div style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 4px" }}>
            Bienvenido/a
          </p>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1f2937",
              margin: "0 0 6px",
              letterSpacing: -0.3,
            }}
          >
            {nombreUsuario}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#6b7280",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Panel de administración de tarifas y proveedores
          </p>
        </div>

        {/* Info banner */}
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 28,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <i
            className="fa fa-info-circle"
            style={{ color: "#6b7280", fontSize: 16, marginTop: 2 }}
          />
          <p
            style={{
              fontSize: 13,
              color: "#6b7280",
              lineHeight: 1.55,
              margin: 0,
              fontFamily: FONT,
            }}
          >
            Como usuario de{" "}
            <strong style={{ color: "#1f2937" }}>Pricing</strong>, tienes acceso
            completo a las tarifas de todos los proveedores. Puedes gestionar,
            visualizar y agregar tarifas en su nombre, así como revisar los
            documentos que han subido.
          </p>
        </div>

        {/* Quick Action Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 20,
            marginBottom: 32,
          }}
        >
          {quickActions.map((action) => (
            <div
              key={action.key}
              onClick={() => navigate(action.path)}
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "28px 24px",
                cursor: "pointer",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = action.accent;
                e.currentTarget.style.boxShadow = `0 1px 6px ${action.accent}20`;
                const indicator = e.currentTarget.querySelector(
                  ".card-indicator",
                ) as HTMLElement;
                if (indicator) indicator.style.backgroundColor = action.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.boxShadow = "none";
                const indicator = e.currentTarget.querySelector(
                  ".card-indicator",
                ) as HTMLElement;
                if (indicator) indicator.style.backgroundColor = "transparent";
              }}
            >
              <span
                className="card-indicator"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  borderRadius: "8px 8px 0 0",
                  backgroundColor: "transparent",
                  transition: "background-color 0.15s ease",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    minWidth: 40,
                    borderRadius: 6,
                    backgroundColor: "#f0f2f4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#232f3e",
                    fontSize: 18,
                  }}
                >
                  <i className={action.icon} />
                </div>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#232f3e",
                    margin: 0,
                    letterSpacing: -0.1,
                    fontFamily: FONT,
                  }}
                >
                  {action.title}
                </h2>
              </div>

              <p
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  lineHeight: 1.55,
                  margin: "0 0 20px",
                  flex: 1,
                  fontFamily: FONT,
                }}
              >
                {action.description}
              </p>

              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {action.features.map((f, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 13,
                      color: "#4b5563",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      lineHeight: 1.4,
                      fontFamily: FONT,
                    }}
                  >
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        minWidth: 4,
                        borderRadius: "50%",
                        backgroundColor: "#8d99a8",
                      }}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(action.path);
                }}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  backgroundColor: action.accent,
                  border: "none",
                  borderRadius: 4,
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT,
                  cursor: "pointer",
                  transition: "opacity 0.15s ease",
                  marginTop: "auto",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Ir a {action.title}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
