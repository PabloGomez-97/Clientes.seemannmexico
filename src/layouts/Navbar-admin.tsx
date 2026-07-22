// src/layouts/Navbar-admin.tsx — Chrome Enterprise Dark (admin), idéntico a Chile
import { useState, useEffect } from "react";
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

interface NavbarAdminProps {
  onLogout: () => void;
  toggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  isMobile?: boolean;
}

function NavbarAdmin({
  onLogout,
  toggleSidebar,
  isSidebarCollapsed,
  isMobile = false,
}: NavbarAdminProps) {
  const { user, logout } = useAuth();
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
  const username = user?.nombreuser || user?.username || "Ejecutivo";
  const email = user?.email || "admin@sphereglobal.io";

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  const initials = getInitials(username);

  const getUserImage = (nombre?: string) => {
    if (!nombre) return null;
    const partes = nombre.trim().split(" ");
    if (partes.length < 2) return null;
    return imgUrl(
      `/ejecutivos/${partes[0][0].toLowerCase()}${partes[1][0].toLowerCase()}.png`,
    );
  };
  const userImage = getUserImage(user?.nombreuser);

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
        !target.closest(".admin-profile-dropdown") &&
        !target.closest(".admin-profile-button")
      ) {
        setShowProfile(false);
      }
      if (
        !target.closest(".admin-language-dropdown") &&
        !target.closest(".admin-language-button")
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

        {/* Notificaciones (ejecutivo + operaciones) */}
        <PortalNotificationBell
          enabled={!!user?.roles?.ejecutivo || !!user?.roles?.operaciones}
          navbarColors={bellColors}
        />

        {/* Idioma */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className={[
              "admin-language-button cnav-lang",
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
            <div className="admin-language-dropdown cnav-dropdown cnav-dropdown--lang">
              {[
                { code: "es", label: "Español" },
                { code: "en", label: "English" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={[
                    "cnav-lang-option",
                    currentLang === lang.code ? "cnav-lang-option--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    i18n.changeLanguage(lang.code);
                    setShowLanguage(false);
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Perfil */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className={[
              "admin-profile-button cnav-profile-trigger",
              showProfile ? "cnav-profile-trigger--open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setShowProfile(!showProfile)}
            aria-expanded={showProfile}
          >
            <div className="cnav-avatar">
              {userImage ? (
                <img
                  src={userImage}
                  alt={username}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                initials
              )}
            </div>
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
            <div className="admin-profile-dropdown cnav-dropdown cnav-dropdown--profile">
              {/* Cabecera usuario */}
              <div className="cnav-profile-head">
                <div className="cnav-avatar">
                  {userImage ? (
                    <img
                      src={userImage}
                      alt={username}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cnav-profile-name">{username}</div>
                  <div className="cnav-profile-email">{email}</div>
                </div>
              </div>

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

export default NavbarAdmin;
