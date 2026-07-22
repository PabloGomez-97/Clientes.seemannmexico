// src/layouts/AdminLayout.tsx
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import NavbarAdmin from "./Navbar-admin";
import SidebarAdmin from "./Sidebar-admin";
import Footer from "../components/Footer/Footer";
import { useAuth } from "../auth/AuthContext";
import { canAccessRoute } from "../config/roleRoutes";
import "./ClientShell.css";

/** Teléfonos: menú lateral como drawer superpuesto */
const MOBILE_BREAKPOINT = 768;
/** Tablets: rail compacto persistente por defecto */
const TABLET_BREAKPOINT = 1199;

/** Clave propia del portal admin (no compartida con cliente) */
const SIDEBAR_PREF_KEY = "admin.sidebarCollapsed";

const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;

const isTabletViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= TABLET_BREAKPOINT;

function AdminLayout() {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [hasUserPref, setHasUserPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_PREF_KEY) !== null;
    } catch {
      return false;
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (isMobileViewport()) return true;
    try {
      const stored = localStorage.getItem(SIDEBAR_PREF_KEY);
      if (stored !== null) return stored === "true";
    } catch {
      /* ignore */
    }
    return isTabletViewport();
  });
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = isMobileViewport();

      setIsMobile((previousMobile) => {
        if (previousMobile !== mobile) {
          if (mobile) {
            setSidebarCollapsed(true);
          } else {
            let next = isTabletViewport();
            if (hasUserPref) {
              try {
                const stored = localStorage.getItem(SIDEBAR_PREF_KEY);
                if (stored !== null) next = stored === "true";
              } catch {
                /* ignore */
              }
            }
            setSidebarCollapsed(next);
          }
        }

        return mobile;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [hasUserPref]);

  // Verificar acceso por rol a la ruta actual (después de todos los hooks)
  if (
    user?.username === "Ejecutivo" &&
    user?.roles &&
    !canAccessRoute(user.roles, location.pathname)
  ) {
    return <Navigate to="/admin/home" replace />;
  }

  const handleLogout = () => {
    /* auth handled via AuthContext / Navbar */
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      if (!isMobileViewport()) {
        setHasUserPref(true);
        try {
          localStorage.setItem(SIDEBAR_PREF_KEY, String(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };

  return (
    <div className="d-flex" style={{ height: "100vh", position: "relative" }}>
      <SidebarAdmin
        isCollapsed={sidebarCollapsed}
        isMobile={isMobile}
        onCloseMobile={() => setSidebarCollapsed(true)}
        onToggle={toggleSidebar}
      />

      <div
        className="flex-fill d-flex flex-column"
        style={{ overflow: "hidden" }}
      >
        <NavbarAdmin
          onLogout={handleLogout}
          toggleSidebar={toggleSidebar}
          isSidebarCollapsed={sidebarCollapsed}
          isMobile={isMobile}
        />

        <div
          ref={mainRef}
          className="flex-fill user-layout-main layout-main--sticky-footer"
          style={{
            overflowY: "auto",
            backgroundColor: "#f8f9fa",
            minHeight: 0,
          }}
        >
          <div className="layout-main__content">
            <Outlet context={{ onLogout: handleLogout }} />
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
