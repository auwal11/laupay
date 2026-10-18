import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { auth } from "@app/services";
import { setSessionInvalidHandler } from "@app/services/api";
import type { AuthUser, LoginPayload, RegisterPayload } from "@app/types/auth";
import type { ApiError } from "@app/types/common";
import type { SessionStatus } from "@app/types/security";

interface AuthContextValue {
  user: AuthUser | null;
  status: SessionStatus;
  login: (payload: LoginPayload) => Promise<ApiError | null>;
  register: (payload: RegisterPayload) => Promise<ApiError | null>;
  logout: () => void;
  refreshUser: () => Promise<ApiError | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    auth.me().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setUser(result.data);
        setStatus("authenticated");
      } else {
        setStatus("anonymous");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from any request (not just login) routes through here — this is
  // what makes "session revoked mid-session" a real, handled UI state
  // instead of the app quietly continuing to call APIs with a dead token.
  useEffect(() => {
    setSessionInvalidHandler((reason) => {
      setUser(null);
      setStatus(reason === "revoked" ? "session_revoked" : "session_expired");
    });
    return () => setSessionInvalidHandler(() => {});
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await auth.login(payload);
    if (!result.ok) return result.error;
    // Login returns tokens only — fetch the profile to populate the session.
    const profile = await auth.me();
    if (!profile.ok) return profile.error;
    setUser(profile.data);
    setStatus("authenticated");
    return null;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await auth.register(payload);
    if (result.ok) {
      // Account is created PENDING_VERIFICATION and is NOT signed in yet —
      // the caller must route the user through email verification + login.
      setStatus("anonymous");
      return null;
    }
    return result.error;
  }, []);

  const logout = useCallback(() => {
    auth.logout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const refreshUser = useCallback(async () => {
    const result = await auth.me();
    if (result.ok) {
      setUser(result.data);
      return null;
    }
    return result.error;
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, refreshUser }),
    [user, status, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
