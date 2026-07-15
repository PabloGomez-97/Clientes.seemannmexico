// src/components/Sidebar/MisDocumentosCliente.tsx
// Vista de documentos para el cliente — solo ve los suyos, acceso completo
import { useAuth } from "../../auth/AuthContext";
import { DocumentosUnificadosView } from "./Documents/DocumentosUnificadosView";
import { imgUrl } from "../../config/images";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function MisDocumentosCliente() {
  const { activeUsername } = useAuth();

  if (!activeUsername) {
    return (
      <div
        style={{
          fontFamily: FONT,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          <div style={{ marginBottom: 8 }}>
            No se pudo identificar tu cuenta.
          </div>
          <div style={{ fontSize: 12 }}>Vuelve a iniciar sesión.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Image banner */}
      <div
        style={{
          position: "relative",
          height: 220,
          overflow: "hidden",
          background: "#1a1a1a",
        }}
      >
        <img
          src={imgUrl("/imo.png")}
          alt="Operaciones Aéreas"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.75,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, rgba(26,26,26,0.85) 0%, rgba(26,26,26,0.35) 100%)",
            display: "flex",
            alignItems: "center",
            padding: "0 32px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                background: "var(--primary-color)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                padding: "3px 10px",
                borderRadius: 3,
                marginBottom: 10,
              }}
            >
              Documentación
            </div>
            <h2
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Mis Documentos
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: 14,
                margin: "8px 0 0",
                maxWidth: 460,
              }}
            >
              Sube y consulta tus documentos (facturas, packing lists, órdenes
              de compra y más) asociados a tus cotizaciones, todo en un solo
              lugar.
            </p>
          </div>
        </div>
      </div>

      <DocumentosUnificadosView
        ownerUsername={activeUsername}
        canDelete={true}
      />
    </div>
  );
}

export default MisDocumentosCliente;
