const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const API_ORIGIN = API_BASE.replace(/\/api$/, "");

/**
 * Resolves backend-relative asset paths (e.g. "/api/images/<id>") against the
 * API origin. Absolute URLs (Supabase, data:) pass through unchanged.
 */
export function assetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}
