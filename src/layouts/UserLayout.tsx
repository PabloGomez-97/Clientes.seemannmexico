// src/layouts/UserLayout.tsx
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import ChatWidget from "../components/Chatbot/ChatWidget";
import Footer from "../components/Footer/Footer";
import { ChatbotProvider } from "../contexts/ChatbotContext";
import { useLinbisToken } from "../hooks/useLinbisToken";

/** Teléfono y tablet: menú lateral como drawer */
const MOBILE_BREAKPOINT = 1024;

const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;

function UserLayout() {
  const { t } = useTranslation();
  const { accessToken, loading, error, refreshAccessToken } = useLinbisToken();
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);
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

  {
    /*
  // Mostrar loading mientras obtiene el token
  if (loading) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center vh-100 position-relative overflow-hidden"
        style={{
          backgroundImage: "url(/logoseemann.jpg)",
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#1a365d",
        }}
      >
        <div
          className="position-absolute w-100 h-100"
          style={{
            background: "rgba(0, 0, 0, 0.4)",
            zIndex: 0,
          }}
        ></div>

        <div className="text-center position-relative" style={{ zIndex: 1 }}>
          <div
            className="spinner-border text-light mx-auto mb-4"
            role="status"
            style={{ width: "60px", height: "60px" }}
          >
            <span className="visually-hidden">
              {t("home.userLayout.loading")}
            </span>
          </div>

          <h4
            className="text-white fw-bold mb-2"
            style={{
              fontSize: "1.5rem",
              letterSpacing: "0.5px",
              textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            {t("home.userLayout.startingSystem")}
          </h4>
          <p
            className="text-white mb-0"
            style={{
              fontSize: "1rem",
              fontWeight: "500",
              textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {t("home.userLayout.connecting")}
          </p>

          <div className="d-flex gap-2 justify-content-center mt-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-circle"
                style={{
                  width: "10px",
                  height: "10px",
                  background: "white",
                  animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }}
              ></div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>
      </div>
    );
  }*/
  }

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
                {t("home.userLayout.connectionError")}
              </h4>
              <p style={{ color: "#6b7280", marginBottom: "24px" }}>{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                {t("home.userLayout.retry")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatbotProvider>
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

export default UserLayout;
