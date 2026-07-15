// src/components/administrador/TemplateAdmin.tsx
import { useAuth } from "../../auth/AuthContext";

function SettingsAdmin() {
  const { user } = useAuth();

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <h2
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#1f2937",
              marginBottom: "8px",
              letterSpacing: "-0.5px",
            }}
          >
            Configuración de Ejecutivo
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "#6b7280",
              margin: 0,
            }}
          >
            Ajustes del sistema - {user?.username}
          </p>
        </div>
      </div>

      {/* Card Principal */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              backgroundColor: "#eff6ff",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <svg width="32" height="32" fill="#2563eb" viewBox="0 0 16 16">
              <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z" />
            </svg>
          </div>

          <h4
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1f2937",
              marginBottom: "8px",
            }}
          >
            Módulo de Configuración
          </h4>

          <p
            style={{
              fontSize: "15px",
              color: "#6b7280",
              margin: 0,
              maxWidth: "500px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Esta sección está pendiente de implementación. Aquí podrás
            configurar parámetros del sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsAdmin;
