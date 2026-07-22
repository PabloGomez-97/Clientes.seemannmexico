// src/layouts/Navbar.tsx — Chrome del portal de clientes (Enterprise Dark, idéntico a Chile)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { imgUrl } from "../config/images";
import PortalNotificationBell from "../components/notifications/PortalNotificationBell";

/* Paleta oscura para la campana de notificaciones (prop compartida) */
const bellColors = {
  bg: "#232f3e",
  bgHover: "#2d3a4a",
  text: "#ffffff",
  textMuted: "#8d99a8",
  border: "#3b4754",
  accent: "#ff6200",
};

interface NavbarProps {
  onLogout: () => void;
  toggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  isMobile?: boolean;
}

function Navbar({
  onLogout,
  toggleSidebar,
  isSidebarCollapsed,
  isMobile = false,
}: NavbarProps) {
  const { user, logout, activeUsername } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showProfile, setShowProfile] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark-mode");
    } else {
      root.classList.remove("dark-mode");
    }
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  // User data
  const username = activeUsername || user?.username || "Usuarios";
  const email = user?.email || "usuario@ejemplo.com";
  const ejecutivo = user?.ejecutivo;
  const hasEjecutivo = !!ejecutivo;
  const isExecutivePortal = user?.username === "Ejecutivo";

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = getInitials(username);

  const getEjecutivoImage = (nombre?: string) => {
    if (!nombre) return null;

    const partes = nombre.trim().split(" ");
    if (partes.length < 2) return null;

    const iniciales = partes[0][0].toLowerCase() + partes[1][0].toLowerCase();

    return imgUrl(`/ejecutivos/${iniciales}.png`);
  };

  const ejecutivoImage = getEjecutivoImage(ejecutivo?.nombre);

  const currentLang = (i18n.resolvedLanguage || i18n.language || "es")
    .toLowerCase()
    .startsWith("es")
    ? "es"
    : "en";

  const handleLogout = () => {
    logout();
    if (onLogout) onLogout();
    setShowProfile(false);
  };

  // Escape cierra los dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowProfile(false);
        setShowLanguage(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cierre al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".profile-dropdown") &&
        !target.closest(".profile-button")
      ) {
        setShowProfile(false);
      }
      if (
        !target.closest(".language-dropdown") &&
        !target.closest(".language-button")
      ) {
        setShowLanguage(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      className={["cnav-root", isMobile ? "cnav-root--mobile" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {isMobile && (
        <button
          type="button"
          className="cnav-burger"
          onClick={toggleSidebar}
          aria-label={
            isSidebarCollapsed
              ? t("home.navbar.openMenu")
              : t("home.navbar.closeMenu")
          }
          title={
            isSidebarCollapsed
              ? t("home.navbar.openMenu")
              : t("home.navbar.closeMenu")
          }
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M2.5 4h11M2.5 8h11M2.5 12h11"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      <div className="cnav-actions">
        {/* Modo oscuro */}
        <button
          type="button"
          className="cnav-iconbtn"
          onClick={() => setDarkMode((prev) => !prev)}
          aria-label={
            darkMode
              ? t("home.navbar.darkModeOff", { defaultValue: "Desactivar modo oscuro" })
              : t("home.navbar.darkModeOn", { defaultValue: "Activar modo oscuro" })
          }
          title={
            darkMode
              ? t("home.navbar.lightMode", { defaultValue: "Modo claro" })
              : t("home.navbar.darkMode", { defaultValue: "Modo oscuro" })
          }
        >
          {darkMode ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Notificaciones */}
        <PortalNotificationBell enabled navbarColors={bellColors} />

        {/* Idioma */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className={[
              "language-button cnav-lang",
              showLanguage ? "cnav-lang--open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setShowLanguage(!showLanguage)}
            aria-expanded={showLanguage}
          >
            <span>{currentLang.toUpperCase()}</span>
            <svg
              width="12"
              height="12"
              fill="currentColor"
              viewBox="0 0 16 16"
              style={{
                transform: showLanguage ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </button>

          {showLanguage && (
            <div className="language-dropdown cnav-dropdown cnav-dropdown--lang">
              <button
                type="button"
                className={[
                  "cnav-lang-option",
                  currentLang === "es" ? "cnav-lang-option--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  i18n.changeLanguage("es");
                  setShowLanguage(false);
                }}
              >
                Español
              </button>
              <button
                type="button"
                className={[
                  "cnav-lang-option",
                  currentLang === "en" ? "cnav-lang-option--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  i18n.changeLanguage("en");
                  setShowLanguage(false);
                }}
              >
                English
              </button>
            </div>
          )}
        </div>

        {/* Perfil */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className={[
              "profile-button cnav-profile-trigger",
              showProfile ? "cnav-profile-trigger--open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setShowProfile(!showProfile)}
            aria-expanded={showProfile}
          >
            <div className="cnav-avatar">{initials}</div>
            <span className="cnav-username">{username}</span>
            <svg
              width="12"
              height="12"
              fill="#8d99a8"
              viewBox="0 0 16 16"
              style={{
                transition: "transform 0.15s ease",
                transform: showProfile ? "rotate(180deg)" : "rotate(0deg)",
              }}
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </button>

          {showProfile && (
            <div className="profile-dropdown cnav-dropdown cnav-dropdown--profile">
              {/* Cabecera usuario */}
              <div className="cnav-profile-head">
                <div className="cnav-avatar">{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cnav-profile-name">{username}</div>
                  <div className="cnav-profile-email">{email}</div>
                </div>
              </div>

              {/* Ejecutivo asignado (información completa) */}
              {hasEjecutivo && ejecutivo && (
                <div className="cnav-exec">
                  <div className="cnav-exec__kicker">
                    {t("home.navbar.profile.assignedExecutive")}
                  </div>

                  <div className="cnav-exec__person">
                    <div className="cnav-exec__photo">
                      {ejecutivoImage ? (
                        <img
                          src={ejecutivoImage}
                          alt={ejecutivo.nombre}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <svg
                          width="22"
                          height="22"
                          fill="#ffffff"
                          viewBox="0 0 16 16"
                          aria-hidden
                        >
                          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z" />
                        </svg>
                      )}
                      <span className="cnav-exec__online" aria-hidden></span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cnav-exec__name">{ejecutivo.nombre}</div>
                      <div className="cnav-exec__role">
                        {t("home.navbar.profile.commercialExecutive")}
                      </div>
                    </div>
                  </div>

                  <div className="cnav-exec__contact">
                    <a
                      href={`mailto:${ejecutivo.email}`}
                      className="cnav-exec__link"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                        <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z" />
                      </svg>
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ejecutivo.email}
                      </span>
                    </a>

                    {ejecutivo.telefono ? (
                      <a
                        href={`tel:${ejecutivo.telefono.replace(/\s/g, "")}`}
                        className="cnav-exec__link"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"
                          />
                        </svg>
                        <span style={{ flex: 1 }}>{ejecutivo.telefono}</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Configuración */}
              {!isExecutivePortal && (
                <div className="cnav-profile-section">
                  <button
                    type="button"
                    className="cnav-settings-btn"
                    onClick={() => {
                      setShowProfile(false);
                      navigate("/settings");
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M9.392 1.523a1.5 1.5 0 0 0-2.784 0l-.18.44a1.5 1.5 0 0 1-1.083.874l-.472.102a1.5 1.5 0 0 0-.79 2.482l.32.335c.31.326.432.789.327 1.228l-.11.463a1.5 1.5 0 0 0 2.07 1.729l.43-.193a1.5 1.5 0 0 1 1.23 0l.43.193a1.5 1.5 0 0 0 2.07-1.73l-.11-.462a1.5 1.5 0 0 1 .327-1.228l.32-.335a1.5 1.5 0 0 0-.79-2.482l-.472-.102a1.5 1.5 0 0 1-1.083-.875l-.18-.439ZM8 10.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z"
                        stroke="#6b7280"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div style={{ flex: 1 }}>
                      <div className="cnav-settings-btn__title">
                        {t("home.navbar.profile.settingsTitle", {
                          defaultValue: "Configuraciones",
                        })}
                      </div>
                      <div className="cnav-settings-btn__desc">
                        {t("home.navbar.profile.settingsDesc", {
                          defaultValue:
                            "Administra correos predeterminados para tracking",
                        })}
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Cerrar sesión */}
              <div className="cnav-logout-wrap">
                <button
                  type="button"
                  className="cnav-logout"
                  onClick={handleLogout}
                >
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"
                    />
                    <path
                      fillRule="evenodd"
                      d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"
                    />
                  </svg>
                  {t("home.navbar.profile.logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
