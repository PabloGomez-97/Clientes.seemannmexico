/** Detecta si el portal México vive bajo el dominio unificado de Chile. */
export function isUnifiedPortalHost(): boolean {
  const host = window.location.hostname;
  if (host === "portalclientes.seemanngroup.com") return true;
  if (host.includes("clientes-seemanngroup")) return true;
  // Local: Chile vite (5173) con proxy /mx; México vite standalone (5174)
  if (host === "localhost" || host === "127.0.0.1") {
    return window.location.port !== "5174";
  }
  // Deploy standalone México
  if (host.includes("seemannmexico") || host.includes("clientes-seemannmexico")) {
    return false;
  }
  return false;
}

function loginPath(kind: "client" | "admin" | "proveedor" = "client"): string {
  if (kind === "admin") return "/login-admin";
  if (kind === "proveedor") return "/login-proveedor";
  return "/login";
}

/**
 * Href absoluto de login para window.location.assign.
 * - Dominio unificado → `/login` (Chile)
 * - Standalone México → `/mx/login`
 */
export function getCentralLoginHref(
  kind: "client" | "admin" | "proveedor" = "client",
): string {
  const path = loginPath(kind);
  if (isUnifiedPortalHost()) return path;
  return `/mx${path}`;
}
