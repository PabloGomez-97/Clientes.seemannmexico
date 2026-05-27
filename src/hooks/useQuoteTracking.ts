// src/hooks/useQuoteTracking.ts — Hook for tracking quote behavior events
import { useRef, useCallback, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";

// ── Event Types ──
export type QuoteType = "AIR" | "FCL" | "LCL" | "LASTMILE";

export type QuoteTrackingEvent =
  | "QUOTE_STARTED"
  | "QUOTE_STEP_CHANGED"
  | "QUOTE_ROUTE_SELECTED"
  | "QUOTE_COMPLETED"
  | "QUOTE_ABANDONED";

export interface QuoteStepInfo {
  step: string;
  stepNumber: number;
  totalSteps: number;
}

export interface QuoteTrackingPayload {
  event: QuoteTrackingEvent;
  quoteType: QuoteType;
  step?: QuoteStepInfo;
  route?: { origin: string; destination: string };
  incoterm?: string;
  container?: string;
  metadata?: Record<string, unknown>;
}

// ── API Base URL ──
const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

/**
 * Fire-and-forget POST to the behavior tracking endpoint.
 * Never throws — failures are silently logged.
 */
function sendTrackingEvent(
  payload: QuoteTrackingPayload & {
    clientEmail: string;
    clientUsername: string;
    sessionId: string;
    timestamp: string;
  },
  token: string | null,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch(`${API_BASE_URL}/api/behavior-tracking`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    /* silent – tracking must never break the main flow */
  });
}

/**
 * Generate a short session id (not crypto-grade, just for grouping).
 */
function generateSessionId(): string {
  return `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hook that provides tracking functions scoped to a single quote session.
 *
 * Usage:
 *   const { trackStart, trackStep, trackRouteSelected, trackComplete, trackAbandon } = useQuoteTracking("AIR");
 */
export function useQuoteTracking(quoteType: QuoteType) {
  const { user, token } = useAuth();
  const sessionId = useRef(generateSessionId());
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const lastStepRef = useRef<QuoteStepInfo | null>(null);
  const lastStepKeyRef = useRef<string | null>(null);

  const send = useCallback(
    (payload: QuoteTrackingPayload) => {
      if (!user) return;
      sendTrackingEvent(
        {
          ...payload,
          clientEmail: user.email,
          clientUsername: user.username,
          sessionId: sessionId.current,
          timestamp: new Date().toISOString(),
        },
        token,
      );
    },
    [user, token],
  );

  /** Call once when the user enters the quote view. */
  const trackStart = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    send({ event: "QUOTE_STARTED", quoteType });
  }, [send, quoteType]);

  /** Call when the user progresses to a new meaningful step. */
  const trackStep = useCallback(
    (step: QuoteStepInfo, metadata?: Record<string, unknown>) => {
      const key = `${step.stepNumber}`;
      if (key === lastStepKeyRef.current) return; // debounce same step
      lastStepKeyRef.current = key;
      lastStepRef.current = step;
      send({ event: "QUOTE_STEP_CHANGED", quoteType, step, metadata });
    },
    [send, quoteType],
  );

  /** Call when the user selects a route (origin/destination). */
  const trackRouteSelected = useCallback(
    (
      origin: string,
      destination: string,
      metadata?: Record<string, unknown>,
    ) => {
      // Auto-reset session if the previous quote was completed.
      // This ensures that consecutive quotes within the same component
      // mount are tracked as separate sessions.
      if (completedRef.current) {
        sessionId.current = generateSessionId();
        startedRef.current = false;
        completedRef.current = false;
        lastStepRef.current = null;
        lastStepKeyRef.current = null;
        // Start a new session automatically
        send({ event: "QUOTE_STARTED", quoteType });
        startedRef.current = true;
      }
      send({
        event: "QUOTE_ROUTE_SELECTED",
        quoteType,
        route: { origin, destination },
        metadata,
      });
    },
    [send, quoteType],
  );

  /** Call when the quote is successfully completed. */
  const trackComplete = useCallback(
    (metadata?: Record<string, unknown>) => {
      completedRef.current = true;
      send({ event: "QUOTE_COMPLETED", quoteType, metadata });
    },
    [send, quoteType],
  );

  /** Call explicitly or on unmount when the quote was started but not completed. */
  const trackAbandon = useCallback(
    (metadata?: Record<string, unknown>) => {
      if (!startedRef.current || completedRef.current) return;
      send({
        event: "QUOTE_ABANDONED",
        quoteType,
        step: lastStepRef.current || undefined,
        metadata,
      });
    },
    [send, quoteType],
  );

  // Auto-detect abandon on unmount
  useEffect(() => {
    return () => {
      if (startedRef.current && !completedRef.current) {
        // Use the ref values directly in cleanup
        if (!user) return;
        sendTrackingEvent(
          {
            event: "QUOTE_ABANDONED",
            quoteType,
            step: lastStepRef.current || undefined,
            clientEmail: user.email,
            clientUsername: user.username,
            sessionId: sessionId.current,
            timestamp: new Date().toISOString(),
          },
          token,
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    trackStart,
    trackStep,
    trackRouteSelected,
    trackComplete,
    trackAbandon,
  };
}
