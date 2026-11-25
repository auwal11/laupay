import type { ApiError, ApiResult } from "@app/types/common";

/**
 * Thin fetch wrapper. This is the ONLY place that knows about HTTP —
 * every other service module calls `request()` and works with typed
 * results, never with Response/fetch directly.
 *
 * No secrets live here. The access token is read from memory (set by
 * AuthContext after login) and never persisted to localStorage in this
 * shell — swap in your own storage strategy deliberately, since that is
 * a real security decision the integrating team should make on purpose.
 */

// Vercel must provide VITE_API_BASE_URL, but keep the deployed backend as a
// safe fallback so a missing build-time variable never turns API calls into
// same-origin requests that return the SPA HTML instead of JSON.
const DEFAULT_API_BASE_URL = "https://laupay.onrender.com/api";
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const activeApiBaseUrl = configuredApiBaseUrl && configuredApiBaseUrl !== "https://laupay-production.up.railway.app/api" ? configuredApiBaseUrl : DEFAULT_API_BASE_URL;
const BASE_URL = activeApiBaseUrl.replace(/\/$/, "");

// Persisted so a page reload keeps the session; the refresh token lives
// separately (see services/auth.ts) and the backend remains authoritative.
let accessToken: string | null =
  typeof sessionStorage !== "undefined" ? sessionStorage.getItem("laupay_access_token") : null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof sessionStorage === "undefined") return;
  if (token) sessionStorage.setItem("laupay_access_token", token);
  else sessionStorage.removeItem("laupay_access_token");
}

export function hasAccessToken(): boolean {
  return Boolean(accessToken);
}

/**
 * AuthContext registers a handler here once, at app start. Any request that
 * comes back 401 calls it, so a revoked/expired session is never silently
 * continued — the UI is forced back to an unauthenticated state instead of
 * trusting whatever stale token it still holds in memory.
 */
let onSessionInvalid: ((reason: "expired" | "revoked") => void) | null = null;

export function setSessionInvalidHandler(handler: (reason: "expired" | "revoked") => void) {
  onSessionInvalid = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (res.status === 401) {
      const error = await safeParseError(res);
      setAccessToken(null);
      onSessionInvalid?.(error.code === "SESSION_REVOKED" ? "revoked" : "expired");
      return { ok: false, error };
    }

    if (!res.ok) {
      const error = await safeParseError(res);
      return { ok: false, error };
    }

    // Some endpoints (e.g. logout) may return 204 No Content.
    if (res.status === 204) {
      return { ok: true, data: undefined as T };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: { code: "ABORTED", message: "Request cancelled." } };
    }
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Couldn't reach LAUPAY. Check your connection and try again.",
      },
    };
  }
}

async function safeParseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    return {
      code: body.code ?? `HTTP_${res.status}`,
      message: body.message ?? "Something went wrong. Please try again.",
      fieldErrors: body.fieldErrors,
    };
  } catch {
    return {
      code: `HTTP_${res.status}`,
      message: "Something went wrong. Please try again.",
    };
  }
}
