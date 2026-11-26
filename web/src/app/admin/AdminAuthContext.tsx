import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { adminService } from "./services";
import { getAdminRefreshToken, hasAdminToken, setAdminRefreshToken, setAdminToken, setAdminUnauthorizedHandler } from "./api";
import type { AdminSession } from "./types";
import type { ApiError } from "@app/types/common";

type AdminStatus = "checking" | "authenticated" | "anonymous";

interface AdminAuthValue {
  session: AdminSession | null;
  status: AdminStatus;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<{ error: ApiError | null; mustChangePassword: boolean }>;
  logout: () => Promise<void>;
}

const ADMIN_SESSION_KEY = "laupay_admin_session";
const AdminAuthContext = createContext<AdminAuthValue | null>(null);

function readStoredSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

/**
 * Admin session state, isolated from the customer AuthContext. On mount, if a
 * token exists it is validated with a real admin request before the session is
 * trusted — a stale/revoked token can never leave the console in a "logged in
 * but every call fails" state.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<AdminStatus>("checking");

  useEffect(() => {
    setAdminUnauthorizedHandler(async () => {
      const refreshToken = getAdminRefreshToken();
      const revocation = refreshToken ? adminService.logout(refreshToken) : Promise.resolve(null);
      setAdminRefreshToken(null);
      setSession(null);
      setStatus("anonymous");
      await revocation;
    });
    return () => setAdminUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredSession();
    if (!hasAdminToken() || !stored) {
      setStatus("anonymous");
      return;
    }
    // Hydrate trusted role/permission state from the backend for every session.
    // `mustChangePassword` remains on the stored session, so the route guard
    // still restricts newly provisioned accounts to the password-change page.
    adminService.me().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        const refreshed: AdminSession = {
          ...stored,
          userId: result.data.userId,
          role: result.data.role as AdminSession["role"],
          permissions: result.data.permissions,
          isSuperAdmin: result.data.isSuperAdmin,
        };
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(refreshed));
        setSession(refreshed);
        setStatus("authenticated");
      } else if (!hasAdminToken()) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setStatus("anonymous");
      } else {
        const restricted: AdminSession = { ...stored, isSuperAdmin: false, permissions: [] };
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(restricted));
        setSession(restricted);
        setStatus("authenticated");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await adminService.login(email, password);
    if (!result.ok) return { error: result.error, mustChangePassword: false };
    setAdminToken(result.data.accessToken);
    setAdminRefreshToken(result.data.refreshToken);
    const capabilities = await adminService.me();
    const next: AdminSession = {
      email,
      role: capabilities.ok ? capabilities.data.role as AdminSession["role"] : result.data.role,
      permissions: capabilities.ok ? capabilities.data.permissions : result.data.permissions ?? [],
      mustChangePassword: result.data.mustChangePassword,
      isSuperAdmin: capabilities.ok ? capabilities.data.isSuperAdmin : false,
      userId: capabilities.ok ? capabilities.data.userId : undefined,
    };
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(next));
    }
    setSession(next);
    setStatus("authenticated");
    return { error: null, mustChangePassword: Boolean(result.data.mustChangePassword) };
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getAdminRefreshToken();
    const revocation = refreshToken ? adminService.logout(refreshToken) : Promise.resolve(null);
    setAdminToken(null);
    setAdminRefreshToken(null);
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setSession(null);
    setStatus("anonymous");
    await revocation;
  }, []);

  const permissions = session?.permissions ?? [];
  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );
  const value = useMemo(
    () => ({ session, status, permissions, hasPermission, login, logout }),
    [session, status, permissions, hasPermission, login, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  return ctx;
}
