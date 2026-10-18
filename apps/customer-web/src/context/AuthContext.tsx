import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { auth } from "@/services";
import { security } from "@/services";
import { setSessionInvalidHandler } from "@/services/api";
import type { AuthUser, LoginPayload, RegisterPayload } from "@/types/auth";
import type { ApiError } from "@/types/common";
import type { SessionStatus } from "@/types/security";

interface AuthContextValue {
  user: AuthUser | null;
  status: SessionStatus;
  login: (payload: LoginPayload) => Promise<ApiError | null>;
  register: (payload: RegisterPayload) => Promise<ApiError | null>;
  logout: () => void;
  refreshUser: () => Promise<ApiError | null>;
  verifyOtp: (payload: { email: string; code: string }) => Promise<ApiError | null>;
  pinReady: boolean | null;
  refreshPin: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [pinReady, setPinReady] = useState<boolean | null>(null);

  const refreshPin = useCallback(async () => {
    const result = await security.getPinStatus();
    const ready = result.ok && result.data.hasPin;
    setPinReady(ready);
    return ready;
  }, []);

  useEffect(() => {
    let cancelled = false;
    auth.me().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setUser(result.data);
        setStatus("authenticated");
        void refreshPin();
      } else {
        setStatus("anonymous");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshPin]);

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
    if (result.ok) {
      const profile = await auth.me();
      if (!profile.ok) return profile.error;
      setUser(profile.data);
      setStatus("authenticated");
      await refreshPin();
      return null;
    }
    return result.error;
  }, [refreshPin]);

  const verifyOtp = useCallback(async (payload: { email: string; code: string }) => {
    const result = await auth.verifyOtp(payload);
    if (!result.ok) return result.error;
    const profile = await auth.me();
    if (!profile.ok) return profile.error;
    setUser(profile.data); setStatus("authenticated"); setPinReady(false);
    return null;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await auth.register(payload);
    if (result.ok) {
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
    if (result.ok) { setUser(result.data); return null; }
    return result.error;
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, refreshUser, verifyOtp, pinReady, refreshPin }),
    [user, status, login, register, logout, refreshUser, verifyOtp, pinReady, refreshPin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
