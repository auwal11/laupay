import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { auth } from "@app/services";
import { setSessionInvalidHandler } from "@app/services/api";
import type { AuthUser, LoginPayload, OtpPayload, RegisterPayload } from "@app/types/auth";
import type { ApiError } from "@app/types/common";
import type { SessionStatus } from "@app/types/security";

interface AuthContextValue {
  user: AuthUser | null;
  status: SessionStatus;
  login: (payload: LoginPayload) => Promise<ApiError | null>;
  register: (payload: RegisterPayload) => Promise<ApiError | null>;
  logout: () => void;
  refreshUser: () => Promise<ApiError | null>;
  verifyOtp: (payload: OtpPayload) => Promise<ApiError | null>;
  pinReady: boolean | null;
  refreshPin: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [pinReady, setPinReady] = useState<boolean | null>(null);

  const refreshPin = useCallback(async () => {
    const result = await (await import("@app/services")).security.getPinStatus();
    if (!result.ok) {
      setPinReady(false);
      return false;
    }
    const ready = result.data.status === "active";
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
        setPinReady(null);
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
    if (!result.ok) return result.error;
    // Login returns tokens only — fetch the profile to populate the session.
    const profile = await auth.me();
    if (!profile.ok) return profile.error;
    setUser(profile.data);
    setStatus("authenticated");
    await refreshPin();
    return null;
  }, [refreshPin]);

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
    setPinReady(null);
  }, []);

  const verifyOtp = useCallback(async (payload: OtpPayload) => {
    const result = await auth.verifyOtp(payload);
    if (!result.ok) return result.error;
    const profile = await auth.me();
    if (!profile.ok) return profile.error;
    setUser(profile.data);
    setStatus("authenticated");
    setPinReady(false);
    return null;
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
