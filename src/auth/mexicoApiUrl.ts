/** Prefijo de API bajo el basename de Vite (`/mx` en prod). */
export function getMexicoApiPrefix(): string {
  return String(import.meta.env.BASE_URL || "/")
    .replace(/\/$/, "")
    .replace(/\/$/, "");
}

/** Convierte `/api/...` en `/mx/api/...` cuando corresponde. */
export function mexicoApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const prefix = getMexicoApiPrefix(); // '' o '/mx'
  if (!prefix) return normalized;
  if (normalized.startsWith(`${prefix}/api`)) return normalized;
  if (normalized.startsWith("/api")) return `${prefix}${normalized}`;
  return normalized;
}
