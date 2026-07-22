// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./i18n";
import "./styles.css";

/**
 * Con base `/mx/`, reescribe llamadas a la API:
 * - `/api/...` → `/mx/api/...`
 * - `https://portalclientes.seemanngroup.com/api/...` → `/mx/api/...` (mismo origen unificado)
 */
const apiPrefix = import.meta.env.BASE_URL.replace(/\/$/, ""); // '/mx' o ''
const CHILE_API_HOSTS = new Set([
  "portalclientes.seemanngroup.com",
  "clientes-seemanngroup.vercel.app",
]);

function rewriteApiUrl(raw: string): string | null {
  if (!apiPrefix) return null;

  if (raw.startsWith("/api")) {
    return `${apiPrefix}${raw}`;
  }

  try {
    const url = new URL(raw, window.location.origin);
    const isApiPath = url.pathname.startsWith("/api");
    if (!isApiPath) return null;

    const sameOrigin = url.origin === window.location.origin;
    const chileHost = CHILE_API_HOSTS.has(url.hostname);
    if (sameOrigin || chileHost) {
      return `${apiPrefix}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

if (apiPrefix) {
  try {
    sessionStorage.removeItem("mx_bridge_reload");
  } catch {
    /* ignore */
  }
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      const rewritten = rewriteApiUrl(input);
      if (rewritten) return nativeFetch(rewritten, init);
    } else if (input instanceof URL) {
      const rewritten = rewriteApiUrl(input.toString());
      if (rewritten) return nativeFetch(rewritten, init);
    } else if (input instanceof Request) {
      const rewritten = rewriteApiUrl(input.url);
      if (rewritten) {
        return nativeFetch(new Request(rewritten, input), init);
      }
    }
    return nativeFetch(input as RequestInfo, init);
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/mx">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
