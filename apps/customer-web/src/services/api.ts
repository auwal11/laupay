import type { ApiError, ApiResult } from "@/types/common";

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

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
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
        "Content-Type": "application/json",
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
