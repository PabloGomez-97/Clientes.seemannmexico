// src/layouts/Sidebar-admin.tsx - AWS/Azure Minimalist Design (same as client)
import { useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canSeeSidebarItem } from "../config/roleRoutes";
import { imgUrl } from "../config/images";
import logoSeemann from "./logoseemann.png";
import { handleSidebarNavigation } from "./sidebarNavigation";

interface SidebarAdminProps {
  isCollapsed: boolean;
  isMobile: boolean;
  onCloseMobile: () => void;
  onToggle: () => void;
}

interface SubMenuItem {
  path: string;
  name: string;
  restrictedTo?: string | string[];
  hiddenForAdmin?: boolean;
  badge?: {
    text: string;
    type: "new" | "beta" | "admin";
  };
}

interface MenuItem {
  path?: string;
  name: string;
  icon: string;
  restrictedTo?: string | string[];
  hiddenForAdmin?: boolean;
  badge?: {
    text: string;
    type: "new" | "beta" | "admin";
  };
  subItems?: SubMenuItem[];
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
}

// Design tokens - Enterprise Dark + Brand (same as client Sidebar)
const colors = {
  bg: "#232f3e",
  bgHover: "#2d3a4a",
  bgActive: "rgba(255, 98, 0, 0.14)",
  text: "#ffffff",
  textMuted: "#8d99a8",
  border: "#3b4754",
  accent: "#ff6200",
};

function SidebarAdmin({
  isCollapsed,
  isMobile,
  onCloseMobile,
  onToggle,
}: SidebarAdminProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const canSeeByEmail = (restrictedTo?: string | string[]) => {
    if (!restrictedTo) return true;

    return Array.isArray(restrictedTo)
      ? restrictedTo.includes(user?.email || "")
      : user?.email === restrictedTo;
  };

  const canSeeByRole = (path?: string) => {
    if (!path || !user?.roles) return true;
    return canSeeSidebarItem(user.roles, path);
  };

  const menuSections: MenuSection[] = [
    {
      items: [{ path: "/admin/home", name: "Inicio", icon: "fa fa-home" }],
    },

    {
      items: [
        {
          path: "/admin/cotizador-administrador",
          name: "Cotizador",
          icon: "bi bi-currency-dollar",
        },
        {
          path: "/admin/simulador-cotizaciones",
          name: "Simulador de Cotizaciones",
          icon: "fa fa-flask",
        },
        {
          path: "/admin/comportamiento-clientes",
          name: "Análisis de Clientes",
          icon: "fa fa-chart-line",
          hiddenForAdmin: true,
        },
        {
          path: "/admin/op-comportamiento-clientes",
          name: "Análisis de Clientes [Global]",
          icon: "fa fa-chart-line",
        },
      ],
    },

    {
      items: [
        {
          name: "Operaciones",
          icon: "fa fa-route",
          subItems: [
            {
              path: "/admin/documentacion",
              name: "Documentación de Clientes",
              hiddenForAdmin: true,
            },
            {
              path: "/admin/reporteriaclientes",
              name: "Directorio de Clientes",
              hiddenForAdmin: true,
            },
            {
              path: "/admin/op-reporteriaclientes",
              name: "Directorio de Clientes [Global]",
            },
            {
              path: "/admin/trackeos",
              name: "Monitoreo de Envíos",
              hiddenForAdmin: true,
            },
            {
              path: "/admin/op-trackeos",
              name: "Monitoreo de Envíos [Global]",
            },
            {
              path: "/admin/op-documentacion",
              name: "Documentación Global",
            },
          ],
        },
      ],
    },
    {
      title: "Tarifario",
      items: [
        {
          path: "/admin/pricing",
          name: "Administración de Tarifas",
          icon: "fa fa-tags",
        },
        {
          path: "/admin/tarifario-completo",
          name: "Tarifario General",
          icon: "fa fa-table",
        },
        {
          path: "/admin/documentos-proveedores",
          name: "Documentación de Proveedores",
          icon: "fa fa-file-alt",
        },
        {
          path: "/admin/alertas-pricing",
          name: "Alertas Tarifas",
          icon: "fa fa-exclamation-triangle",
        },
      ],
    },

    {
      items: [
        {
          name: "Administración",
          icon: "fa fa-shield-alt",
          subItems: [
            {
              path: "/admin/users",
              name: "Gestión de Usuarios",
              badge: { text: "CHIEF", type: "admin" as const },
            },
            {
              path: "/admin/auditoria",
              name: "Auditoría",
              badge: { text: "AUDIT", type: "admin" as const },
            },
            {
              path: "/admin/agencia-aduanas",
              name: "Gestión Aduanera",
              badge: { text: "CHIEF", type: "admin" as const },
            },
            {
              path: "/admin/gestion-cotizador",
              name: "Gestión Cotizador",
              badge: { text: "CHIEF", type: "admin" as const },
            },
          ],
        },
      ],
    },
  ];

  // Filter by permission (restrictedTo + roles)
  const isAdmin = !!user?.roles?.administrador;

  const filteredSections = menuSections
    .map((s) => ({
      ...s,
      items: s.items
        .map((item) => ({
          ...item,
          subItems: item.subItems?.filter(
            (subItem) =>
              canSeeByEmail(subItem.restrictedTo) &&
              canSeeByRole(subItem.path) &&
              !(isAdmin && subItem.hiddenForAdmin),
          ),
        }))
        .filter((item) => {
          if (!canSeeByEmail(item.restrictedTo)) return false;
          if (!canSeeByRole(item.path)) return false;
          if (isAdmin && item.hiddenForAdmin) return false;
          if (item.subItems) return item.subItems.length > 0;
          return true;
        }),
    }))
    .filter((s) => s.items.length > 0);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const sidebarWidth = isMobile ? "280px" : isCollapsed ? "84px" : "260px";

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
        className="sidebar-admin-scroll"
      >
        <div
          className="sidebar-admin-header"
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
              className="sidebar-admin-logo"
              style={{
                width: isMobile ? "160px" : "180px",
                height: "auto",
                objectFit: "contain",
              }}
            />
          )}
        </div>

        <nav
          style={{
            flex: 1,
            padding: isCollapsed && !isMobile ? "12px 10px" : "12px 0",
          }}
        >
          {filteredSections.map((section, sectionIdx) => (
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
                  const visibleSubItems = item.subItems || [];
                  const isExpanded = expandedMenus.includes(item.name);
                  const isItemActive =
                    (item.path ? isActive(item.path) : false) ||
                    visibleSubItems.some((subItem) => isActive(subItem.path));
                  const isHovered =
                    hoveredItem === `${section.title}-${item.name}`;

                  return (
                    <li key={itemIdx}>
                      <a
                        href={
                          item.path
                            ? item.path
                            : hasSubItems && visibleSubItems.length > 0
                              ? visibleSubItems[0].path
                              : "#"
                        }
                        title={isCollapsed ? item.name : undefined}
                        onClick={(e) => {
                          if (hasSubItems) {
                            if (isCollapsed && visibleSubItems.length > 0) {
                              navigateFromSidebar(e, visibleSubItems[0].path);
                            } else {
                              e.preventDefault();
                              toggleMenu(item.name);
                            }
                          } else if (item.path) {
                            navigateFromSidebar(e, item.path);
                          }
                        }}
                        onMouseEnter={() =>
                          setHoveredItem(`${section.title}-${item.name}`)
                        }
                        onMouseLeave={() => setHoveredItem(null)}
                        style={{
                          display: "flex",
                          textDecoration: "none",
                          padding:
                            isCollapsed && !isMobile ? "13px 0" : "11px 12px",
                          alignItems: "center",
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
                          color:
                            !hasSubItems && isItemActive
                              ? colors.text
                              : isHovered
                                ? colors.text
                                : colors.textMuted,
                          fontSize: "14.5px",
                          fontWeight:
                            !hasSubItems && isItemActive ? "600" : "400",
                          margin:
                            isCollapsed && !isMobile ? "4px 10px" : "2px 8px",
                          borderRadius: "8px",
                        }}
                      >
                        {/* Sección de iconos */}
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
                                fontSize:
                                  "13.5px" /* tamaño del texto del sidebar */,
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
                                  backgroundColor:
                                    item.badge.type === "new"
                                      ? colors.accent
                                      : "rgba(255, 255, 255, 0.12)",
                                  color:
                                    item.badge.type === "new"
                                      ? "#ffffff"
                                      : "rgba(255,255,255,0.75)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.4px",
                                }}
                              >
                                {item.badge.text}
                              </span>
                            )}

                            {hasSubItems && visibleSubItems.length > 0 && (
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

                      {!isCollapsed &&
                        hasSubItems &&
                        visibleSubItems.length > 0 && (
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
                                borderLeft:
                                  "2px solid rgba(141, 153, 168, 0.2)",
                              }}
                            >
                              {visibleSubItems.map((subItem, subIdx) => {
                                const isSubActive = isActive(subItem.path);
                                const isSubHovered =
                                  hoveredItem === `sub-${subItem.path}`;

                                return (
                                  <li key={subIdx}>
                                    <a
                                      href={subItem.path}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigateFromSidebar(e, subItem.path);
                                      }}
                                      onMouseEnter={() =>
                                        setHoveredItem(`sub-${subItem.path}`)
                                      }
                                      onMouseLeave={() => setHoveredItem(null)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        padding: "8px 12px 8px 14px",
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
                                        fontSize: "13px",
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
                                      {subItem.badge && (
                                        <span
                                          style={{
                                            padding: "2px 7px",
                                            borderRadius: "4px",
                                            fontSize: "9px",
                                            fontWeight: "700",
                                            backgroundColor:
                                              "rgba(255, 255, 255, 0.12)",
                                            color: "rgba(255,255,255,0.75)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.4px",
                                          }}
                                        >
                                          {subItem.badge.text}
                                        </span>
                                      )}
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
          .sidebar-admin-scroll::-webkit-scrollbar {
            width: 0;
          }
          .sidebar-admin-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .sidebar-admin-scroll::-webkit-scrollbar-thumb {
            background: transparent;
          }
        `}</style>
      </div>
    </>
  );
}

export default SidebarAdmin;
