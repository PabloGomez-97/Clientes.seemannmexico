// src/auth/LoginProveedor.tsx
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
const PRIMARY_RAW = "#ff6200";
const DARK_RAW = "#1a1a1a";
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

export default function LoginProveedor() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (captchaRequired && !turnstileToken) {
      setErr(t("proveedor.login.captchaRequired"));
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

      // Verificar que el usuario sea un ejecutivo con rol proveedor
      if (loggedUser.username !== "Ejecutivo" || !loggedUser.roles?.proveedor) {
        logout();
        setErr(t("proveedor.login.accessDenied"));
        setLoading(false);
        return;
      }

      navigate("/proveedor/home", { replace: true });
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
      setErr(error.message || t("proveedor.login.loginError"));
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
        backgroundColor: DARK_RAW,
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

      {/* Accent circle decorations */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-100px",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          border: "1px solid rgba(255, 98, 0, 0.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-80px",
          left: "-80px",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          border: "1px solid rgba(255, 98, 0, 0.04)",
        }}
      />

      {/* Content */}
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          position: "relative",
          zIndex: 1,
          margin: "0 24px",
        }}
      >
        {/* Language switcher */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "16px",
            gap: "4px",
          }}
        >
          <button
            onClick={() => changeLanguage("es")}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: i18n.language === "es" ? "600" : "400",
              fontFamily: FONT,
              color:
                i18n.language === "es" ? PRIMARY_RAW : "rgba(255,255,255,0.4)",
              backgroundColor:
                i18n.language === "es"
                  ? "rgba(255, 98, 0, 0.15)"
                  : "transparent",
              border: "1px solid",
              borderColor:
                i18n.language === "es"
                  ? "rgba(255, 98, 0, 0.3)"
                  : "rgba(255,255,255,0.1)",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            ES
          </button>
          <button
            onClick={() => changeLanguage("en")}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: i18n.language === "en" ? "600" : "400",
              fontFamily: FONT,
              color:
                i18n.language === "en" ? PRIMARY_RAW : "rgba(255,255,255,0.4)",
              backgroundColor:
                i18n.language === "en"
                  ? "rgba(255, 98, 0, 0.15)"
                  : "transparent",
              border: "1px solid",
              borderColor:
                i18n.language === "en"
                  ? "rgba(255, 98, 0, 0.3)"
                  : "rgba(255,255,255,0.1)",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            EN
          </button>
        </div>

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
              backgroundColor: PRIMARY_RAW,
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "4px",
              }}
            >
              <h1
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: DARK_RAW,
                  margin: 0,
                  letterSpacing: "-0.3px",
                }}
              >
                {t("proveedor.login.title")}
              </h1>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: "700",
                  backgroundColor: "rgba(255, 98, 0, 0.1)",
                  color: PRIMARY_RAW,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {t("proveedor.login.badge")}
              </span>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "#888",
                margin: "0 0 32px 0",
                fontWeight: "400",
              }}
            >
              {t("proveedor.login.subtitle")}
            </p>

            {/* Error */}
            {err && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  borderLeft: "3px solid #dc2626",
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
                  htmlFor="email-proveedor"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "#555",
                    marginBottom: "6px",
                  }}
                >
                  {t("proveedor.login.emailLabel")}
                </label>
                <input
                  id="email-proveedor"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("proveedor.login.emailPlaceholder")}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    fontFamily: FONT,
                    color: DARK_RAW,
                    backgroundColor: "#fff",
                    border: `1px solid ${focusedField === "email" ? DARK_RAW : "#d4d4d4"}`,
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
                  htmlFor="password-proveedor"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "#555",
                    marginBottom: "6px",
                  }}
                >
                  {t("proveedor.login.passwordLabel")}
                </label>
                <input
                  id="password-proveedor"
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
                    color: DARK_RAW,
                    backgroundColor: "#fff",
                    border: `1px solid ${focusedField === "password" ? DARK_RAW : "#d4d4d4"}`,
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
                    {t("proveedor.login.captchaLabel")}
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
                      : DARK_RAW,
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
                    e.currentTarget.style.backgroundColor = DARK_RAW;
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
                    {t("proveedor.login.verifying")}
                  </span>
                ) : (
                  t("proveedor.login.loginButton")
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
                  {t("proveedor.login.protectedByCloudflare") ||
                    "Página protegida por Cloudflare"}
                </span>
              </div>
            </form>

            {/* Divider + links */}
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
                  margin: "0 0 8px 0",
                  fontSize: "13px",
                  color: "#888",
                }}
              >
                {t("proveedor.login.clientLink")}{" "}
                <Link
                  to="/login"
                  style={{
                    color: PRIMARY_RAW,
                    fontWeight: "500",
                    textDecoration: "none",
                  }}
                >
                  {t("proveedor.login.clientLinkText")}
                </Link>
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#888",
                }}
              >
                {t("proveedor.login.executiveLink")}{" "}
                <Link
                  to="/login-admin"
                  style={{
                    color: PRIMARY_RAW,
                    fontWeight: "500",
                    textDecoration: "none",
                  }}
                >
                  {t("proveedor.login.executiveLinkText")}
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
          © {new Date().getFullYear()} Seemann Group.{" "}
          {t("proveedor.login.footer")}
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
