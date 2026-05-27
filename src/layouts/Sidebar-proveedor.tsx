// src/layouts/Sidebar-proveedor.tsx — Sidebar minimalista para Proveedores

import { useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoSeemann from "./logoseemann.png";
import { handleSidebarNavigation } from "./sidebarNavigation";
import { imgUrl } from "../config/images";

interface SidebarProveedorProps {
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
  subItems?: SubMenuItem[];
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
}

// Design tokens — Enterprise Dark + Brand
const colors = {
  bg: "#232f3e",
  bgHover: "#2d3a4a",
  bgActive: "rgba(255, 98, 0, 0.14)",
  text: "#ffffff",
  textMuted: "#8d99a8",
  border: "#3b4754",
  accent: "#ff6200",
};

function SidebarProveedor({
  isCollapsed,
  isMobile,
  onCloseMobile,
  onToggle,
}: SidebarProveedorProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (name: string) =>
    setExpandedMenus((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );

  const menuSections: MenuSection[] = [
    {
      items: [
        {
          path: "/proveedor/home",
          name: t("proveedor.sidebar.home"),
          icon: "fa fa-home",
        },
        {
          name: t("proveedor.sidebar.sectionTarifario"),
          icon: "fa fa-tag",
          subItems: [
            {
              path: "/proveedor/tarifario-aereo",
              name: t("proveedor.sidebar.tarifarioAereo"),
            },
            {
              path: "/proveedor/tarifario-fcl",
              name: t("proveedor.sidebar.tarifarioFCL"),
            },
            {
              path: "/proveedor/tarifario-lcl",
              name: t("proveedor.sidebar.tarifarioLCL"),
            },
          ],
        },
      ],
    },
    {
      items: [
        {
          path: "/proveedor/internacionalizacion",
          name: t("proveedor.sidebar.internacionalizacion"),
          icon: "fa fa-university",
        },
        {
          path: "/proveedor/archivos",
          name: t("proveedor.sidebar.archivos"),
          icon: "fa fa-file",
        },
        {
          path: "/proveedor/ayuda",
          name: t("proveedor.sidebar.ayuda"),
          icon: "fa fa-question-circle",
        },
      ],
    },
  ];

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

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

  const sidebarWidth = isMobile ? "280px" : isCollapsed ? "84px" : "260px";

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
        className="sidebar-proveedor-scroll"
      >
        <div
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
              style={{
                width: isMobile ? "160px" : "180px",
                height: "auto",
                objectFit: "contain",
              }}
            />
          )}
        </div>

        {!isCollapsed && (
          <div
            style={{
              padding: "16px 20px 8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              {t("proveedor.sidebar.portalLabel")}
            </span>
            <span
              style={{
                padding: "2px 6px",
                borderRadius: "3px",
                fontSize: "9px",
                fontWeight: "600",
                backgroundColor: colors.accent,
                color: colors.text,
                textTransform: "uppercase",
              }}
            >
              {t("proveedor.sidebar.badge")}
            </span>
          </div>
        )}

        <nav
          style={{
            flex: 1,
            padding: isCollapsed && !isMobile ? "12px 10px" : "8px 0",
          }}
        >
          {menuSections.map((section, sectionIdx) => (
            <div
              key={sectionIdx}
              style={{
                marginBottom: isCollapsed && !isMobile ? "10px" : "4px",
              }}
            >
              {sectionIdx > 0 && isCollapsed ? (
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
                    : item.subItems?.some((s) => isActive(s.path)) || false;
                  const isHovered = hoveredItem === `${sectionIdx}-${itemIdx}`;

                  return (
                    <li key={itemIdx}>
                      <a
                        href={item.path ?? item.subItems?.[0]?.path ?? "#"}
                        title={isCollapsed ? item.name : undefined}
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
                        onMouseEnter={() =>
                          setHoveredItem(`${sectionIdx}-${itemIdx}`)
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
                        <i
                          className={item.icon}
                          style={{
                            fontSize: "14px",
                            width: "20px",
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
                                fontSize: "14px",
                                fontWeight: isItemActive ? "500" : "400",
                              }}
                            >
                              {item.name}
                            </span>
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
                              borderLeft: `2px solid rgba(141, 153, 168, 0.2)`,
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
                                    onClick={(e) =>
                                      navigateFromSidebar(e, subItem.path)
                                    }
                                    onMouseEnter={() =>
                                      setHoveredItem(`sub-${subItem.path}`)
                                    }
                                    onMouseLeave={() => setHoveredItem(null)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      padding: "10px 12px 10px 14px",
                                      textDecoration: "none",
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
                                      borderLeft: isSubActive
                                        ? `2px solid ${colors.accent}`
                                        : "2px solid transparent",
                                      marginLeft: "-2px",
                                      borderRadius: "0 6px 6px 0",
                                    }}
                                  >
                                    {subItem.name}
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

        {/* Bottom toggle button — only on desktop */}
        {!isMobile && (
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
                isCollapsed
                  ? "Expandir barra lateral"
                  : "Colapsar barra lateral"
              }
              title={isCollapsed ? "Expandir" : "Colapsar"}
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
              {!isCollapsed && <span>Colapsar menú</span>}
            </button>
          </div>
        )}

        <style>{`
          .sidebar-proveedor-scroll::-webkit-scrollbar {
            width: 0;
          }
          .sidebar-proveedor-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .sidebar-proveedor-scroll::-webkit-scrollbar-thumb {
            background: transparent;
          }
        `}</style>
      </div>
    </>
  );
}

export default SidebarProveedor;
