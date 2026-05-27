// src/auth/Login.tsx
import { useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useTranslation } from "react-i18next";
import logoSeemann from "./logoseemann.png";
import { Link, useNavigate } from "react-router-dom";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudflare } from "@fortawesome/free-brands-svg-icons";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PRIMARY = "#ff6200";
const DARK = "#1a1a1a";
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

export default function Login() {
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
      setErr(t("home.login.captchaRequired"));
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

      if (loggedUser.username === "Ejecutivo") {
        // Redirigir automáticamente al portal correspondiente
        if (loggedUser.roles?.proveedor) {
          navigate("/proveedor/home", { replace: true });
        } else {
          navigate("/admin/home", { replace: true });
        }
        return;
      }
    } catch (e: unknown) {
      const error = e as { message?: string; requiresCaptcha?: boolean };
      if (error.requiresCaptcha) {
        setCaptchaRequired(true);
        setTurnstileToken(null);
        turnstileRef.current?.reset();
      } else {
        // El captcha fue verificado o no era necesario: ocultar widget
        setCaptchaRequired(false);
        setTurnstileToken(null);
      }
      setErr(error.message || t("home.login.loginError"));
      setLoading(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily: FONT,
        background:
          "linear-gradient(135deg, rgba(26, 26, 26, 1) 0%, rgba(26, 26, 26, 1) 42%, rgba(250, 250, 250, 1) 42%, rgba(250, 250, 250, 1) 100%)",
      }}
    >
      {/* Left brand panel */}
      <div
        className="login-brand-panel"
        style={{
          width: "42%",
          minHeight: "100vh",
          backgroundColor: DARK,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "32px",
          padding: "48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle geometric accent */}
        <div
          style={{
            position: "absolute",
            bottom: "-120px",
            right: "-120px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            border: `1px solid rgba(255, 98, 0, 0.08)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            right: "-60px",
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            border: `1px solid rgba(255, 98, 0, 0.05)`,
          }}
        />

        {/* Top: Logo */}
        <div
          className="login-brand-header"
          style={{ position: "relative", zIndex: 1 }}
        >
          <img
            className="login-brand-logo"
            src={logoSeemann}
            alt="Seemann Group"
            style={{
              height: "80px",
              width: "auto",
              display: "block",
            }}
          />
        </div>

        {/* Center: Brand message */}
        <div
          className="login-brand-copy"
          style={{ position: "relative", zIndex: 1 }}
        >
          <div
            className="login-brand-accent"
            style={{
              width: "32px",
              height: "3px",
              backgroundColor: PRIMARY,
              marginBottom: "24px",
            }}
          />
          <h1
            className="login-brand-title"
            style={{
              fontSize: "32px",
              fontWeight: "600",
              color: "#ffffff",
              lineHeight: "1.3",
              margin: "0 0 16px 0",
              letterSpacing: "-0.5px",
            }}
          >
            {t("home.login.title")}
          </h1>
          <p
            className="login-brand-subtitle"
            style={{
              fontSize: "15px",
              color: "rgba(255, 255, 255, 0.5)",
              margin: 0,
              lineHeight: "1.6",
              maxWidth: "320px",
            }}
          >
            {t("home.login.subtitle")}
          </p>
        </div>

        {/* Bottom: Footer */}
        <p
          className="login-brand-footer"
          style={{
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.3)",
            margin: 0,
          }}
        >
          © {new Date().getFullYear()} Seemann Group
        </p>
      </div>

      {/* Right form panel */}
      <div
        className="login-form-panel"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafafa",
          padding: "48px",
        }}
      >
        <div
          className="login-form-card"
          style={{ width: "100%", maxWidth: "420px" }}
        >
          {/* Language toggle */}
          <div
            className="login-language-toggle"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "48px",
              gap: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => changeLanguage("es")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: i18n.language === "es" ? "600" : "400",
                fontFamily: FONT,
                color: i18n.language === "es" ? DARK : "#999",
                backgroundColor:
                  i18n.language === "es" ? "#fff" : "transparent",
                border:
                  i18n.language === "es"
                    ? "1px solid #e5e5e5"
                    : "1px solid transparent",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              ES
            </button>
            <button
              type="button"
              onClick={() => changeLanguage("en")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: i18n.language === "en" ? "600" : "400",
                fontFamily: FONT,
                color: i18n.language === "en" ? DARK : "#999",
                backgroundColor:
                  i18n.language === "en" ? "#fff" : "transparent",
                border:
                  i18n.language === "en"
                    ? "1px solid #e5e5e5"
                    : "1px solid transparent",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              EN
            </button>
          </div>

          {/* Heading */}
          <h2
            className="login-form-title"
            style={{
              fontSize: "22px",
              fontWeight: "600",
              color: DARK,
              margin: "0 0 6px 0",
              letterSpacing: "-0.3px",
            }}
          >
            {t("home.login.loginButton")}
          </h2>
          <p
            className="login-form-subtitle"
            style={{
              fontSize: "14px",
              color: "#888",
              margin: "0 0 36px 0",
              fontWeight: "400",
            }}
          >
            {t("home.login.subtitle")}
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
            <div className="login-field-group" style={{ marginBottom: "20px" }}>
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
                {t("home.login.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t("home.login.emailPlaceholder")}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  fontSize: "16px",
                  fontFamily: FONT,
                  color: DARK,
                  backgroundColor: "#fff",
                  border: `1px solid ${focusedField === "email" ? PRIMARY : "#d4d4d4"}`,
                  borderRadius: "4px",
                  outline: "none",
                  transition: "border-color 0.15s ease",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Password */}
            <div className="login-field-group" style={{ marginBottom: "28px" }}>
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
                {t("home.login.passwordLabel")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={t("home.login.passwordPlaceholder")}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  fontSize: "16px",
                  fontFamily: FONT,
                  color: DARK,
                  backgroundColor: "#fff",
                  border: `1px solid ${focusedField === "password" ? PRIMARY : "#d4d4d4"}`,
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
                  {t("home.login.captchaLabel")}
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
                    ? "#ccc"
                    : PRIMARY,
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
                  e.currentTarget.style.backgroundColor = "#e55800";
              }}
              onMouseLeave={(e) => {
                if (!loading && !(captchaRequired && !turnstileToken))
                  e.currentTarget.style.backgroundColor = PRIMARY;
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
                  {t("home.login.loggingIn")}
                </span>
              ) : (
                t("home.login.loginButton")
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

          {/* Divider + links */}
          <div
            className="login-form-links"
            style={{
              marginTop: "32px",
              paddingTop: "24px",
              borderTop: "1px solid #e5e5e5",
            }}
          >
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                color: "#888",
                textAlign: "center",
              }}
            >
              {t("home.login.executiveLink")}{" "}
              <Link
                to="/login-admin"
                style={{
                  color: PRIMARY,
                  fontWeight: "500",
                  textDecoration: "none",
                }}
              >
                {t("home.login.executiveLinkText")}
              </Link>
            </p>
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                color: "#888",
                textAlign: "center",
              }}
            >
              {t("home.login.proveedorLink")}{" "}
              <Link
                to="/login-proveedor"
                style={{
                  color: PRIMARY,
                  fontWeight: "500",
                  textDecoration: "none",
                }}
              >
                {t("home.login.proveedorLinkText")}
              </Link>
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#aaa",
                textAlign: "center",
              }}
            >
              {t("home.login.helpText")}{" "}
              <span
                style={{
                  color: "#888",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                {t("home.login.helpLink")}
              </span>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .login-page {
          width: 100%;
        }

        .login-form-card {
          position: relative;
        }

        .login-brand-title,
        .login-form-title {
          text-wrap: balance;
        }

        @media (max-width: 1024px) {
          .login-brand-panel {
            width: 38% !important;
            padding: 40px 32px !important;
          }

          .login-form-panel {
            padding: 40px 32px !important;
          }
        }

        @media (max-width: 768px) {
          .login-page {
            min-height: 100vh;
            flex-direction: column;
            background: linear-gradient(180deg, #1a1a1a 0%, #1a1a1a 34%, #f4f4f4 34%, #f4f4f4 100%) !important;
          }

          .login-brand-panel {
            width: 100% !important;
            min-height: auto !important;
            padding: 24px 20px 88px !important;
            gap: 24px !important;
            justify-content: flex-start !important;
          }

          .login-brand-header {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .login-brand-logo {
            height: 60px !important;
            max-width: min(220px, 70vw);
            object-fit: contain;
          }

          .login-brand-copy {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            max-width: 100%;
          }

          .login-brand-accent {
            margin-bottom: 18px !important;
          }

          .login-brand-title {
            font-size: 26px !important;
            margin-bottom: 12px !important;
          }

          .login-brand-subtitle {
            max-width: 32ch !important;
            font-size: 14px !important;
            line-height: 1.7 !important;
          }

          .login-brand-footer {
            display: none;
          }

          .login-form-panel {
            align-items: flex-start !important;
            padding: 0 14px 24px !important;
            background: transparent !important;
            margin-top: -56px;
          }

          .login-form-card {
            max-width: 100% !important;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 24px;
            padding: 22px 18px 20px;
            box-shadow: 0 20px 55px rgba(0, 0, 0, 0.14);
            backdrop-filter: blur(10px);
          }

          .login-language-toggle {
            margin-bottom: 28px !important;
          }

          .login-form-title {
            font-size: 24px !important;
          }

          .login-form-subtitle {
            margin-bottom: 24px !important;
            line-height: 1.6;
          }

          .login-field-group {
            margin-bottom: 16px !important;
          }

          .login-form-links {
            margin-top: 24px !important;
            padding-top: 20px !important;
          }
        }

        @media (max-width: 420px) {
          .login-brand-panel {
            padding: 20px 16px 84px !important;
          }

          .login-brand-title {
            font-size: 23px !important;
          }

          .login-form-panel {
            padding: 0 10px 18px !important;
          }

          .login-form-card {
            padding: 20px 16px 18px;
            border-radius: 20px;
          }
        }
      `}</style>
    </div>
  );
}
