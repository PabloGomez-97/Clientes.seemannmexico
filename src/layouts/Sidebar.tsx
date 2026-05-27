// src/layouts/Sidebar.tsx - AWS/Azure Minimalist Design
import { useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import logoSeemann from "./logoseemann.png";
import { handleSidebarNavigation } from "./sidebarNavigation";
import { imgUrl } from "../config/images";

interface SidebarProps {
  isCollapsed: boolean;
  isMobile: boolean;
  onCloseMobile: () => void;
  onToggle: () => void;
}

interface SubMenuItem {
  path: string;
  name: string;
}

interface MenuItem {
  path?: string;
  name: string;
  icon: string;
  badge?: {
    text: string;
    type: "new" | "beta" | "trial" | "try";
  };
  subItems?: SubMenuItem[];
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
}

// Design tokens - Enterprise Dark + Brand
const colors = {
  bg: "#232f3e",
  bgHover: "#2d3a4a",
  bgActive: "rgba(255, 98, 0, 0.14)",
  text: "#ffffff",
  textMuted: "#8d99a8",
  border: "#3b4754",
  accent: "#ff6200",
};

function Sidebar({
  isCollapsed,
  isMobile,
  onCloseMobile,
  onToggle,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, activeUsername, setActiveUsername } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["Reports"]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Determinar si se muestra el selector de cuenta
  const usernames = user?.usernames || [];
  const showAccountSelector = usernames.length > 1;

  const menuSections: MenuSection[] = [
    {
      items: [{ path: "/", name: t("home.sidebar.home"), icon: "fa fa-home" }],
    },
    {
      items: [
        {
          name: t("home.sidebar.quote"),
          icon: "fa fa-calculator",
          subItems: [
            { path: "/newquotes", name: t("home.sidebar.newQuote") },
            {
              path: "/cotizacion-especial",
              name: t("home.sidebar.specialQuote"),
            },
            { path: "/quotes", name: t("home.sidebar.quotes") },
          ],
        },
      ],
    },
    {
      items: [
        {
          name: t("home.sidebar.operations"),
          icon: "fa fa-folder-open",
          subItems: [
            {
              path: "/air-shipments",
              name: t("home.sidebar.airOperations"),
            },
            {
              path: "/ocean-shipments",
              name: t("home.sidebar.oceanOperations"),
            },
            {
              path: "/ground-shipments",
              name: t("home.sidebar.groundOperations"),
            },
          ],
        },
      ],
    },
    {
      items: [
        {
          path: "/mis-documentos",
          name: "Mis Documentos",
          icon: "fa fa-file",
        },
      ],
    },
    {
      items: [
        {
          name: t("home.sidebar.track"),
          icon: "fa fa-route",
          subItems: [
            {
              path: "/new-tracking",
              name: t("home.sidebar.trackNewShipment"),
            },
            {
              path: "/new-ocean-tracking",
              name: t("home.sidebar.trackNewOceanShipment"),
            },
            { path: "/trackings", name: t("home.sidebar.myShipments") },
          ],
        },
      ],
    },
    {
      items: [
        {
          name: t("home.sidebar.reporting"),
          icon: "fa fa-chart-bar",
          subItems: [
            { path: "/financiera", name: t("home.sidebar.financial") },
            { path: "/operacional", name: t("home.sidebar.operational") },
          ],
        },
      ],
    },
    {
      items: [
        {
          path: "/novedades",
          name: t("home.sidebar.novedades"),
          icon: "fa fa-newspaper",
        },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const sidebarWidth = isMobile
    ? "min(86vw, 320px)"
    : isCollapsed
      ? "84px"
      : "260px";

  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuName)
        ? prev.filter((m) => m !== menuName)
        : [...prev, menuName],
    );
  };

  const navigateFromSidebar = (
    event: MouseEvent<HTMLAnchorElement>,
    targetPath: string,
  ) => {
    handleSidebarNavigation({
      event,
      navigate,
      currentPathname: location.pathname,
      targetPath,
      onAfterNavigate: isMobile ? onCloseMobile : undefined,
    });
  };

  return (
    <>
      {isMobile && !isCollapsed && (
        <div
          onClick={onCloseMobile}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            zIndex: 1090,
          }}
        />
      )}

      <div
        className="sidebar-scroll sidebar-shell"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          height: "100vh",
          backgroundColor: colors.bg,
          display: "flex",
          flexDirection: "column",
          position: isMobile ? "fixed" : "sticky",
          top: 0,
          left: 0,
          borderRight: `1px solid ${colors.border}`,
          overflowY: "auto",
          overflowX: "hidden",
          fontFamily:
            "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          transition:
            "width 0.22s ease, min-width 0.22s ease, transform 0.22s ease",
          transform: isMobile
            ? isCollapsed
              ? "translateX(-100%)"
              : "translateX(0)"
            : "translateX(0)",
          boxShadow:
            isMobile && !isCollapsed ? "4px 0 20px rgba(0, 0, 0, 0.3)" : "none",
          zIndex: isMobile ? 1100 : 20,
          pointerEvents: isMobile && isCollapsed ? "none" : "auto",
        }}
      >
        <div
          className="sidebar-header"
          style={{
            height: isMobile ? "65px" : "70px",
            padding: isCollapsed && !isMobile ? "0 12px" : "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed && !isMobile ? "center" : "flex-start",
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        >
          {isCollapsed && !isMobile ? (
            <img
              src={imgUrl("/logo.png")}
              alt="Seemann"
              style={{
                width: "40px",
                height: "40px",
                objectFit: "contain",
                borderRadius: "8px",
                backgroundColor: colors.bgActive,
                padding: "4px",
              }}
            />
          ) : (
            <img
              src={logoSeemann}
              alt="Seemann Group"
              className="sidebar-logo"
              style={{
                width: isMobile ? "160px" : "180px",
                height: "auto",
                objectFit: "contain",
              }}
            />
          )}
        </div>

        {showAccountSelector && !isCollapsed && (
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: "600",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: "6px",
              }}
            >
              {t("sidebar.account")}
            </label>
            <select
              value={activeUsername}
              onChange={(e) => {
                setActiveUsername(e.target.value);
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (
                    key &&
                    (key.startsWith("quotesCache_") ||
                      key.startsWith("airShipmentsCache_") ||
                      key.startsWith("oceanShipmentsCache_") ||
                      key.startsWith("invoicesCache_") ||
                      key.startsWith("shipmentsCache_"))
                  ) {
                    keysToRemove.push(key);
                  }
                }
                keysToRemove.forEach((key) => localStorage.removeItem(key));
                window.location.reload();
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: "13px",
                fontWeight: "500",
                backgroundColor: colors.bgHover,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: "6px",
                outline: "none",
                cursor: "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238d99a8' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                paddingRight: "30px",
              }}
            >
              {usernames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav
          className="sidebar-nav"
          style={{
            flex: 1,
            padding: isCollapsed && !isMobile ? "12px 10px" : "12px 0",
          }}
        >
          {menuSections.map((section, sectionIdx) => (
            <div
              key={sectionIdx}
              style={{
                marginBottom: isCollapsed && !isMobile ? "10px" : "4px",
              }}
            >
              {!isCollapsed && section.title ? (
                <div
                  style={{
                    padding: "20px 20px 8px",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    marginTop: sectionIdx > 0 ? "8px" : "0",
                  }}
                >
                  {section.title}
                </div>
              ) : sectionIdx > 0 && isCollapsed ? (
                <div
                  style={{
                    margin: "8px 14px",
                    height: "1px",
                    backgroundColor: colors.border,
                    opacity: 0.7,
                  }}
                />
              ) : null}

              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {section.items.map((item, itemIdx) => {
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isExpanded = expandedMenus.includes(item.name);
                  const isItemActive = item.path
                    ? isActive(item.path)
                    : item.subItems?.some((subItem) =>
                        isActive(subItem.path),
                      ) || false;
                  const isHovered =
                    hoveredItem === `${section.title}-${item.name}`;

                  return (
                    <li key={itemIdx}>
                      <a
                        href={item.path ?? item.subItems?.[0]?.path ?? "#"}
                        onClick={(e) => {
                          if (hasSubItems) {
                            if (isCollapsed) {
                              navigateFromSidebar(e, item.subItems![0].path);
                            } else {
                              e.preventDefault();
                              toggleMenu(item.name);
                            }
                          } else if (item.path) {
                            navigateFromSidebar(e, item.path);
                          }
                        }}
                        title={isCollapsed ? item.name : undefined}
                        onMouseEnter={() =>
                          setHoveredItem(`${section.title}-${item.name}`)
                        }
                        onMouseLeave={() => setHoveredItem(null)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          textDecoration: "none",
                          color:
                            !hasSubItems && isItemActive
                              ? colors.text
                              : isHovered
                                ? colors.text
                                : colors.textMuted,
                          padding:
                            isCollapsed && !isMobile ? "13px 0" : "11px 12px",
                          justifyContent:
                            isCollapsed && !isMobile ? "center" : "flex-start",
                          gap: isCollapsed && !isMobile ? "0" : "10px",
                          cursor: "pointer",
                          transition:
                            "color 0.18s ease, background-color 0.18s ease",
                          backgroundColor:
                            !hasSubItems && isItemActive
                              ? "rgba(255, 255, 255, 0.08)"
                              : isHovered
                                ? colors.bgHover
                                : "transparent",
                          borderLeft: "none",
                          fontSize: "14.5px",
                          fontWeight:
                            !hasSubItems && isItemActive ? "600" : "400",
                          margin:
                            isCollapsed && !isMobile ? "4px 10px" : "2px 8px",
                          borderRadius: "8px",
                        }}
                      >
                        <i
                          className={item.icon}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "20px",
                            height: "20px",
                            fontSize: "14px",
                            textAlign: "center",
                            flexShrink: 0,
                            transition: "color 0.18s ease",
                          }}
                        />

                        {!isCollapsed && (
                          <>
                            <span
                              style={{
                                flex: 1,
                                fontSize: "14.5px",
                                fontWeight:
                                  !hasSubItems && isItemActive ? "600" : "400",
                              }}
                            >
                              {item.name}
                            </span>

                            {item.badge && (
                              <span
                                style={{
                                  padding: "2px 7px",
                                  borderRadius: "4px",
                                  fontSize: "9px",
                                  fontWeight: "700",
                                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                                  color: "rgba(255,255,255,0.75)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.4px",
                                }}
                              >
                                {item.badge.text}
                              </span>
                            )}

                            {hasSubItems && (
                              <i
                                className="fa fa-chevron-right"
                                style={{
                                  fontSize: "12px",
                                  transition: "transform 0.2s ease",
                                  transform: isExpanded
                                    ? "rotate(90deg)"
                                    : "rotate(0deg)",
                                  opacity: 0.7,
                                }}
                              />
                            )}
                          </>
                        )}
                      </a>

                      {!isCollapsed && hasSubItems && (
                        <div
                          style={{
                            maxHeight: isExpanded ? "400px" : "0",
                            overflow: "hidden",
                            transition: "max-height 0.22s ease",
                          }}
                        >
                          <ul
                            style={{
                              listStyle: "none",
                              padding: "4px 0",
                              margin: "0 8px 6px 28px",
                              borderLeft: "2px solid rgba(141, 153, 168, 0.2)",
                            }}
                          >
                            {item.subItems!.map((subItem, subIdx) => {
                              const isSubActive = isActive(subItem.path);
                              const isSubHovered =
                                hoveredItem === `sub-${subItem.path}`;

                              return (
                                <li key={subIdx}>
                                  <a
                                    href={subItem.path}
                                    onClick={(e) => {
                                      navigateFromSidebar(e, subItem.path);
                                    }}
                                    onMouseEnter={() =>
                                      setHoveredItem(`sub-${subItem.path}`)
                                    }
                                    onMouseLeave={() => setHoveredItem(null)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      padding: "10px 12px 10px 14px",
                                      cursor: "pointer",
                                      transition:
                                        "color 0.18s ease, background-color 0.18s ease",
                                      backgroundColor:
                                        isSubHovered && !isSubActive
                                          ? colors.bgHover
                                          : "transparent",
                                      color: isSubActive
                                        ? colors.text
                                        : isSubHovered
                                          ? colors.text
                                          : colors.textMuted,
                                      fontSize: "14px",
                                      fontWeight: isSubActive ? "600" : "400",
                                      textDecoration: "none",
                                      borderLeft: isSubActive
                                        ? `2px solid ${colors.accent}`
                                        : "2px solid transparent",
                                      marginLeft: "-2px",
                                      borderRadius: "0 6px 6px 0",
                                    }}
                                  >
                                    <span style={{ flex: 1 }}>
                                      {subItem.name}
                                    </span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom toggle — desktop siempre; móvil solo con menú abierto */}
        {(!isMobile || !isCollapsed) && (
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              padding: "10px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onToggle}
              aria-label={
                isMobile
                  ? "Cerrar menú de navegación"
                  : isCollapsed
                    ? "Expandir barra lateral"
                    : "Colapsar barra lateral"
              }
              title={isMobile ? "Cerrar menú" : isCollapsed ? "Expandir" : "Colapsar"}
              style={{
                width: "100%",
                height: "34px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                backgroundColor: "transparent",
                color: colors.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: isCollapsed ? "center" : "flex-start",
                gap: "10px",
                padding: isCollapsed ? "0" : "0 12px",
                cursor: "pointer",
                transition: "background-color 0.18s ease, color 0.18s ease",
                fontSize: "12px",
                fontWeight: "500",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bgHover;
                e.currentTarget.style.color = colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = colors.textMuted;
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <path
                  d={
                    isCollapsed
                      ? "M5.5 3.5 9 8l-3.5 4.5"
                      : "M10.5 3.5 7 8l3.5 4.5"
                  }
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 2.5v11"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity="0.65"
                />
              </svg>
              {(!isCollapsed || isMobile) && (
                <span>{isMobile ? "Cerrar menú" : "Colapsar menú"}</span>
              )}
            </button>
          </div>
        )}

        <style>{`
          .sidebar-shell {
            background-image: linear-gradient(180deg, rgba(255, 98, 0, 0.025) 0%, rgba(255, 255, 255, 0) 60%);
          }

          .sidebar-scroll::-webkit-scrollbar {
            width: 0;
          }

          .sidebar-scroll::-webkit-scrollbar-track {
            background: transparent;
          }

          .sidebar-scroll::-webkit-scrollbar-thumb {
            background: transparent;
          }

          @media (max-width: 1024px) {
            .sidebar-shell {
              border-top-right-radius: 24px;
              border-bottom-right-radius: 24px;
              box-shadow: 10px 0 32px rgba(15, 23, 42, 0.28) !important;
            }

            .sidebar-header {
              height: 72px !important;
              padding: 0 18px !important;
            }

            .sidebar-logo {
              width: min(180px, 55vw) !important;
            }

            .sidebar-nav {
              padding: 14px 0 28px !important;
            }
          }

          @media (max-width: 768px) {
            .sidebar-shell {
              width: min(86vw, 320px) !important;
              min-width: min(86vw, 320px) !important;
            }
          }

          @media (max-width: 480px) {
            .sidebar-shell {
              width: min(90vw, 320px) !important;
              min-width: min(90vw, 320px) !important;
            }
          }
        `}</style>
      </div>
    </>
  );
}

export default Sidebar;
