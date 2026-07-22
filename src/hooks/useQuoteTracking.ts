// src/hooks/useQuoteTracking.ts — Hook for tracking quote behavior events
import {
  useRef,
  useCallback,
  useEffect,
  type MutableRefObject,
} from "react";
import { useAuth } from "../auth/AuthContext";

// ── Event Types ──
export type QuoteType = "AIR" | "FCL" | "LCL" | "LASTMILE" | "TERRESTRE";

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

export interface QuoteTrackingSubject {
  clientEmail: string;
  clientUsername: string;
}

export interface UseQuoteTrackingOptions {
  /** When ejecutivo quotes on behalf of a client, attribute events to the client. */
  subject?: QuoteTrackingSubject | null;
  /** Parent can call abandon explicitly before unmount (e.g. "Volver"). */
  abandonRef?: MutableRefObject<(() => void) | null>;
  /** Delay QUOTE_STARTED until a client is selected (ejecutivo mode). */
  waitForSubject?: boolean;
}

// ── API Base URL (mismo origen en prod; proxy local en dev) ──
const API_BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:4000" : "";

type TrackingEnvelope = QuoteTrackingPayload & {
  clientEmail: string;
  clientUsername: string;
  sessionId: string;
  timestamp: string;
};

/**
 * Fire-and-forget POST to the behavior tracking endpoint.
 * Never throws — failures are logged in development.
 */
function sendTrackingEvent(payload: TrackingEnvelope, token: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch(`${API_BASE_URL}/api/behavior-tracking`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn("[quote-tracking] POST failed:", err);
    }
  });
}

function sendTrackingBeacon(payload: TrackingEnvelope, token: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch(`${API_BASE_URL}/api/behavior-tracking`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn("[quote-tracking] pagehide POST failed:", err);
    }
  });
}

function generateSessionId(): string {
  return `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hook that provides tracking functions scoped to a single quote session.
 */
export function useQuoteTracking(
  quoteType: QuoteType,
  options: UseQuoteTrackingOptions = {},
) {
  const { user, token } = useAuth();
  const sessionId = useRef(generateSessionId());
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const abandonedRef = useRef(false);
  const lastStepRef = useRef<QuoteStepInfo | null>(null);
  const lastStepKeyRef = useRef<string | null>(null);

  const userRef = useRef(user);
  const tokenRef = useRef(token);
  const subjectRef = useRef(options.subject);
  userRef.current = user;
  tokenRef.current = token;
  subjectRef.current = options.subject;

  const resolveSubject = useCallback((): QuoteTrackingSubject | null => {
    const subject = subjectRef.current;
    if (subject?.clientEmail && subject.clientUsername) {
      return {
        clientEmail: subject.clientEmail,
        clientUsername: subject.clientUsername,
      };
    }
    const u = userRef.current;
    if (!u?.email || !u.username) return null;
    return { clientEmail: u.email, clientUsername: u.username };
  }, []);

  const buildEnvelope = useCallback(
    (payload: QuoteTrackingPayload): TrackingEnvelope | null => {
      const subject = resolveSubject();
      if (!subject) return null;
      return {
        ...payload,
        clientEmail: subject.clientEmail,
        clientUsername: subject.clientUsername,
        sessionId: sessionId.current,
        timestamp: new Date().toISOString(),
      };
    },
    [resolveSubject],
  );

  const send = useCallback(
    (payload: QuoteTrackingPayload) => {
      const envelope = buildEnvelope(payload);
      if (!envelope) return false;
      sendTrackingEvent(envelope, tokenRef.current);
      return true;
    },
    [buildEnvelope],
  );

  const sendAbandon = useCallback(
    (useBeacon = false) => {
      if (
        !startedRef.current ||
        completedRef.current ||
        abandonedRef.current
      ) {
        return;
      }
      abandonedRef.current = true;
      const envelope = buildEnvelope({
        event: "QUOTE_ABANDONED",
        quoteType,
        step: lastStepRef.current || undefined,
      });
      if (!envelope) return;
      if (useBeacon) {
        sendTrackingBeacon(envelope, tokenRef.current);
      } else {
        sendTrackingEvent(envelope, tokenRef.current);
      }
    },
    [buildEnvelope, quoteType],
  );

  const trackStart = useCallback(() => {
    if (startedRef.current) return;
    if (options.waitForSubject && !subjectRef.current) return;
    const sent = send({ event: "QUOTE_STARTED", quoteType });
    if (sent) startedRef.current = true;
  }, [send, quoteType, options.waitForSubject]);

  const trackStep = useCallback(
    (step: QuoteStepInfo, metadata?: Record<string, unknown>) => {
      const key = `${step.stepNumber}`;
      if (key === lastStepKeyRef.current) return;
      lastStepKeyRef.current = key;
      lastStepRef.current = step;
      if (!startedRef.current) trackStart();
      send({ event: "QUOTE_STEP_CHANGED", quoteType, step, metadata });
    },
    [send, quoteType, trackStart],
  );

  const trackRouteSelected = useCallback(
    (
      origin: string,
      destination: string,
      metadata?: Record<string, unknown>,
    ) => {
      if (completedRef.current) {
        sessionId.current = generateSessionId();
        startedRef.current = false;
        completedRef.current = false;
        abandonedRef.current = false;
        lastStepRef.current = null;
        lastStepKeyRef.current = null;
        send({ event: "QUOTE_STARTED", quoteType });
        startedRef.current = true;
      }
      if (!startedRef.current) trackStart();
      send({
        event: "QUOTE_ROUTE_SELECTED",
        quoteType,
        route: { origin, destination },
        metadata,
      });
    },
    [send, quoteType, trackStart],
  );

  const trackComplete = useCallback(
    (metadata?: Record<string, unknown>) => {
      if (completedRef.current) return;
      completedRef.current = true;
      send({ event: "QUOTE_COMPLETED", quoteType, metadata });
    },
    [send, quoteType],
  );

  const trackAbandon = useCallback(
    (metadata?: Record<string, unknown>) => {
      if (
        !startedRef.current ||
        completedRef.current ||
        abandonedRef.current
      ) {
        return;
      }
      abandonedRef.current = true;
      send({
        event: "QUOTE_ABANDONED",
        quoteType,
        step: lastStepRef.current || undefined,
        metadata,
      });
    },
    [send, quoteType],
  );

  useEffect(() => {
    trackStart();
  }, [trackStart, options.subject?.clientEmail]);

  useEffect(() => {
    if (!options.abandonRef) return;
    options.abandonRef.current = trackAbandon;
    return () => {
      options.abandonRef!.current = null;
    };
  }, [options.abandonRef, trackAbandon]);

  useEffect(() => {
    const onPageHide = () => sendAbandon(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      sendAbandon(false);
    };
  }, [sendAbandon]);

  return {
    trackStart,
    trackStep,
    trackRouteSelected,
    trackComplete,
    trackAbandon,
  };
}
