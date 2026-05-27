// src/layouts/Navbar-admin.tsx - AWS/Azure Minimalist Design (same as client)
import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { imgUrl } from "../config/images";
import PortalNotificationBell from "../components/notifications/PortalNotificationBell";
import { useChatbotContext } from "../contexts/ChatbotContext";
import SidebarToggleButton from "./SidebarToggleButton";

// Design tokens - Enterprise Dark + Brand (same as client Navbar)
const colors = {
  bg: "#232f3e",
  bgHover: "#2d3a4a",
  text: "#ffffff",
  textMuted: "#8d99a8",
  border: "#3b4754",
  accent: "#ff6200",
};

interface NavbarAdminProps {
  accessToken: string;
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
  const { toggleChat } = useChatbotContext();
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

  const handleLogout = () => {
    logout();
    if (onLogout) onLogout();
    setShowProfile(false);
  };

  // Keyboard shortcut: Escape
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

  // Close dropdowns on outside click
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
      className="main-navbar-admin"
      style={{
        height: "70px",
        minHeight: "70px",
        maxHeight: "70px",
        flexShrink: 0,
        backgroundColor: colors.bg,
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: isMobile ? "space-between" : "flex-end",
        padding: "0 20px",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        fontFamily:
          '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {isMobile && (
        <SidebarToggleButton
          isCollapsed={isSidebarCollapsed}
          onClick={toggleSidebar}
          ariaLabel={isSidebarCollapsed ? "Abrir menú" : "Cerrar menú"}
          title={isSidebarCollapsed ? "Abrir menú" : "Cerrar menú"}
        />
      )}

      {/* Right Section - Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* AI Chat Button */}
        <button
          type="button"
          onClick={toggleChat}
          aria-label="Abrir AI Chat"
          title="AI Chat"
          className="ai-chat-glow-btn-admin"
          style={{
            background:
              "linear-gradient(260deg, rgba(66, 133, 244, 0.22) 8.57%, rgba(231, 10, 62, 0.22) 101.84%)",
            border: "1.5px solid rgba(162, 45, 125, 1)",
            borderRadius: "4px",
            padding: "8px 12px",
            display: "inline-flex",
            alignItems: "center",
            cursor: "pointer",
            flexShrink: 0,
            boxShadow:
              "0 0 10px rgba(162, 45, 125, 0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
            transition: "box-shadow 0.2s ease, background 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 18px rgba(162, 45, 125, 0.75), 0 0 0 3px rgba(162, 45, 125, 0.25), inset 0 1px 0 rgba(255,255,255,0.06)";
            e.currentTarget.style.background =
              "linear-gradient(260deg, rgba(66, 133, 244, 0.32) 8.57%, rgba(231, 10, 62, 0.32) 101.84%)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 10px rgba(162, 45, 125, 0.45), inset 0 1px 0 rgba(255,255,255,0.06)";
            e.currentTarget.style.background =
              "linear-gradient(260deg, rgba(66, 133, 244, 0.22) 8.57%, rgba(231, 10, 62, 0.22) 101.84%)";
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="aiAdminIconGrad"
                x1="0%"
                y1="100%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#E70A3E" />
                <stop offset="100%" stopColor="#1C6EF2" />
              </linearGradient>
            </defs>
            <path
              d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
              fill="url(#aiAdminIconGrad)"
            />
            <path
              d="M19 16L19.75 18.25L22 19L19.75 19.75L19 22L18.25 19.75L16 19L18.25 18.25L19 16Z"
              fill="url(#aiAdminIconGrad)"
            />
            <path
              d="M5 4L5.5 5.5L7 6L5.5 6.5L5 8L4.5 6.5L3 6L4.5 5.5L5 4Z"
              fill="url(#aiAdminIconGrad)"
            />
          </svg>
          <span
            style={{
              marginLeft: "6px",
              background: "linear-gradient(223deg, #1C6EF2 0%, #E70A3E 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 600,
              fontSize: "0.875rem",
              lineHeight: 1.3,
              whiteSpace: "nowrap",
            }}
          >
            AI Chat
          </span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={() => setDarkMode((prev) => !prev)}
          aria-label={
            darkMode ? "Desactivar modo oscuro" : "Activar modo oscuro"
          }
          title={darkMode ? "Modo claro" : "Modo oscuro"}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "4px",
            border: `1px solid ${colors.border}`,
            backgroundColor: "transparent",
            color: colors.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.bgHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {darkMode ? (
            // Sun icon
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
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
            // Moon icon
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Portal Notifications Bell (ejecutivo + operaciones) */}
        <PortalNotificationBell
          enabled={!!user?.roles?.ejecutivo || !!user?.roles?.operaciones}
          navbarColors={colors}
        />

        {/* Language Selector */}
        <div style={{ position: "relative" }}>
          <button
            className="admin-language-button"
            onClick={() => setShowLanguage(!showLanguage)}
            style={{
              height: "36px",
              padding: "0 12px",
              borderRadius: "4px",
              border: `1px solid ${colors.border}`,
              backgroundColor: showLanguage ? colors.bgHover : "transparent",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: colors.text,
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!showLanguage)
                e.currentTarget.style.backgroundColor = colors.bgHover;
            }}
            onMouseLeave={(e) => {
              if (!showLanguage)
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span>{i18n.language === "es" ? "ES" : "EN"}</span>
            <svg
              width="12"
              height="12"
              fill="currentColor"
              viewBox="0 0 16 16"
              style={{
                transform: showLanguage ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            >
              <path
                fillRule="evenodd"
                d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </button>

          {showLanguage && (
            <div
              className="admin-language-dropdown"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "120px",
                backgroundColor: "#ffffff",
                borderRadius: "6px",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.15)",
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                zIndex: 1000,
              }}
            >
              {[
                { code: "es", label: "Español" },
                { code: "en", label: "English" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    i18n.changeLanguage(lang.code);
                    setShowLanguage(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "none",
                    backgroundColor: "transparent",
                    textAlign: "left",
                    color: "#374151",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f3f4f6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div style={{ position: "relative" }}>
          <button
            className="admin-profile-button"
            onClick={() => setShowProfile(!showProfile)}
            style={{
              height: "36px",
              padding: "0 12px",
              borderRadius: "4px",
              border: `1px solid ${colors.border}`,
              backgroundColor: showProfile ? colors.bgHover : "transparent",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!showProfile)
                e.currentTarget.style.backgroundColor = colors.bgHover;
            }}
            onMouseLeave={(e) => {
              if (!showProfile)
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: colors.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "700",
                overflow: "hidden",
              }}
            >
              {userImage ? (
                <img
                  src={userImage}
                  alt={username}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                initials
              )}
            </div>
            <span
              style={{
                fontSize: "13px",
                fontWeight: "500",
                color: colors.text,
              }}
            >
              {username}
            </span>
            <svg
              width="12"
              height="12"
              fill={colors.textMuted}
              viewBox="0 0 16 16"
              style={{
                transition: "transform 0.15s ease",
                transform: showProfile ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <path
                fillRule="evenodd"
                d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </button>

          {/* Profile Dropdown */}
          {showProfile && (
            <div
              className="admin-profile-dropdown"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "320px",
                backgroundColor: "#ffffff",
                borderRadius: "6px",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.15)",
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                zIndex: 1000,
                fontFamily:
                  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {/* User info header */}
              <div
                style={{
                  padding: "16px",
                  borderBottom: "1px solid #e5e7eb",
                  backgroundColor: "#f9fafb",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "50%",
                      backgroundColor: colors.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: "16px",
                      fontWeight: "700",
                      overflow: "hidden",
                    }}
                  >
                    {userImage ? (
                      <img
                        src={userImage}
                        alt={username}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#1f2937",
                        marginBottom: "2px",
                      }}
                    >
                      {username}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <div style={{ padding: "12px 16px" }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    backgroundColor: "#ffffff",
                    color: "#dc2626",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fef2f2";
                    e.currentTarget.style.borderColor = "#fecaca";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        @keyframes aiChatPulseAdmin {
          0%, 100% { box-shadow: 0 0 10px rgba(162, 45, 125, 0.45), inset 0 1px 0 rgba(255,255,255,0.06); }
          50%       { box-shadow: 0 0 18px rgba(162, 45, 125, 0.75), 0 0 0 3px rgba(162, 45, 125, 0.18), inset 0 1px 0 rgba(255,255,255,0.06); }
        }

        .ai-chat-glow-btn-admin {
          animation: aiChatPulseAdmin 2.8s ease-in-out infinite;
        }

        .ai-chat-glow-btn-admin:hover {
          animation: none;
        }

        .main-navbar-admin {
          box-shadow: 0 1px 0 #e4e7ec;
        }
        
        /* Responsive: Tablets */
        @media (max-width: 1024px) {
          .main-navbar-admin {
            box-shadow: 0 1px 0 #e4e7ec;
            height: 60px !important;
            min-height: 60px !important;
            max-height: 60px !important;
            padding: 0 16px !important;
          }
        }
        
        /* Responsive: Mobile */
        @media (max-width: 768px) {
          .main-navbar-admin {
            height: 65px !important;
            min-height: 65px !important;
            max-height: 65px !important;
            padding: 0 12px !important;
          }
        }
      `}</style>
    </nav>
  );
}

export default NavbarAdmin;
