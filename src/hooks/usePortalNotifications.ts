// src/hooks/usePortalNotifications.ts
// Polls the multi-audience portal notification feed and exposes actions for the navbar bell.
// Replaces the legacy useExecutiveNotifications hook.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

const POLL_INTERVAL_MS = 45_000;

export type PortalNotificationType =
  | "QUOTE_COMPLETED"
  | "QUOTE_ABANDONED"
  | "TRACKING_CREATED"
  | "TRACKING_STATUS_CHANGED"
  | "TRACKING_DELAYED"
  | "CLIENT_ASSIGNED"
  | "CLIENT_COLD";

export interface PortalNotification {
  _id: string;
  audience: "EJECUTIVO" | "CLIENTE" | "OPERACIONES";
  recipientEmail: string;
  recipientUsername?: string;
  type: PortalNotificationType;
  dedupKey: string;
  sessionId?: string;
  quoteType?: "AIR" | "FCL" | "LCL" | "LASTMILE";
  quoteNumber?: string;
  route?: { origin?: string; destination?: string };
  shipmentMode?: "AIR" | "OCEAN";
  shipmentId?: string;
  reference?: string;
  awbNumber?: string;
  containerNumber?: string;
  oldStatus?: string;
  newStatus?: string;
  clientEmail?: string;
  clientUsername?: string;
  clientNombre?: string;
  payload?: {
    route?: string;
    openModal?: string;
    modalTab?: string;
    [key: string]: unknown;
  };
  read: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface UsePortalNotificationsReturn {
  notifications: PortalNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export function usePortalNotifications(
  enabled: boolean,
): UsePortalNotificationsReturn {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !token) return;
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setNotifications(
        Array.isArray(data?.notifications) ? data.notifications : [],
      );
    } catch {
      // silent — bell is non-critical
    } finally {
      setLoading(false);
    }
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !token) {
      setNotifications([]);
      return;
    }
    void refresh();
    timerRef.current = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, token, refresh]);

  const markAllRead = useCallback(async () => {
    if (!enabled || !token) return;
    setNotifications((prev) =>
      prev.some((n) => !n.read)
        ? prev.map((n) => (n.read ? n : { ...n, read: true }))
        : prev,
    );
    try {
      await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* ignore */
    }
  }, [enabled, token]);

  const dismiss = useCallback(
    async (id: string) => {
      if (!token) return;
      const prev = notifications;
      setNotifications((curr) => curr.filter((n) => n._id !== id));
      try {
        const resp = await fetch(
          `${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!resp.ok) {
          setNotifications(prev);
        }
      } catch {
        setNotifications(prev);
      }
    },
    [notifications, token],
  );

  const unreadCount = notifications.reduce(
    (acc, n) => acc + (n.read ? 0 : 1),
    0,
  );

  return { notifications, unreadCount, loading, refresh, markAllRead, dismiss };
}
