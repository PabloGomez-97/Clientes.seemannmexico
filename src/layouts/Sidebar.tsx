// src/layouts/Sidebar.tsx — Chrome del portal de clientes (Enterprise Dark, idéntico a Chile)
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import logoSeemann from "./logoseemann.png";
import { handleSidebarNavigation } from "./sidebarNavigation";
import SidebarMenuBadge from "./SidebarMenuBadge";

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
  menuId?: string;
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

interface BottomMenuItem {
  path: string;
  name: string;
  icon: string;
  external?: boolean;
}

const ACCENT = "#ff6200";

function Sidebar({ isCollapsed, isMobile, onCloseMobile, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, activeUsername, setActiveUsername } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const usernames = user?.usernames || [];
  const showAccountSelector = usernames.length > 1;
  const ejecutivo = user?.ejecutivo;

  const isRail = isCollapsed && !isMobile;
  const showEjecutivoStrip = !!ejecutivo && !isRail;

  // Menús de Mexico: mismos items/rutas que hoy, solo con la estructura visual de Chile.
  const menuSections: MenuSection[] = useMemo(
    () => [
      {
        items: [
          { path: "/", name: t("home.sidebar.home"), icon: "fa fa-home" },
        ],
      },
      {
        items: [
          {
            menuId: "quote",
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
            path: "/mis-documentos",
            name: "Mis Documentos",
            icon: "fa fa-file",
          },
        ],
      },
    ],
    [t],
  );

  const bottomMenuItems: BottomMenuItem[] = [
    {
      path: "/settings",
      name: t("home.sidebar.settings"),
      icon: "fa fa-cog",
    },
    {
      path: "https://www.seemanngroup.com/",
      name: t("home.sidebar.help"),
      icon: "fa fa-question-circle",
      external: true,
    },
  ];

  const isPathActive = (path: string) => {
    const { pathname } = location;
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const isSubItemActive = (subItem: SubMenuItem) => isPathActive(subItem.path);

  // Auto-expandir el grupo que contiene la ruta activa
  useEffect(() => {
    const activeGroups = menuSections
      .flatMap((section) => section.items)
      .filter(
        (item) =>
          item.menuId && item.subItems?.some((sub) => isSubItemActive(sub)),
      )
      .map((item) => item.menuId!) as string[];

    if (activeGroups.length > 0) {
      setExpandedMenus((prev) => [
        ...prev,
        ...activeGroups.filter((id) => !prev.includes(id)),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, menuSections]);

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

  const handleAccountChange = (nextUsername: string) => {
    setActiveUsername(nextUsername);
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
          aria-label={t("home.sidebar.closeMenu", { defaultValue: "Cerrar menú" })}
          tabIndex={-1}
        />
      )}

      <div className={rootClass} aria-hidden={isMobile && isCollapsed}>
        <div className="csb-header">
          <a
            href="/"
            className="csb-header__link"
            onClick={(e) => navigateFromSidebar(e, "/")}
            aria-label={t("home.sidebar.home")}
            title={t("home.sidebar.home")}
          >
            {isRail ? (
              <img src={logoSeemann} alt="Seemann" className="csb-logo--mark" />
            ) : (
              <img src={logoSeemann} alt="Seemann Group" className="csb-logo" />
            )}
          </a>
        </div>

        {showAccountSelector && !isRail && (
          <div className="csb-account">
            <label className="csb-account__label" htmlFor="csb-account-select">
              {t("sidebar.account")}
            </label>
            <select
              id="csb-account-select"
              className="csb-account__select"
              value={activeUsername}
              onChange={(e) => handleAccountChange(e.target.value)}
            >
              {usernames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showEjecutivoStrip && ejecutivo && (
          <div
            className="csb-exec"
            title={`${t("sidebar.yourExecutive")} ${ejecutivo.nombre}`}
          >
            <span className="csb-exec__text">
              <span className="csb-exec__label">
                {t("sidebar.yourExecutive")}{" "}
              </span>
              <span className="csb-exec__name">{ejecutivo.nombre}</span>
            </span>
            <div className="csb-exec__actions">
              <a
                href={`mailto:${ejecutivo.email}`}
                className="csb-exec__action"
                title={ejecutivo.email}
                aria-label={ejecutivo.email}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                  <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z" />
                </svg>
              </a>
              {ejecutivo.telefono ? (
                <a
                  href={`tel:${ejecutivo.telefono}`}
                  className="csb-exec__action"
                  title={ejecutivo.telefono}
                  aria-label={ejecutivo.telefono}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"
                    />
                  </svg>
                </a>
              ) : null}
            </div>
          </div>
        )}

        <nav className="csb-nav" aria-label={t("home.sidebar.navLabel", { defaultValue: "Navegación principal" })}>
          {menuSections.map((section, sectionIdx) => (
            <div className="csb-section" key={sectionIdx}>
              {!isRail && section.title ? (
                <div className="csb-section__title">{section.title}</div>
              ) : sectionIdx > 0 && isRail ? (
                <div className="csb-section__divider" aria-hidden />
              ) : null}

              <ul className="csb-list">
                {section.items.map((item, itemIdx) => {
                  const hasSubItems = !!item.subItems?.length;
                  const isExpanded = item.menuId
                    ? expandedMenus.includes(item.menuId)
                    : false;
                  const isItemActive = item.path
                    ? isPathActive(item.path)
                    : item.subItems?.some((sub) => isSubItemActive(sub)) ||
                      false;

                  return (
                    <li key={itemIdx}>
                      <a
                        href={item.path ?? item.subItems?.[0]?.path ?? "#"}
                        className={[
                          "csb-item",
                          isItemActive && (!hasSubItems || isRail)
                            ? "csb-item--active"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={(e) => {
                          if (hasSubItems) {
                            if (isRail) {
                              navigateFromSidebar(e, item.subItems![0].path);
                            } else {
                              e.preventDefault();
                              toggleMenu(item.menuId!);
                            }
                          } else if (item.path) {
                            navigateFromSidebar(e, item.path);
                          }
                        }}
                        title={isRail ? item.name : undefined}
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
                            {item.subItems!.map((subItem, subIdx) => {
                              const isSubActive = isSubItemActive(subItem);
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
                                    onClick={(e) =>
                                      navigateFromSidebar(e, subItem.path)
                                    }
                                    aria-current={
                                      isSubActive ? "page" : undefined
                                    }
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

        {/* Configuración y Ayuda */}
        <div className="csb-footer">
          <ul className="csb-list">
            {bottomMenuItems.map((item) => {
              const isItemActive = !item.external && isPathActive(item.path);
              return (
                <li key={item.path}>
                  <a
                    href={item.path}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className={[
                      "csb-item",
                      isItemActive ? "csb-item--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={(e) => {
                      if (item.external) {
                        if (isMobile) onCloseMobile();
                        return;
                      }
                      navigateFromSidebar(e, item.path);
                    }}
                    title={isRail ? item.name : undefined}
                    aria-current={isItemActive ? "page" : undefined}
                  >
                    <i className={`csb-item__icon ${item.icon}`} aria-hidden />
                    {!isRail && (
                      <span className="csb-item__label">{item.name}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Colapsar / cerrar */}
        <div className="csb-collapse">
          <button
            type="button"
            className="csb-collapse__btn"
            onClick={onToggle}
            aria-label={
              isMobile
                ? t("home.sidebar.closeMenu", { defaultValue: "Cerrar menú" })
                : isCollapsed
                  ? t("home.sidebar.expandMenu", { defaultValue: "Expandir menú" })
                  : t("home.sidebar.collapseMenu", { defaultValue: "Colapsar menú" })
            }
            title={
              isMobile
                ? t("home.sidebar.closeMenu", { defaultValue: "Cerrar menú" })
                : isCollapsed
                  ? t("home.sidebar.expandMenu", { defaultValue: "Expandir menú" })
                  : t("home.sidebar.collapseMenu", { defaultValue: "Colapsar menú" })
            }
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
                d={
                  isRail ? "M5.5 3.5 9 8l-3.5 4.5" : "M10.5 3.5 7 8l3.5 4.5"
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
            {!isRail && (
              <span>
                {isMobile
                  ? t("home.sidebar.closeMenu", { defaultValue: "Cerrar menú" })
                  : t("home.sidebar.collapseMenu", { defaultValue: "Colapsar menú" })}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
