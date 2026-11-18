const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE = (configuredApiBaseUrl && configuredApiBaseUrl !== "https://laupay-production.up.railway.app/api" ? configuredApiBaseUrl : "https://laupay.onrender.com/api").replace(/\/$/, "");
const API_ORIGIN = API_BASE.replace(/\/api$/, "");

/**
 * Resolves backend-relative asset paths (e.g. "/api/images/<id>") against the
 * API origin. Only HTTP(S) URLs are accepted for externally stored assets.
 * Data/blob URLs are deliberately rejected so a future caller cannot turn an
 * API-provided asset field into an executable browser URL.
 */
export function assetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const value = url.trim();
  if (!value) return undefined;
  if (/^https:\/\//i.test(value)) return value;
  if (/^http:\/\/localhost(?::\d+)?(?:\/|$)/i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return `${API_ORIGIN}${value}`;
  return undefined;
}
