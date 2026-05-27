/**
 * Base URL para imágenes servidas desde el bucket de Cloudflare R2.
 * Configura la variable de entorno VITE_R2_PUBLIC_IMAGES en Vercel y en tu .env local.
 * Ejemplo: VITE_R2_PUBLIC_IMAGES=https://pub-c9f000xxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
 *
 * Los nombres de archivo permanecen iguales a los que estaban en la carpeta public/.
 */
const R2_BASE = (import.meta.env.VITE_R2_PUBLIC_IMAGES as string | undefined)?.replace(/\/$/, '') ?? '';

/**
 * Construye la URL completa para una imagen del bucket de Cloudflare R2.
 * @param path Ruta del archivo, ej: '/logo.png' o 'ejecutivos/ab.png'
 */
export function imgUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${R2_BASE}${cleanPath}`;
}
