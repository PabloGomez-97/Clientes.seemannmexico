// src/components/Footer/CookiesSettings.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, CheckCircle } from "lucide-react";
import "./legal.css";

const LAST_UPDATED = "29 de abril de 2026";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type CookieDetail = {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
};

type CookieCategory = {
  id: "essential" | "functional" | "analytics" | "marketing";
  name: string;
  tag: string;
  tagClass: "required" | "optional";
  required: boolean;
  description: string;
  cookies: CookieDetail[];
};

/* ------------------------------------------------------------------ */
/* Cookie categories data                                               */
/* ------------------------------------------------------------------ */

const CATEGORIES: CookieCategory[] = [
  {
    id: "essential",
    name: "Cookies Esenciales",
    tag: "Siempre activas",
    tagClass: "required",
    required: true,
    description:
      "Estas cookies son imprescindibles para el correcto funcionamiento de la plataforma. Sin ellas, servicios esenciales como la autenticación de usuarios, la seguridad de la sesión y las preferencias básicas no estarían disponibles. No pueden desactivarse.",
    cookies: [
      {
        name: "sb-auth-token",
        provider: "Seemann Group / Supabase",
        purpose:
          "Mantiene la sesión de usuario autenticada y segura. Contiene token JWT cifrado.",
        duration: "Sesión / 7 días (remember me)",
      },
      {
        name: "sb-refresh-token",
        provider: "Seemann Group / Supabase",
        purpose:
          "Token de renovación automática de sesión para evitar cierres de sesión inesperados.",
        duration: "30 días",
      },
      {
        name: "XSRF-TOKEN",
        provider: "Seemann Group",
        purpose:
          "Protección contra ataques de falsificación de solicitudes entre sitios (CSRF).",
        duration: "Sesión",
      },
      {
        name: "sg_cookie_consent",
        provider: "Seemann Group",
        purpose:
          "Almacena las preferencias de consentimiento de cookies del usuario.",
        duration: "12 meses",
      },
      {
        name: "__cf_bm",
        provider: "Cloudflare",
        purpose:
          "Cookie de gestión de bots de Cloudflare. Protege la plataforma contra ataques automatizados.",
        duration: "30 minutos",
      },
      {
        name: "cf_clearance",
        provider: "Cloudflare",
        purpose:
          "Verifica que el usuario ha pasado el desafío de seguridad de Cloudflare.",
        duration: "30 minutos – 24 horas",
      },
    ],
  },
  {
    id: "functional",
    name: "Cookies Funcionales",
    tag: "Opcional",
    tagClass: "optional",
    required: false,
    description:
      "Estas cookies permiten que la plataforma recuerde sus elecciones y preferencias para ofrecerle una experiencia personalizada y mejorada. Incluyen preferencias de idioma, región, sidebar colapsado, tema de visualización y similares. Sin ellas, deberá reconfigurar sus preferencias en cada sesión.",
    cookies: [
      {
        name: "sg_lang",
        provider: "Seemann Group",
        purpose:
          "Recuerda el idioma seleccionado por el usuario (español / inglés).",
        duration: "12 meses",
      },
      {
        name: "sg_sidebar_state",
        provider: "Seemann Group",
        purpose:
          "Recuerda si el menú lateral está expandido o colapsado para mantener la disposición preferida.",
        duration: "12 meses",
      },
      {
        name: "sg_ui_prefs",
        provider: "Seemann Group",
        purpose:
          "Almacena preferencias de visualización de tablas, filtros activos y configuración de reportes.",
        duration: "6 meses",
      },
      {
        name: "sg_tracking_notif",
        provider: "Seemann Group",
        purpose:
          "Preferencias de notificaciones de tracking por correo electrónico y alertas en plataforma.",
        duration: "12 meses",
      },
    ],
  },
  {
    id: "analytics",
    name: "Cookies de Análisis y Rendimiento",
    tag: "Opcional",
    tagClass: "optional",
    required: false,
    description:
      "Estas cookies recopilan información sobre cómo los usuarios interactúan con la plataforma: páginas visitadas, tiempo de carga, errores encontrados y flujos de uso. Esta información nos ayuda a mejorar continuamente el rendimiento y la usabilidad de la plataforma. Los datos se recopilan de forma agregada y anonimizada.",
    cookies: [
      {
        name: "_vercel_insights",
        provider: "Vercel Analytics",
        purpose:
          "Análisis de rendimiento del sitio y métricas de uso (páginas vistas, tiempos de carga). Los datos son anonimizados.",
        duration: "Sesión / 24 horas",
      },
      {
        name: "_vercel_speed",
        provider: "Vercel Speed Insights",
        purpose:
          "Mide los Core Web Vitals (LCP, FID, CLS) para monitorizar la experiencia de usuario.",
        duration: "Sesión",
      },
      {
        name: "sg_session_id",
        provider: "Seemann Group",
        purpose:
          "Identificador de sesión anónimo para análisis de flujos de navegación dentro de la plataforma.",
        duration: "Sesión",
      },
    ],
  },
  {
    id: "marketing",
    name: "Cookies de Marketing y Publicidad",
    tag: "Opcional",
    tagClass: "optional",
    required: false,
    description:
      "Estas cookies se utilizan para mostrarle publicidad relevante basada en sus intereses y para medir la efectividad de nuestras campañas de marketing. Nos permiten rastrear visitas entre sitios web y construir un perfil de sus intereses. Pueden ser establecidas por nosotros o por terceros cuyos servicios hemos integrado.",
    cookies: [
      {
        name: "_fbp",
        provider: "Meta (Facebook)",
        purpose:
          "Utilizado por Meta para ofrecer una serie de productos publicitarios como pujas en tiempo real de terceros anunciantes.",
        duration: "3 meses",
      },
      {
        name: "_gcl_au",
        provider: "Google Ads",
        purpose:
          "Utilizado por Google AdSense para experimentar con la eficiencia publicitaria en los sitios que utilizan sus servicios.",
        duration: "3 meses",
      },
      {
        name: "li_sugr",
        provider: "LinkedIn",
        purpose:
          "Utilizado para hacer un seguimiento de los visitantes en múltiples sitios web, con el fin de presentar publicidad relevante.",
        duration: "3 meses",
      },
      {
        name: "UserMatchHistory",
        provider: "LinkedIn",
        purpose:
          "Sincronización de ID de LinkedIn para rastrear el uso de servicios de publicidad incrustados.",
        duration: "30 días",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* LocalStorage helpers                                                 */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "sg_cookie_consent";

type ConsentState = {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  savedAt?: string;
};

function loadConsent(): ConsentState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as ConsentState;
  } catch {
    /* ignore */
  }
  return {
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
  };
}

function saveConsent(state: ConsentState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* TOC                                                                  */
/* ------------------------------------------------------------------ */

const TOC_ITEMS = [
  { id: "what", label: "¿Qué son las cookies?" },
  { id: "types", label: "Tipos de cookies que usamos" },
  { id: "manage", label: "Gestionar mis preferencias" },
  { id: "essential-detail", label: "Esenciales" },
  { id: "functional-detail", label: "Funcionales" },
  { id: "analytics-detail", label: "Análisis y Rendimiento" },
  { id: "marketing-detail", label: "Marketing" },
  { id: "thirdparty", label: "Cookies de terceros" },
  { id: "rights", label: "Sus derechos" },
  { id: "contact", label: "Contacto" },
];

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

function CookiesSettings() {
  const [consent, setConsent] = useState<ConsentState>(loadConsent);
  const [saved, setSaved] = useState(false);

  // Sync on mount
  useEffect(() => {
    setConsent(loadConsent());
  }, []);

  const toggle = (id: "functional" | "analytics" | "marketing") => {
    setConsent((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  };

  const handleSave = () => {
    saveConsent(consent);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAcceptAll = () => {
    const all: ConsentState = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    };
    setConsent(all);
    saveConsent(all);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRejectAll = () => {
    const minimal: ConsentState = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    };
    setConsent(minimal);
    saveConsent(minimal);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const categoryIdToDetailId: Record<string, string> = {
    essential: "essential-detail",
    functional: "functional-detail",
    analytics: "analytics-detail",
    marketing: "marketing-detail",
  };

  return (
    <div className="legal-page">
      {/* Header */}
      <header className="legal-header">
        <Link to="/" className="legal-header__brand">
          <img
            src="/logo.png"
            alt="Seemann Group"
            className="legal-header__logo"
            width={36}
            height={36}
          />
          <span className="legal-header__name">Seemann Group</span>
        </Link>
        <Link to="/" className="legal-header__back">
          <ArrowLeft size={14} />
          Volver al inicio
        </Link>
      </header>

      {/* Hero */}
      <section className="legal-hero">
        <span className="legal-hero__badge">
          <Cookie size={12} style={{ display: "inline", marginRight: 4 }} />
          Privacidad
        </span>
        <h1 className="legal-hero__title">
          Política y Configuración de Cookies
        </h1>
        <p className="legal-hero__meta">
          Última actualización: <strong>{LAST_UPDATED}</strong> · Puede cambiar
          sus preferencias en cualquier momento
        </p>
      </section>

      {/* Body */}
      <main className="legal-body">
        {/* TOC */}
        <aside className="legal-toc" aria-label="Tabla de contenidos">
          <p className="legal-toc__title">Contenido</p>
          <ul className="legal-toc__list">
            {TOC_ITEMS.map((item) => (
              <li key={item.id} className="legal-toc__item">
                <a href={`#${item.id}`} className="legal-toc__link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Article */}
        <article className="legal-article">
          {/* What are cookies */}
          <section className="legal-section" id="what">
            <span className="legal-section__number">Sección 01</span>
            <h2 className="legal-section__title">¿Qué son las Cookies?</h2>
            <div className="legal-section__body">
              <p>
                Las cookies son pequeños archivos de texto que los sitios web
                almacenan en su navegador cuando los visita. Se utilizan
                ampliamente para hacer que los sitios funcionen de forma más
                eficiente, así como para proporcionar información a los
                propietarios del sitio.
              </p>
              <p>
                Existen distintos tipos de cookies según su origen y duración:
              </p>
              <ul>
                <li>
                  <strong>Cookies propias (first-party):</strong> Establecidas
                  directamente por Seemann Group para el funcionamiento de la
                  plataforma.
                </li>
                <li>
                  <strong>Cookies de terceros (third-party):</strong>{" "}
                  Establecidas por servicios externos integrados en nuestra
                  plataforma (análisis, publicidad, redes sociales).
                </li>
                <li>
                  <strong>Cookies de sesión:</strong> Se eliminan
                  automáticamente al cerrar el navegador.
                </li>
                <li>
                  <strong>Cookies persistentes:</strong> Permanecen en su
                  dispositivo durante un período determinado o hasta que las
                  elimine manualmente.
                </li>
              </ul>
              <p>
                Además de cookies convencionales, utilizamos tecnologías
                similares como el almacenamiento local del navegador
                (localStorage / sessionStorage) para guardar preferencias de la
                aplicación y tokens de autenticación de forma segura.
              </p>
            </div>
          </section>

          {/* Types overview */}
          <section className="legal-section" id="types">
            <span className="legal-section__number">Sección 02</span>
            <h2 className="legal-section__title">
              Tipos de Cookies que Utilizamos
            </h2>
            <div className="legal-section__body">
              <div className="legal-table-wrapper">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Finalidad principal</th>
                      <th>Requiere consentimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Esenciales</strong>
                      </td>
                      <td>
                        Autenticación, seguridad, funcionamiento básico de la
                        plataforma
                      </td>
                      <td>No (siempre activas)</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Funcionales</strong>
                      </td>
                      <td>
                        Idioma, preferencias de UI, configuración personalizada
                      </td>
                      <td>Sí</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Análisis y Rendimiento</strong>
                      </td>
                      <td>
                        Métricas de uso, Core Web Vitals, monitoreo de
                        rendimiento
                      </td>
                      <td>Sí</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Marketing</strong>
                      </td>
                      <td>
                        Publicidad personalizada, rastreo entre sitios, campañas
                      </td>
                      <td>Sí</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Manage preferences */}
          <section className="legal-section" id="manage">
            <span className="legal-section__number">Sección 03</span>
            <h2 className="legal-section__title">
              Gestionar mis Preferencias de Cookies
            </h2>
            <div className="legal-section__body">
              <p>
                Puede aceptar o rechazar las cookies opcionales en cualquier
                momento. Sus preferencias se guardarán en su dispositivo durante{" "}
                <strong>12 meses</strong>. Las cookies esenciales no pueden
                desactivarse ya que son imprescindibles para el funcionamiento
                de la plataforma.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "0.625rem",
                  flexWrap: "wrap",
                  marginTop: "1.25rem",
                  marginBottom: "0.5rem",
                }}
              >
                <button
                  className="legal-btn legal-btn--primary"
                  onClick={handleAcceptAll}
                  type="button"
                >
                  Aceptar todas
                </button>
                <button
                  className="legal-btn legal-btn--secondary"
                  onClick={handleRejectAll}
                  type="button"
                >
                  Solo esenciales
                </button>
                <button
                  className="legal-btn legal-btn--secondary"
                  onClick={handleSave}
                  type="button"
                >
                  Guardar selección actual
                </button>
              </div>

              {saved && (
                <div
                  className="legal-infocard legal-infocard--green"
                  style={{
                    marginTop: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <CheckCircle size={16} color="#16a34a" />
                  <span>
                    <strong>Preferencias guardadas.</strong> Su configuración de
                    cookies ha sido actualizada correctamente.
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Category details */}
          {CATEGORIES.map((cat) => (
            <section
              className="legal-section"
              id={categoryIdToDetailId[cat.id]}
              key={cat.id}
            >
              <span className="legal-section__number">
                {cat.id === "essential"
                  ? "Sección 04"
                  : cat.id === "functional"
                    ? "Sección 05"
                    : cat.id === "analytics"
                      ? "Sección 06"
                      : "Sección 07"}
              </span>
              <h2 className="legal-section__title">{cat.name}</h2>
              <div className="legal-section__body">
                {/* Category card */}
                <div className="cookie-category">
                  <div className="cookie-category__header">
                    <div className="cookie-category__info">
                      <div className="cookie-category__name">
                        {cat.name}
                        <span
                          className={`cookie-category__tag cookie-category__tag--${cat.tagClass}`}
                        >
                          {cat.tag}
                        </span>
                      </div>
                      <p className="cookie-category__desc">{cat.description}</p>
                    </div>

                    <label
                      className="cookie-toggle"
                      aria-label={`Activar ${cat.name}`}
                    >
                      <input
                        type="checkbox"
                        checked={consent[cat.id]}
                        disabled={cat.required}
                        onChange={() => {
                          if (!cat.required) {
                            toggle(
                              cat.id as
                                | "functional"
                                | "analytics"
                                | "marketing",
                            );
                          }
                        }}
                      />
                      <span className="cookie-toggle__slider" />
                    </label>
                  </div>

                  {/* Cookie detail table */}
                  <div className="cookie-category__body">
                    <table className="cookie-detail-table">
                      <thead>
                        <tr>
                          <th style={{ width: "22%" }}>Nombre</th>
                          <th style={{ width: "22%" }}>Proveedor</th>
                          <th style={{ width: "40%" }}>Propósito</th>
                          <th style={{ width: "16%" }}>Duración</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.cookies.map((ck) => (
                          <tr key={ck.name}>
                            <td>
                              <code
                                style={{
                                  fontSize: "0.78rem",
                                  background: "#f3f4f6",
                                  padding: "1px 4px",
                                  borderRadius: 4,
                                }}
                              >
                                {ck.name}
                              </code>
                            </td>
                            <td>{ck.provider}</td>
                            <td>{ck.purpose}</td>
                            <td>{ck.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          ))}

          {/* Third party */}
          <section className="legal-section" id="thirdparty">
            <span className="legal-section__number">Sección 08</span>
            <h2 className="legal-section__title">
              Cookies de Terceros y SDKs Integrados
            </h2>
            <div className="legal-section__body">
              <p>
                Nuestra plataforma puede integrar servicios de terceros que
                establecen sus propias cookies y tienen sus propias políticas de
                privacidad. Seemann Group no controla el contenido ni las
                prácticas de privacidad de estos terceros:
              </p>

              <div className="legal-table-wrapper">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Servicio</th>
                      <th>Categoría</th>
                      <th>Política de privacidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Cloudflare</strong>
                      </td>
                      <td>CDN, protección DDoS y seguridad web</td>
                      <td>Esencial</td>
                      <td>
                        <a
                          href="https://www.cloudflare.com/privacypolicy/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          cloudflare.com/privacypolicy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Vercel</strong>
                      </td>
                      <td>Hosting, Analytics y Speed Insights</td>
                      <td>Esencial / Análisis</td>
                      <td>
                        <a
                          href="https://vercel.com/legal/privacy-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          vercel.com/legal/privacy-policy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Supabase</strong>
                      </td>
                      <td>Autenticación y base de datos</td>
                      <td>Esencial</td>
                      <td>
                        <a
                          href="https://supabase.com/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          supabase.com/privacy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>OpenAI</strong>
                      </td>
                      <td>Preferencias de notificaciones</td>
                      <td>Funcional</td>
                      <td>
                        <a
                          href="https://openai.com/policies/privacy-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          openai.com/policies/privacy-policy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Meta (Facebook)</strong>
                      </td>
                      <td>Pixel de seguimiento publicitario</td>
                      <td>Marketing</td>
                      <td>
                        <a
                          href="https://www.facebook.com/privacy/policy/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          facebook.com/privacy/policy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Google Ads</strong>
                      </td>
                      <td>Publicidad y remarketing</td>
                      <td>Marketing</td>
                      <td>
                        <a
                          href="https://policies.google.com/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          policies.google.com/privacy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>LinkedIn</strong>
                      </td>
                      <td>Seguimiento de conversiones publicitarias</td>
                      <td>Marketing</td>
                      <td>
                        <a
                          href="https://www.linkedin.com/legal/privacy-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          linkedin.com/legal/privacy-policy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Resend</strong>
                      </td>
                      <td>Envío de correos transaccionales</td>
                      <td>Esencial</td>
                      <td>
                        <a
                          href="https://resend.com/legal/privacy-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          resend.com/legal/privacy-policy
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                Las cookies de análisis de Vercel recopilan datos de forma
                anonimizada y no permiten la identificación personal de los
                usuarios. Los datos de análisis se conservan por un máximo de 13
                meses.
              </p>
            </div>
          </section>

          {/* How to control */}
          <section className="legal-section" id="rights">
            <span className="legal-section__number">Sección 09</span>
            <h2 className="legal-section__title">
              Sus Derechos y Cómo Controlar las Cookies
            </h2>
            <div className="legal-section__body">
              <p>
                Además de la configuración disponible en esta página, tiene las
                siguientes opciones para controlar las cookies:
              </p>

              <p>
                <strong>Configuración del navegador</strong>
              </p>
              <p>
                Puede configurar su navegador para bloquear o alertar sobre
                todas o algunas cookies. Tenga en cuenta que si bloquea las
                cookies esenciales, algunas partes de la plataforma pueden no
                funcionar correctamente:
              </p>
              <ul>
                <li>
                  <strong>Google Chrome:</strong> Ajustes → Privacidad y
                  seguridad → Cookies y otros datos de sitios
                </li>
                <li>
                  <strong>Mozilla Firefox:</strong> Opciones → Privacidad y
                  seguridad → Cookies y datos del sitio
                </li>
                <li>
                  <strong>Safari:</strong> Preferencias → Privacidad → Cookies y
                  datos del sitio
                </li>
                <li>
                  <strong>Microsoft Edge:</strong> Configuración → Cookies y
                  permisos del sitio
                </li>
              </ul>

              <p>
                <strong>Herramientas de opt-out de terceros</strong>
              </p>
              <ul>
                <li>
                  <strong>Google Analytics Opt-out:</strong>{" "}
                  <a
                    href="https://tools.google.com/dlpage/gaoptout"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    tools.google.com/dlpage/gaoptout
                  </a>
                </li>
                <li>
                  <strong>Network Advertising Initiative:</strong>{" "}
                  <a
                    href="https://optout.networkadvertising.org"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    optout.networkadvertising.org
                  </a>
                </li>
                <li>
                  <strong>Your Online Choices (UE):</strong>{" "}
                  <a
                    href="https://www.youronlinechoices.eu"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    youronlinechoices.eu
                  </a>
                </li>
                <li>
                  <strong>Digital Advertising Alliance (EE.UU.):</strong>{" "}
                  <a
                    href="https://optout.aboutads.info"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    optout.aboutads.info
                  </a>
                </li>
              </ul>

              <div className="legal-infocard legal-infocard--blue">
                <span className="legal-infocard__heading">
                  Derechos bajo el RGPD y la Ley 81 de Panamá
                </span>
                Tiene derecho a acceder, rectificar y suprimir los datos
                recabados mediante cookies, así como a retirar su consentimiento
                en cualquier momento, sin que ello afecte a la licitud del
                tratamiento basado en el consentimiento previo a su retirada.
                Para ejercer estos derechos, contacte con{" "}
                <a href="mailto:privacidad@seemanngroup.com">
                  privacidad@seemanngroup.com
                </a>
                .
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="legal-section" id="contact">
            <span className="legal-section__number">Sección 10</span>
            <h2 className="legal-section__title">
              Contacto sobre Cookies y Privacidad
            </h2>
            <div className="legal-section__body">
              <p>
                Para cualquier pregunta sobre nuestra Política de Cookies o el
                ejercicio de sus derechos en relación con las cookies y la
                privacidad:
              </p>
              <div className="legal-contact-card">
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Email de Privacidad
                  </span>
                  <span className="legal-contact-item__value">
                    <a href="mailto:privacidad@seemanngroup.com">
                      privacidad@seemanngroup.com
                    </a>
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Delegado de Protección (DPO)
                  </span>
                  <span className="legal-contact-item__value">
                    <a href="mailto:dpo@seemanngroup.com">
                      dpo@seemanngroup.com
                    </a>
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">Teléfono</span>
                  <span className="legal-contact-item__value">
                    +507 300-0000
                  </span>
                </div>
              </div>
            </div>
          </section>
        </article>
      </main>

      {/* Sticky action bar */}
      <div className="cookie-action-bar">
        <p className="cookie-action-bar__note">
          Sus preferencias se guardan en este navegador. Si utiliza otro
          dispositivo o borra las cookies, deberá volver a configurar sus
          preferencias.
        </p>
        <div className="cookie-action-bar__buttons">
          <button
            className="legal-btn legal-btn--ghost"
            onClick={handleRejectAll}
            type="button"
          >
            Solo esenciales
          </button>
          <button
            className="legal-btn legal-btn--secondary"
            onClick={handleSave}
            type="button"
          >
            Guardar selección
          </button>
          <button
            className="legal-btn legal-btn--primary"
            onClick={handleAcceptAll}
            type="button"
          >
            Aceptar todas
          </button>
        </div>
      </div>

      {/* Toast */}
      {saved && (
        <div className="legal-toast legal-toast--success">
          <CheckCircle size={16} />
          Preferencias de cookies guardadas
        </div>
      )}

      {/* Footer */}
      <footer className="legal-footer">
        <p>
          © {new Date().getFullYear()} Seemann Group S.A. · Todos los derechos
          reservados · <Link to="/privacy-policy">Política de Privacidad</Link>{" "}
          · <Link to="/terms-of-service">Términos de Servicio</Link>
        </p>
      </footer>
    </div>
  );
}

export default CookiesSettings;
