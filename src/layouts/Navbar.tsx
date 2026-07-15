// src/layouts/Navbar.tsx - AWS/Azure Minimalist Design
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { imgUrl } from "../config/images";
import PortalNotificationBell from "../components/notifications/PortalNotificationBell";
import SidebarToggleButton from "./SidebarToggleButton";

// Design tokens - Enterprise Dark + Brand
const colors = {
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
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
  const [notifications] = useState([
    {
      id: 1,
      title: t("home.navbar.notifications.newQuote"),
      message: t("home.navbar.notifications.quoteCreated"),
      time: "5 min",
      unread: true,
      type: "info",
    },
    {
      id: 2,
      title: t("home.navbar.notifications.shipmentUpdated"),
      message: t("home.navbar.notifications.airShipmentTransit"),
      time: "15 min",
      unread: true,
      type: "success",
    },
    {
      id: 3,
      title: t("home.navbar.notifications.pendingDocument"),
      message: t("home.navbar.notifications.invoiceReview"),
      time: "1 hora",
      unread: false,
      type: "warning",
    },
  ]);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const handleLogout = () => {
    logout();
    if (onLogout) onLogout();
    setShowProfile(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowNotifications(false);
        setShowProfile(false);
        setShowLanguage(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".notification-dropdown") &&
        !target.closest(".notification-button")
      ) {
        setShowNotifications(false);
      }
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

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <>
      <nav
        className="main-navbar main-navbar-shell"
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
          backdropFilter: "blur(14px)",
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {isMobile && (
          <SidebarToggleButton
            isCollapsed={isSidebarCollapsed}
            onClick={toggleSidebar}
            ariaLabel={
              isSidebarCollapsed
                ? t("home.navbar.openMenu")
                : t("home.navbar.closeMenu")
            }
            title={
              isSidebarCollapsed
                ? t("home.navbar.openMenu")
                : t("home.navbar.closeMenu")
            }
          />
        )}

        {/* Right Section - Actions */}
        <div
          className="main-navbar-actions"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >

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

          {/* Portal Notifications Bell */}
          <PortalNotificationBell enabled navbarColors={colors} />

          {/* Language Selector */}
          <div
            className="main-navbar-language"
            style={{ position: "relative" }}
          >
            <button
              className="language-button navbar-language-trigger"
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
                if (!showLanguage) {
                  e.currentTarget.style.backgroundColor = colors.bgHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!showLanguage) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
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
                className="language-dropdown"
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
                <button
                  onClick={() => {
                    i18n.changeLanguage("es");
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
                  Español
                </button>
                <button
                  onClick={() => {
                    i18n.changeLanguage("en");
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
                  English
                </button>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="main-navbar-profile" style={{ position: "relative" }}>
            <button
              className="profile-button navbar-profile-trigger"
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
                if (!showProfile) {
                  e.currentTarget.style.backgroundColor = colors.bgHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!showProfile) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
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
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <span
                className="navbar-user-name"
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
                className="profile-dropdown navbar-profile-dropdown"
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
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
                      }}
                    >
                      {initials}
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

                {/* Ejecutivo Section */}
                {hasEjecutivo && ejecutivo && (
                  <div
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "12px",
                      }}
                    >
                      {t("home.navbar.profile.assignedExecutive")}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          backgroundColor: colors.accent,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {ejecutivoImage ? (
                          <img
                            src={ejecutivoImage}
                            alt={ejecutivo.nombre}
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
                          <svg
                            width="22"
                            height="22"
                            fill="#ffffff"
                            viewBox="0 0 16 16"
                          >
                            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z" />
                          </svg>
                        )}
                        {/* Online indicator */}
                        <span
                          style={{
                            position: "absolute",
                            bottom: "2px",
                            right: "2px",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: "#4ade80",
                            border: "2px solid #ffffff",
                          }}
                        ></span>
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
                          {ejecutivo.nombre}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                          }}
                        >
                          {t("home.navbar.profile.commercialExecutive")}
                        </div>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <a
                        href={`mailto:${ejecutivo.email}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          backgroundColor: "#f9fafb",
                          borderRadius: "4px",
                          textDecoration: "none",
                          transition: "background-color 0.15s ease",
                          border: "1px solid #e5e7eb",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f3f4f6";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f9fafb";
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="#6b7280"
                          viewBox="0 0 16 16"
                        >
                          <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z" />
                        </svg>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#374151",
                            flex: 1,
                          }}
                        >
                          {ejecutivo.email}
                        </span>
                      </a>

                      <a
                        href={`tel:${ejecutivo.telefono}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          backgroundColor: "#f9fafb",
                          borderRadius: "4px",
                          textDecoration: "none",
                          transition: "background-color 0.15s ease",
                          border: "1px solid #e5e7eb",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f3f4f6";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f9fafb";
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="#6b7280"
                          viewBox="0 0 16 16"
                        >
                          <path
                            fillRule="evenodd"
                            d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"
                          />
                        </svg>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#374151",
                            flex: 1,
                          }}
                        >
                          {ejecutivo.telefono}
                        </span>
                      </a>
                    </div>
                  </div>
                )}

                {!isExecutivePortal && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfile(false);
                        navigate("/settings");
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "12px 14px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#ffffff",
                        color: "#1f2937",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M9.392 1.523a1.5 1.5 0 0 0-2.784 0l-.18.44a1.5 1.5 0 0 1-1.083.874l-.472.102a1.5 1.5 0 0 0-.79 2.482l.32.335c.31.326.432.789.327 1.228l-.11.463a1.5 1.5 0 0 0 2.07 1.729l.43-.193a1.5 1.5 0 0 1 1.23 0l.43.193a1.5 1.5 0 0 0 2.07-1.73l-.11-.462a1.5 1.5 0 0 1 .327-1.228l.32-.335a1.5 1.5 0 0 0-.79-2.482l-.472-.102a1.5 1.5 0 0 1-1.083-.875l-.18-.439ZM8 10.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z"
                          stroke="#6b7280"
                          strokeWidth="1.2"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#111827",
                            marginBottom: "2px",
                          }}
                        >
                          Configuraciones
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                          Administra correos predeterminados para tracking
                        </div>
                      </div>
                    </button>
                  </div>
                )}

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
      </nav>

      {/* Command Palette / Search Modal */}
      {showSearch && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.5)",
              zIndex: 9998,
            }}
            onClick={() => setShowSearch(false)}
          ></div>

          <div
            style={{
              position: "fixed",
              top: "100px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "90%",
              maxWidth: "560px",
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
              border: "1px solid #e5e7eb",
              zIndex: 9999,
              overflow: "hidden",
              fontFamily:
                '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <svg width="18" height="18" fill="#6b7280" viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t("home.navbar.search.placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: "14px",
                  color: "#1f2937",
                  background: "transparent",
                }}
              />
              <kbd
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  backgroundColor: "#f3f4f6",
                  color: "#6b7280",
                  border: "1px solid #e5e7eb",
                  fontFamily: "monospace",
                }}
              >
                ESC
              </kbd>
            </div>

            <div
              style={{
                padding: "12px",
                maxHeight: "350px",
                overflowY: "auto",
              }}
            >
              {searchQuery === "" ? (
                <div style={{ padding: "24px", textAlign: "center" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      margin: "0 auto 12px",
                      borderRadius: "8px",
                      backgroundColor: "#f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      fill="#6b7280"
                      viewBox="0 0 16 16"
                    >
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                    </svg>
                  </div>
                  <h3
                    style={{
                      margin: "0 0 6px 0",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#1f2937",
                    }}
                  >
                    {t("home.navbar.search.title")}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    {t("home.navbar.search.description")}
                  </p>

                  <div
                    style={{
                      marginTop: "20px",
                      display: "grid",
                      gap: "6px",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: "600",
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "4px",
                      }}
                    >
                      {t("home.navbar.search.quickAccess")}
                    </div>
                    {[
                      {
                        icon: "📝",
                        label: t("home.navbar.search.newQuote"),
                        key: "N",
                      },
                      {
                        icon: "✈️",
                        label: t("home.navbar.search.airShipments"),
                        key: "A",
                      },
                      {
                        icon: "🚢",
                        label: t("home.navbar.search.oceanShipments"),
                        key: "O",
                      },
                      {
                        icon: "📊",
                        label: t("home.navbar.search.reports"),
                        key: "R",
                      },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          backgroundColor: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          transition: "background-color 0.15s ease",
                          fontSize: "13px",
                          color: "#374151",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f9fafb";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#ffffff";
                        }}
                      >
                        <span style={{ fontSize: "16px" }}>{item.icon}</span>
                        <span
                          style={{
                            flex: 1,
                            textAlign: "left",
                            fontWeight: "500",
                          }}
                        >
                          {item.label}
                        </span>
                        <kbd
                          style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            backgroundColor: "#f3f4f6",
                            color: "#6b7280",
                            border: "1px solid #e5e7eb",
                            fontFamily: "monospace",
                          }}
                        >
                          {item.key}
                        </kbd>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "8px" }}>
                  <div
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      color: "#6b7280",
                      fontSize: "13px",
                    }}
                  >
                    {t("home.navbar.search.searching")} "{searchQuery}"...
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        @keyframes aiChatPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(162, 45, 125, 0.45), inset 0 1px 0 rgba(255,255,255,0.06); }
          50%       { box-shadow: 0 0 18px rgba(162, 45, 125, 0.75), 0 0 0 3px rgba(162, 45, 125, 0.18), inset 0 1px 0 rgba(255,255,255,0.06); }
        }

        .ai-chat-glow-btn {
          animation: aiChatPulse 2.8s ease-in-out infinite;
        }

        .ai-chat-glow-btn:hover {
          animation: none;
        }

        .main-navbar-shell {
          box-shadow: 0 1px 0 #e4e7ec;
        }
        
        /* Responsive: Tablets */
        @media (max-width: 1024px) {
          .main-navbar {
            height: 60px !important;
            min-height: 60px !important;
            max-height: 60px !important;
            padding: 0 16px !important;
          }

          .navbar-profile-dropdown {
            width: min(320px, calc(100vw - 32px)) !important;
          }
        }
        
        /* Responsive: Mobile */
        @media (max-width: 768px) {
          .main-navbar {
            height: 65px !important;
            min-height: 65px !important;
            max-height: 65px !important;
            padding: 0 12px !important;
            gap: 8px !important;
          }

          .main-navbar-actions {
            gap: 6px !important;
          }

          .navbar-language-trigger,
          .navbar-profile-trigger {
            height: 40px !important;
            border-radius: 10px !important;
          }

          .navbar-profile-trigger {
            padding: 0 8px !important;
          }

          .navbar-user-name,
          .navbar-profile-trigger svg:last-child {
            display: none !important;
          }

          .navbar-language-trigger span {
            font-size: 12px;
          }

          .language-dropdown,
          .navbar-profile-dropdown {
            right: 0 !important;
            width: min(320px, calc(100vw - 24px)) !important;
          }

          .navbar-profile-dropdown {
            max-height: min(78vh, 560px);
            overflow-y: auto !important;
          }
        }

        @media (max-width: 480px) {
          .main-navbar {
            padding: 0 10px !important;
          }

          .main-navbar-actions {
            gap: 4px !important;
          }

          .navbar-language-trigger {
            padding: 0 10px !important;
          }

          .navbar-profile-trigger {
            min-width: 42px;
          }
        }
      `}</style>
    </>
  );
}

export default Navbar;
