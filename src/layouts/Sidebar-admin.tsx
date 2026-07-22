// src/layouts/Sidebar-admin.tsx — Chrome Enterprise Dark (admin), idéntico a Chile
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canSeeSidebarItem } from "../config/roleRoutes";
import logoSeemann from "./logoseemann.png";
import { handleSidebarNavigation } from "./sidebarNavigation";
import SidebarMenuBadge from "./SidebarMenuBadge";

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
  menuId?: string;
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

const ACCENT = "#ff6200";

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

  const isRail = isCollapsed && !isMobile;

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

  // Menús de Mexico: mismos items/rutas/filtros de rol que hoy, solo con la
  // estructura visual de Chile (csb-*).
  const menuSections: MenuSection[] = useMemo(
    () => [
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
            menuId: "operations",
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
            menuId: "administration",
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
    ],
    [],
  );

  // Filtro por permisos (restrictedTo + roles + hiddenForAdmin)
  const isAdmin = !!user?.roles?.administrador;

  const filteredSections = useMemo(
    () =>
      menuSections
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
        .filter((s) => s.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menuSections, isAdmin, user?.email, user?.roles],
  );

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // Auto-expandir el grupo con la ruta activa
  useEffect(() => {
    const activeGroups = filteredSections
      .flatMap((section) => section.items)
      .filter(
        (item) =>
          item.menuId && item.subItems?.some((sub) => isActive(sub.path)),
      )
      .map((item) => item.menuId!) as string[];

    if (activeGroups.length > 0) {
      setExpandedMenus((prev) => [
        ...prev,
        ...activeGroups.filter((id) => !prev.includes(id)),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, filteredSections]);

  // Escape cierra el drawer en teléfono
  useEffect(() => {
    if (!isMobile || isCollapsed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, isCollapsed, onCloseMobile]);

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

  const rootClass = [
    "csb-root",
    isMobile ? "csb-root--drawer" : "csb-root--docked",
    isMobile && isCollapsed ? "csb-root--drawer-hidden" : "",
    isRail ? "csb-root--rail" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {isMobile && !isCollapsed && (
        <button
          type="button"
          className="csb-scrim"
          onClick={onCloseMobile}
          aria-label="Cerrar menú"
          tabIndex={-1}
        />
      )}

      <div className={rootClass} aria-hidden={isMobile && isCollapsed}>
        <div className="csb-header">
          <a
            href="/admin/home"
            className="csb-header__link"
            onClick={(e) => navigateFromSidebar(e, "/admin/home")}
            aria-label="Inicio"
            title="Inicio"
          >
            {isRail ? (
              <img src={logoSeemann} alt="Seemann" className="csb-logo--mark" />
            ) : (
              <img src={logoSeemann} alt="Seemann Group" className="csb-logo" />
            )}
          </a>
        </div>

        <nav className="csb-nav" aria-label="Navegación principal">
          {filteredSections.map((section, sectionIdx) => (
            <div className="csb-section" key={sectionIdx}>
              {!isRail && section.title ? (
                <div className="csb-section__title">{section.title}</div>
              ) : sectionIdx > 0 && isRail ? (
                <div className="csb-section__divider" aria-hidden />
              ) : null}

              <ul className="csb-list">
                {section.items.map((item, itemIdx) => {
                  const visibleSubItems = item.subItems || [];
                  const hasSubItems = visibleSubItems.length > 0;
                  const isExpanded = item.menuId
                    ? expandedMenus.includes(item.menuId)
                    : false;
                  const isItemActive =
                    (item.path ? isActive(item.path) : false) ||
                    visibleSubItems.some((sub) => isActive(sub.path));

                  return (
                    <li key={itemIdx}>
                      <a
                        href={
                          item.path
                            ? item.path
                            : hasSubItems
                              ? visibleSubItems[0].path
                              : "#"
                        }
                        className={[
                          "csb-item",
                          isItemActive && (!hasSubItems || isRail)
                            ? "csb-item--active"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title={isRail ? item.name : undefined}
                        onClick={(e) => {
                          if (hasSubItems) {
                            if (isRail) {
                              navigateFromSidebar(e, visibleSubItems[0].path);
                            } else {
                              e.preventDefault();
                              toggleMenu(item.menuId!);
                            }
                          } else if (item.path) {
                            navigateFromSidebar(e, item.path);
                          }
                        }}
                        aria-expanded={
                          hasSubItems && !isRail ? isExpanded : undefined
                        }
                        aria-current={
                          !hasSubItems && isItemActive ? "page" : undefined
                        }
                      >
                        <i className={`csb-item__icon ${item.icon}`} aria-hidden />

                        {!isRail && (
                          <>
                            <span className="csb-item__label">
                              {item.name}
                              {item.badge && (
                                <SidebarMenuBadge
                                  text={item.badge.text}
                                  type={item.badge.type}
                                  accentColor={ACCENT}
                                />
                              )}
                            </span>

                            {hasSubItems && (
                              <i
                                className={[
                                  "fa fa-chevron-right csb-item__chevron",
                                  isExpanded ? "csb-item__chevron--open" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                aria-hidden
                              />
                            )}
                          </>
                        )}
                      </a>

                      {!isRail && hasSubItems && (
                        <div
                          className="csb-subwrap"
                          style={{ maxHeight: isExpanded ? "400px" : "0" }}
                        >
                          <ul className="csb-sublist">
                            {visibleSubItems.map((subItem, subIdx) => {
                              const isSubActive = isActive(subItem.path);
                              return (
                                <li key={subIdx}>
                                  <a
                                    href={subItem.path}
                                    className={[
                                      "csb-subitem",
                                      isSubActive ? "csb-subitem--active" : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigateFromSidebar(e, subItem.path);
                                    }}
                                    aria-current={
                                      isSubActive ? "page" : undefined
                                    }
                                  >
                                    {subItem.name}
                                    {subItem.badge && (
                                      <SidebarMenuBadge
                                        text={subItem.badge.text}
                                        type={subItem.badge.type}
                                        accentColor={ACCENT}
                                      />
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

        {/* Colapsar / cerrar */}
        <div className="csb-collapse">
          <button
            type="button"
            className="csb-collapse__btn"
            onClick={onToggle}
            aria-label={
              isMobile
                ? "Cerrar menú de navegación"
                : isCollapsed
                  ? "Expandir barra lateral"
                  : "Colapsar barra lateral"
            }
            title={isMobile ? "Cerrar menú" : isCollapsed ? "Expandir" : "Colapsar"}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              style={{ flexShrink: 0 }}
              aria-hidden
            >
              <path
                d={isRail ? "M5.5 3.5 9 8l-3.5 4.5" : "M10.5 3.5 7 8l3.5 4.5"}
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
            {!isRail && (
              <span>{isMobile ? "Cerrar menú" : "Colapsar menú"}</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default SidebarAdmin;
