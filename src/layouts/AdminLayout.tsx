// src/layouts/AdminLayout.tsx
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import NavbarAdmin from "./Navbar-admin";
import SidebarAdmin from "./Sidebar-admin";
import Footer from "../components/Footer/Footer";
import { useAuth } from "../auth/AuthContext";
import { canAccessRoute } from "../config/roleRoutes";

/** Teléfono y tablet: menú lateral como drawer */
const MOBILE_BREAKPOINT = 1024;

const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;

function AdminLayout() {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [hasUserPref, setHasUserPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") !== null;
    } catch {
      return false;
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("sidebarCollapsed");
      if (stored !== null) return stored === "true";
    } catch {
      /* ignore */
    }
    return isMobileViewport();
  });
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Verificar acceso por rol a la ruta actual
  if (
    user?.username === "Ejecutivo" &&
    user?.roles &&
    !canAccessRoute(user.roles, location.pathname)
  ) {
    return <Navigate to="/admin/home" replace />;
  }

  useEffect(() => {
    const handleResize = () => {
      const mobile = isMobileViewport();

      setIsMobile((previousMobile) => {
        if (previousMobile !== mobile) {
          if (!hasUserPref) setSidebarCollapsed(mobile);
        }

        return mobile;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [hasUserPref]);

  const handleLogout = () => {
    /* auth handled via AuthContext / Navbar */
  };

  const toggleSidebar = () => {
    setHasUserPref(true);
    setSidebarCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem("sidebarCollapsed", String(next));
      } catch {
        /* ignore */
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
