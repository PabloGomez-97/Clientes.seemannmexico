// src/components/Sidebar/CotizacionEspecial.tsx
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { imgUrl } from "../../config/images";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const API_BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

export default function CotizacionEspecial() {
  const { user, token } = useAuth();
  const ejecutivo = user?.ejecutivo ?? null;

  const getEjecutivoImage = (nombre?: string) => {
    if (!nombre) return null;
    const partes = nombre.trim().split(" ");
    if (partes.length < 2) return null;
    const iniciales = partes[0][0].toLowerCase() + partes[1][0].toLowerCase();
    return imgUrl(`/ejecutivos/${iniciales}.png`);
  };
  const ejecutivoImage = getEjecutivoImage(ejecutivo?.nombre);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContactar = async () => {
    if (!token || !ejecutivo) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/send-special-quote-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      setSent(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al enviar la solicitud.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* Main card */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
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
            alt="Carga especial"
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
                Servicio Premium
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
                ¿Necesitas una cotización especial?
              </h2>
              <p
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 14,
                  margin: "8px 0 0",
                  maxWidth: 460,
                }}
              >
                Cargas sobredimensionadas, proyecto, temperatura controlada,
                materiales peligrosos u otras condiciones especiales. Tu
                ejecutivo te dará la mejor solución.
              </p>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div style={{ padding: 28 }}>
          {/* Info notice */}
          <div
            style={{
              display: "flex",
              gap: 12,
              padding: "14px 16px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 6,
              marginBottom: 24,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary-color)"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: "#92400e",
                lineHeight: 1.55,
              }}
            >
              Las cotizaciones de carácter especial requieren análisis
              personalizado. Tu ejecutivo comercial asignado las gestionará
              directamente contigo para ofrecerte la mejor tarifa y solución
              operativa.
            </p>
          </div>

          {/* Executive card */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 7,
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                background: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 11,
                fontWeight: 700,
                color: "#6b7280",
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              Tu ejecutivo comercial asignado
            </div>

            <div
              style={{
                padding: 20,
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "var(--primary-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 20,
                  overflow: "hidden",
                }}
              >
                {ejecutivoImage ? (
                  <img
                    src={ejecutivoImage}
                    alt={ejecutivo?.nombre || "Ejecutivo"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                      const parent = (e.currentTarget as HTMLImageElement)
                        .parentElement;
                      if (parent) {
                        parent.textContent = ejecutivo?.nombre
                          ? ejecutivo.nombre.charAt(0).toUpperCase()
                          : "?";
                      }
                    }}
                  />
                ) : ejecutivo?.nombre ? (
                  ejecutivo.nombre.charAt(0).toUpperCase()
                ) : (
                  "?"
                )}
              </div>

              {/* Info */}
              {ejecutivo ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1f2937",
                      marginBottom: 4,
                    }}
                  >
                    {ejecutivo.nombre}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px 18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 13,
                        color: "#4b5563",
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      {ejecutivo.email}
                    </div>
                    {ejecutivo.telefono && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 13,
                          color: "#4b5563",
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 10.81a19.79 19.79 0 01-3.07-8.63A2 2 0 011.92 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                        </svg>
                        {ejecutivo.telefono}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, fontSize: 14, color: "#9ca3af" }}>
                  No tienes un ejecutivo asignado. Contacta a{" "}
                  <strong>Seemann Group</strong> para asignarte uno.
                </div>
              )}
            </div>
          </div>

          {/* Action area */}
          {ejecutivo && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              {sent ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 18px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 6,
                    fontSize: 14,
                    color: "#166534",
                    fontWeight: 500,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  ¡Mensaje enviado! Tu ejecutivo{" "}
                  <strong style={{ marginLeft: 3 }}>{ejecutivo.nombre}</strong>{" "}
                  te contactará a la brevedad.
                  <button
                    onClick={() => setSent(false)}
                    style={{
                      marginLeft: 12,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#166534",
                      textDecoration: "underline",
                      padding: 0,
                      fontFamily: FONT,
                    }}
                  >
                    Enviar otro
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleContactar}
                  disabled={sending}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 22px",
                    background: sending ? "#f97316" : "var(--primary-color)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 5,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: sending ? "wait" : "pointer",
                    fontFamily: FONT,
                    opacity: sending ? 0.8 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  {sending ? (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        style={{
                          animation: "spin 1s linear infinite",
                        }}
                      >
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      Contáctame con mi ejecutivo
                    </>
                  )}
                </button>
              )}

              {error && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#dc2626",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 5,
                    padding: "8px 14px",
                  }}
                >
                  {error}
                </p>
              )}

              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                Se enviará un correo a <strong>{ejecutivo.email}</strong>{" "}
                notificando que necesitas una cotización especial. Tu ejecutivo
                te contactará a la brevedad.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
