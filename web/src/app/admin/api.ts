import type { ApiError, ApiResult } from "@app/types/common";

/**
 * HTTP client for the admin console. Deliberately separate from
 * `@app/services/api` so an admin session and a customer session in the same
 * browser never share (or clobber) each other's token. No secrets live here —
 * the access token is kept in memory + sessionStorage only.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "laupay_admin_access_token";

let adminToken: string | null =
  typeof sessionStorage !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null;

export function setAdminToken(next: string | null) {
  adminToken = next;
  if (typeof sessionStorage === "undefined") return;
  if (next) sessionStorage.setItem(TOKEN_KEY, next);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return !!adminToken;
}

let onUnauthorized: (() => void) | null = null;
export function setAdminUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export function buildQuery(
  params: Record<string, string | number | undefined | null>,
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

interface AdminRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function adminRequest<T>(
  path: string,
  options: AdminRequestOptions = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401) {
      const error = await safeParseError(res);
      setAdminToken(null);
      onUnauthorized?.();
      return { ok: false, error };
    }

    if (!res.ok) {
      return { ok: false, error: await safeParseError(res) };
    }

    if (res.status === 204) return { ok: true, data: undefined as T };
    return { ok: true, data: (await res.json()) as T };
  } catch {
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

/** Downloads an authenticated CSV endpoint as a browser file. */
export async function downloadAdminCsv(path: string, filename: string): Promise<ApiError | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
    });
    if (res.status === 401) {
      setAdminToken(null);
      onUnauthorized?.();
      return await safeParseError(res);
    }
    if (!res.ok) return await safeParseError(res);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return null;
  } catch {
    return { code: "NETWORK_ERROR", message: "Couldn't download the export. Please try again." };
  }
}
