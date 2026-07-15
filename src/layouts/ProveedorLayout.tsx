// src/layouts/ProveedorLayout.tsx
import { useState, useEffect } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import NavbarAdmin from "./Navbar-admin";
import SidebarProveedor from "./Sidebar-proveedor";
import Footer from "../components/Footer/Footer";
import { useAuth } from "../auth/AuthContext";
import { canAccessRoute } from "../config/roleRoutes";

const MOBILE_BREAKPOINT = 768;

const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;

function ProveedorLayout() {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [hasUserPref, setHasUserPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") !== null;
    } catch (e) {
      return false;
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("sidebarCollapsed");
      if (stored !== null) return stored === "true";
    } catch (e) {
      /* ignore */
    }
    return isMobileViewport();
  });
  const location = useLocation();

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

  const toggleSidebar = () => {
    setHasUserPref(true);
    setSidebarCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem("sidebarCollapsed", String(next));
      } catch (e) {
        /* ignore */
      }
      return next;
    });
  };

  // Verificar acceso por rol a la ruta actual (debe ir después de todos los hooks)
  if (user?.roles && !canAccessRoute(user.roles, location.pathname)) {
    return <Navigate to="/proveedor/home" replace />;
  }

  return (
    <div className="d-flex" style={{ height: "100vh", position: "relative" }}>
      <SidebarProveedor
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
          onLogout={() => {}}
          toggleSidebar={toggleSidebar}
          isSidebarCollapsed={sidebarCollapsed}
        />

        <div
          className="flex-fill user-layout-main layout-main--sticky-footer"
          style={{
            overflowY: "auto",
            backgroundColor: "#f8f9fa",
            minHeight: 0,
          }}
        >
          <div className="layout-main__content">
            <Outlet />
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}

export default ProveedorLayout;
