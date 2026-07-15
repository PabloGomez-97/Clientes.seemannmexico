// src/layouts/UserLayout.tsx
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "../components/Footer/Footer";

/** Teléfono y tablet: menú lateral como drawer */
const MOBILE_BREAKPOINT = 1024;

const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;

function UserLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);
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
        style={{ overflow: "hidden" }}
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
