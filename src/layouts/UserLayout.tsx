// src/layouts/UserLayout.tsx
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "../components/Footer/Footer";
import "./ClientShell.css";

/** Teléfonos: menú lateral como drawer superpuesto */
const MOBILE_BREAKPOINT = 768;
/** Tablets: rail compacto persistente por defecto */
const TABLET_BREAKPOINT = 1199;

/** Clave propia del portal cliente (no compartida con admin) */
const SIDEBAR_PREF_KEY = "client.sidebarCollapsed";

const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;

const isTabletViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= TABLET_BREAKPOINT;

function UserLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [hasUserPref, setHasUserPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_PREF_KEY) !== null;
    } catch {
      return false;
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    // En teléfono el drawer siempre parte cerrado
    if (isMobileViewport()) return true;
    try {
      const stored = localStorage.getItem(SIDEBAR_PREF_KEY);
      if (stored !== null) return stored === "true";
    } catch {
      /* ignore */
    }
    // Sin preferencia: rail en tablet, expandido en desktop
    return isTabletViewport();
  });

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
            // Al entrar a teléfono, el drawer parte cerrado
            setSidebarCollapsed(true);
          } else {
            // Al salir de teléfono, respetar preferencia o default por viewport
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

  const handleLogout = () => {
    /* auth handled via AuthContext / Navbar */
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      // El estado del drawer en teléfono no se persiste
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
    <div
      className="d-flex user-layout-shell"
      style={{ height: "100vh", position: "relative" }}
    >
      <Sidebar
        isCollapsed={sidebarCollapsed}
        isMobile={isMobile}
        onCloseMobile={() => setSidebarCollapsed(true)}
        onToggle={toggleSidebar}
      />

      <div
        className="flex-fill d-flex flex-column user-layout-frame"
        style={{ overflow: "hidden", position: "relative" }}
      >
        <Navbar
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

export default UserLayout;
