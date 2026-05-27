// src/auth/LoginAdmin.tsx
import { useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoSeemann from "./logoseemann.png";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudflare } from "@fortawesome/free-brands-svg-icons";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PRIMARY = "#ff6200";
const DARK = "#1a1a1a";
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

export default function LoginAdmin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (captchaRequired && !turnstileToken) {
      setErr("Por favor completa la verificación de seguridad.");
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const loggedUser = await login(
        email,
        password,
        turnstileToken ?? undefined,
      );

      if (loggedUser.username !== "Ejecutivo") {
        logout();
        setErr(
          "Acceso denegado. Esta área es exclusiva para ejecutivos. Por favor, ingresa como cliente usando el enlace de abajo.",
        );
        setLoading(false);
        return;
      }

      if (loggedUser.roles?.proveedor) {
        logout();
        setErr(
          "Acceso denegado. Tu cuenta es de proveedor. Por favor, ingresa a través del portal de proveedores.",
        );
        setLoading(false);
        return;
      }

      navigate("/admin/home", { replace: true });
    } catch (e: unknown) {
      const error = e as { message?: string; requiresCaptcha?: boolean };
      if (error.requiresCaptcha) {
        setCaptchaRequired(true);
        setTurnstileToken(null);
        turnstileRef.current?.reset();
      } else {
        setCaptchaRequired(false);
        setTurnstileToken(null);
      }
      setErr((error as any).message || "No se pudo iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: DARK,
        fontFamily: FONT,
        position: "relative",
      }}
    >
      {/* Subtle grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          position: "relative",
          zIndex: 1,
          margin: "0 24px",
        }}
      >
        {/* Card */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "6px",
            overflow: "hidden",
            boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Orange top accent stripe */}
          <div
            style={{
              height: "3px",
              backgroundColor: PRIMARY,
            }}
          />

          <div style={{ padding: "40px 36px 36px" }}>
            {/* Logo */}
            <div style={{ marginBottom: "32px" }}>
              <img
                src={logoSeemann}
                alt="Seemann Group"
                style={{
                  height: "32px",
                  width: "auto",
                  display: "block",
                }}
              />
            </div>

            {/* Heading */}
            <h1
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: DARK,
                margin: "0 0 4px 0",
                letterSpacing: "-0.3px",
              }}
            >
              Portal Ejecutivo
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "#888",
                margin: "0 0 32px 0",
                fontWeight: "400",
              }}
            >
              Ingresa tus credenciales para continuar
            </p>

            {/* Error */}
            {err && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  borderLeft: `3px solid #dc2626`,
                  padding: "12px 16px",
                  marginBottom: "24px",
                  borderRadius: "2px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#991b1b",
                    fontWeight: "400",
                    lineHeight: "1.5",
                  }}
                >
                  {err}
                </p>
              </div>
            )}

            <form onSubmit={onSubmit}>
              {/* Email */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "#555",
                    marginBottom: "6px",
                  }}
                >
                  Correo corporativo
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ejecutivo@seemann.com"
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    fontFamily: FONT,
                    color: DARK,
                    backgroundColor: "#fff",
                    border: `1px solid ${focusedField === "email" ? DARK : "#d4d4d4"}`,
                    borderRadius: "4px",
                    outline: "none",
                    transition: "border-color 0.15s ease",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: "28px" }}>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "#555",
                    marginBottom: "6px",
                  }}
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    fontFamily: FONT,
                    color: DARK,
                    backgroundColor: "#fff",
                    border: `1px solid ${focusedField === "password" ? DARK : "#d4d4d4"}`,
                    borderRadius: "4px",
                    outline: "none",
                    transition: "border-color 0.15s ease",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Turnstile captcha (se muestra tras 3 intentos fallidos) */}
              {captchaRequired && (
                <div style={{ marginBottom: "20px" }}>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#555",
                      marginBottom: "8px",
                      fontWeight: "500",
                    }}
                  >
                    Verificación de seguridad requerida
                  </p>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    onSuccess={(token) => setTurnstileToken(token)}
                    onError={() => setTurnstileToken(null)}
                    onExpire={() => setTurnstileToken(null)}
                    options={{ theme: "light" }}
                  />
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || (captchaRequired && !turnstileToken)}
                style={{
                  width: "100%",
                  padding: "11px 20px",
                  fontSize: "14px",
                  fontWeight: "500",
                  fontFamily: FONT,
                  color: "#fff",
                  backgroundColor:
                    loading || (captchaRequired && !turnstileToken)
                      ? "#999"
                      : DARK,
                  border: "none",
                  borderRadius: "4px",
                  cursor:
                    loading || (captchaRequired && !turnstileToken)
                      ? "not-allowed"
                      : "pointer",
                  transition: "background-color 0.15s ease",
                  letterSpacing: "0.2px",
                }}
                onMouseEnter={(e) => {
                  if (!loading && !(captchaRequired && !turnstileToken))
                    e.currentTarget.style.backgroundColor = "#333";
                }}
                onMouseLeave={(e) => {
                  if (!loading && !(captchaRequired && !turnstileToken))
                    e.currentTarget.style.backgroundColor = DARK;
                }}
              >
                {loading ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.6s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    Verificando acceso...
                  </span>
                ) : (
                  "Ingresar al Panel"
                )}
              </button>
              {/* Cloudflare notice */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <FontAwesomeIcon
                  icon={faCloudflare}
                  style={{ fontSize: 14, color: "#F38020" }}
                />
                <span style={{ fontSize: 12, color: "#F38020" }}>
                  {t("home.login.protectedByCloudflare")}
                </span>
              </div>
            </form>

            {/* Divider + link */}
            <div
              style={{
                marginTop: "28px",
                paddingTop: "20px",
                borderTop: "1px solid #eee",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "13px",
                  color: "#888",
                }}
              >
                ¿Eres cliente?{" "}
                <Link
                  to="/login"
                  style={{
                    color: PRIMARY,
                    fontWeight: "500",
                    textDecoration: "none",
                  }}
                >
                  Ingresa aquí
                </Link>
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#888",
                }}
              >
                ¿Eres proveedor?{" "}
                <Link
                  to="/login-proveedor"
                  style={{
                    color: PRIMARY,
                    fontWeight: "500",
                    textDecoration: "none",
                  }}
                >
                  Ingresa aquí
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.3)",
          }}
        >
          © {new Date().getFullYear()} Seemann Group. Todos los derechos
          reservados.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
