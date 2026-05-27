// src/layouts/AdminLayout.tsx - Same structure as UserLayouts
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import NavbarAdmin from "./Navbar-admin";
import SidebarAdmin from "./Sidebar-admin";
import ChatWidget from "../components/Chatbot/ChatWidget";
import Footer from "../components/Footer/Footer";
import { ChatbotProvider } from "../contexts/ChatbotContext";
import { useAuth } from "../auth/AuthContext";
import { canAccessRoute } from "../config/roleRoutes";
import { useLinbisToken } from "../hooks/useLinbisToken";

/** Teléfono y tablet: menú lateral como drawer */
const MOBILE_BREAKPOINT = 1024;

const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;

function AdminLayout() {
  const { user } = useAuth();
  const { accessToken, loading, error, refreshAccessToken } = useLinbisToken();
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
    // Token state is managed by useLinbisToken hook
  };

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

  // Mostrar error si falla
  if (error) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                padding: "40px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#fee2e2",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                }}
              >
                <svg width="32" height="32" fill="#dc2626" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                </svg>
              </div>
              <h4 style={{ color: "#1f2937", marginBottom: "12px" }}>
                Error de Conexión
              </h4>
              <p style={{ color: "#6b7280", marginBottom: "24px" }}>{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatbotProvider>
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
            accessToken={accessToken}
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
              <Outlet
                context={{
                  accessToken,
                  refreshAccessToken,
                  onLogout: handleLogout,
                }}
              />
            </div>
            <Footer />
          </div>
        </div>
        <ChatWidget />
      </div>
    </ChatbotProvider>
  );
}

export default AdminLayout;
