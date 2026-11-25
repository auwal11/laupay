import * as SecureStore from 'expo-secure-store';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://laupay.onrender.com/api').replace(/\/+$/, '');
const REFRESH_KEY = 'laupay_refresh_token';
const REQUEST_TIMEOUT_MS = 18_000;

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let onSessionInvalid: (() => void) | null = null;

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code = 'REQUEST_FAILED', status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  retryAfterRefresh?: boolean;
};

export function setSessionInvalidHandler(handler: (() => void) | null) {
  onSessionInvalid = handler;
}

export function hasInMemoryAccessToken() {
  return Boolean(accessToken);
}

export async function saveSession(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSession() {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
}

export async function restoreSession(): Promise<boolean> {
  return rotateRefreshToken();
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await performRequest(path, options, accessToken);
  if (response.status === 401 && options.auth !== false && accessToken && options.retryAfterRefresh !== false) {
    const refreshed = await rotateRefreshToken();
    if (refreshed) {
      response = await performRequest(path, options, accessToken);
    } else {
      await clearSession();
      onSessionInvalid?.();
      throw await toApiError(response);
    }
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function rotateRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) return false;
    const response = await performRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
      timeoutMs: REQUEST_TIMEOUT_MS,
      retryAfterRefresh: false,
    }, null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) await clearSession();
      return false;
    }
    const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
    await saveSession(tokens);
    return true;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performRequest(path: string, options: RequestOptions, token: string | null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      isTimeout ? 'The request took too long. Check your connection and try again.' : 'Could not reach LAUPAY. Check your connection and try again.',
      isTimeout ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: { code?: unknown; message?: unknown } = {};
  try {
    payload = await response.json();
  } catch {
    // Return a safe status-based message when a proxy responds with non-JSON.
  }
  const rawMessage = payload.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.filter((item): item is string => typeof item === 'string').join(' ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : 'Something went wrong. Please try again.';
  return new ApiError(message, typeof payload.code === 'string' ? payload.code : `HTTP_${response.status}`, response.status);
}
