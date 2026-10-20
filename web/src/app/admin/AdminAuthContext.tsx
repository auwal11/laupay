import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { adminService } from "./services";
import { hasAdminToken, setAdminToken, setAdminUnauthorizedHandler } from "./api";
import type { AdminSession } from "./types";
import type { ApiError } from "@app/types/common";

type AdminStatus = "checking" | "authenticated" | "anonymous";

interface AdminAuthValue {
  session: AdminSession | null;
  status: AdminStatus;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<ApiError | null>;
  logout: () => void;
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
    setAdminUnauthorizedHandler(() => {
      setSession(null);
      setStatus("anonymous");
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
    adminService.overview().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSession(stored);
        setStatus("authenticated");
      } else {
        setAdminToken(null);
        if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setStatus("anonymous");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await adminService.login(email, password);
    if (!result.ok) return result.error;
    setAdminToken(result.data.accessToken);
    const next: AdminSession = { email, role: result.data.role, permissions: result.data.permissions ?? [] };
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(next));
    }
    setSession(next);
    setStatus("authenticated");
    return null;
  }, []);

  const logout = useCallback(() => {
    setAdminToken(null);
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setSession(null);
    setStatus("anonymous");
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
