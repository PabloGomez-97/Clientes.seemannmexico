// src/components/notifications/PortalNotificationBell.tsx
// Multi-audience notification bell. Replaces ExecutiveNotificationBell.
// Lives in both admin and client navbars. Displays quote/tracking/client events.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  usePortalNotifications,
  type PortalNotification,
} from "../../hooks/usePortalNotifications";

interface Props {
  enabled: boolean;
  navbarColors: {
    bg: string;
    bgHover: string;
    text: string;
    textMuted: string;
    border: string;
    accent: string;
  };
}

const NOTIFICATION_HEIGHT = 92;

function relativeTime(iso: string, t: (k: string, o?: any) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return t("home.navbar.notifications.justNow");
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return t("home.navbar.notifications.minutesAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("home.navbar.notifications.hoursAgo", { n: hrs });
  const days = Math.floor(hrs / 24);
  return t("home.navbar.notifications.daysAgo", { n: days });
}

function dotColorForType(type: PortalNotification["type"]): string {
  switch (type) {
    case "QUOTE_COMPLETED":
      return "#10b981";
    case "QUOTE_ABANDONED":
      return "#ef4444";
    case "TRACKING_CREATED":
      return "#3b82f6";
    case "TRACKING_STATUS_CHANGED":
      return "#8b5cf6";
    case "TRACKING_DELAYED":
      return "#f59e0b";
    case "CLIENT_ASSIGNED":
      return "#0ea5e9";
    case "CLIENT_COLD":
      return "#60a5fa";
    default:
      return "#6b7280";
  }
}

function buildTitleAndMessage(
  n: PortalNotification,
  t: (k: string, o?: any) => string,
): { title: string; message: string } {
  const clientName = n.clientUsername || n.clientNombre || "";
  const ref =
    n.shipmentMode === "AIR"
      ? n.awbNumber || n.reference || ""
      : n.containerNumber || n.reference || "";
  const mode =
    n.shipmentMode === "AIR"
      ? t("home.navbar.notifications.modeAir")
      : t("home.navbar.notifications.modeOcean");

  switch (n.type) {
    case "QUOTE_COMPLETED":
      return {
        title: t("home.navbar.notifications.completedTitle"),
        message: t("home.navbar.notifications.completedMsg", {
          client: clientName,
          type: n.quoteType,
        }),
      };
    case "QUOTE_ABANDONED":
      return {
        title: t("home.navbar.notifications.abandonedTitle"),
        message: t("home.navbar.notifications.abandonedMsg", {
          client: clientName,
          type: n.quoteType,
        }),
      };
    case "TRACKING_CREATED":
      return {
        title: t("home.navbar.notifications.trackingCreatedTitle", { mode }),
        message: t("home.navbar.notifications.trackingCreatedMsg", {
          mode,
          client: clientName,
          ref,
        }),
      };
    case "TRACKING_STATUS_CHANGED":
      return {
        title: t("home.navbar.notifications.statusChangedTitle", { mode }),
        message: t("home.navbar.notifications.statusChangedMsg", {
          mode,
          client: clientName,
          ref,
          old: n.oldStatus || "—",
          new: n.newStatus || "—",
        }),
      };
    case "TRACKING_DELAYED":
      return {
        title: t("home.navbar.notifications.delayedTitle", { mode }),
        message: t("home.navbar.notifications.delayedMsg", {
          mode,
          client: clientName,
          ref,
        }),
      };
    case "CLIENT_ASSIGNED":
      return {
        title: t("home.navbar.notifications.clientAssignedTitle"),
        message: t("home.navbar.notifications.clientAssignedMsg", {
          client: clientName,
        }),
      };
    case "CLIENT_COLD": {
      const days =
        typeof n.payload?.daysSinceActivity === "number" &&
        n.payload.daysSinceActivity > 0
          ? n.payload.daysSinceActivity
          : 30;
      return {
        title: t("home.navbar.notifications.clientColdTitle"),
        message: t("home.navbar.notifications.clientColdMsg", {
          client: clientName,
          days,
        }),
      };
    }
    default:
      return { title: "", message: "" };
  }
}

export default function PortalNotificationBell({
  enabled,
  navbarColors,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, dismiss } =
    usePortalNotifications(enabled);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".portal-notification-dropdown") &&
        !target.closest(".portal-notification-button")
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      void markAllRead();
    }
  };

  const handleNotificationClick = (n: PortalNotification) => {
    setOpen(false);
    const route = n.payload?.route;
    if (!route) {
      // fallback for legacy quote notifications
      const target = n.clientUsername
        ? `/admin/comportamiento-clientes/${encodeURIComponent(n.clientUsername)}`
        : "/admin/comportamiento-clientes";
      navigate(target);
      return;
    }
    navigate(route, {
      state: {
        openModal: n.payload?.openModal,
        modalTab: n.payload?.modalTab,
      },
    });
  };

  const swing = useMemo(
    () => unreadCount > 0 && !hovered && !open,
    [unreadCount, hovered, open],
  );

  if (!enabled) return null;

  const filteredNotifications = notifications.filter(
    (n) => n.type !== "CLIENT_COLD",
  );
  const visibleCount = Math.min(filteredNotifications.length, 5);
  const dropdownListMaxHeight =
    visibleCount > 0 ? visibleCount * NOTIFICATION_HEIGHT : 120;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="portal-notification-button"
        onClick={handleToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={t("home.navbar.notifications.title")}
        title={t("home.navbar.notifications.title")}
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "4px",
          border: `1px solid ${navbarColors.border}`,
          backgroundColor: open ? navbarColors.bgHover : "transparent",
          color: navbarColors.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background-color 0.15s ease",
          flexShrink: 0,
          position: "relative",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span
          style={{
            display: "inline-flex",
            transformOrigin: "50% 0%",
            animation: swing
              ? "portalBellSwing 1.6s ease-in-out infinite"
              : "none",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "16px",
              height: "16px",
              padding: "0 4px",
              borderRadius: "8px",
              backgroundColor: "#dc2626",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `2px solid ${navbarColors.bg}`,
              boxSizing: "content-box",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="portal-notification-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "360px",
            maxWidth: "calc(100vw - 24px)",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.18)",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            zIndex: 1000,
            fontFamily:
              '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}
            >
              {t("home.navbar.notifications.title")}
            </span>
            <span style={{ fontSize: "11px", color: "#6b7280" }}>
              {filteredNotifications.length}
            </span>
          </div>

          {filteredNotifications.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "13px",
              }}
            >
              {t("home.navbar.notifications.empty")}
            </div>
          ) : (
            <div
              style={{
                maxHeight: `${dropdownListMaxHeight}px`,
                overflowY: filteredNotifications.length > 5 ? "auto" : "hidden",
              }}
            >
              {filteredNotifications.map((n) => {
                const dotColor = dotColorForType(n.type);
                const { title, message } = buildTitleAndMessage(n, t);

                return (
                  <div
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #f3f4f6",
                      cursor: "pointer",
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                      backgroundColor: "#ffffff",
                      transition: "background-color 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: dotColor,
                        flexShrink: 0,
                        marginTop: "5px",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#111827",
                          }}
                        >
                          {title}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            flexShrink: 0,
                          }}
                        >
                          {relativeTime(n.createdAt, t)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#4b5563",
                          marginTop: "2px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {message}
                      </div>
                      {n.route?.origin && n.route?.destination && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#6b7280",
                            marginTop: "2px",
                          }}
                        >
                          {n.route.origin} → {n.route.destination}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void dismiss(n._id);
                      }}
                      aria-label={t("home.navbar.notifications.dismiss")}
                      title={t("home.navbar.notifications.dismiss")}
                      style={{
                        width: "20px",
                        height: "20px",
                        border: "none",
                        background: "transparent",
                        color: "#9ca3af",
                        cursor: "pointer",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                        e.currentTarget.style.color = "#374151";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#9ca3af";
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes portalBellSwing {
          0%   { transform: rotate(0deg); }
          15%  { transform: rotate(12deg); }
          30%  { transform: rotate(-10deg); }
          45%  { transform: rotate(8deg); }
          60%  { transform: rotate(-6deg); }
          75%  { transform: rotate(3deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
