import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, AuthTokens, UserProfile } from '../../api/services';
import { clearSession, restoreSession, saveSession, setSessionInvalidHandler } from '../../api/http';

export type AuthState = 'loading' | 'signedOut' | 'signedIn' | 'offline';
type AuthContextValue = {
  state: AuthState;
  user: UserProfile | null;
  retryRestore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Parameters<typeof authApi.register>[0]) => ReturnType<typeof authApi.register>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendEmailCode: typeof authApi.resendEmailCode;
  forgotPassword: typeof authApi.forgotPassword;
  resetPassword: typeof authApi.resetPassword;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile>;
  changePassword: typeof authApi.changePassword;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);

  const expire = useCallback(() => {
    setUser(null);
    setState('signedOut');
  }, []);

  const retryRestore = useCallback(async () => {
    setState('loading');
    try {
      const hadRefresh = await SecureStore.getItemAsync('laupay_refresh_token');
      if (!hadRefresh) {
        setUser(null);
        setState('signedOut');
        return;
      }
      const refreshed = await restoreSession();
      if (!refreshed) {
        setUser(null);
        setState('signedOut');
        return;
      }
      const profile = await authApi.me();
      setUser(profile);
      setState('signedIn');
    } catch {
      // Preserve the refresh token on network/timeout failure so a retry can resume.
      setUser(null);
      setState('offline');
    }
  }, []);

  useEffect(() => {
    setSessionInvalidHandler(expire);
    queueMicrotask(() => { void retryRestore(); });
    return () => setSessionInvalidHandler(null);
  }, [expire, retryRestore]);

  const acceptTokens = useCallback(async (tokens: AuthTokens) => {
    await saveSession(tokens);
    const profile = await authApi.me();
    setUser(profile);
    setState('signedIn');
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email.trim().toLowerCase(), password);
    await acceptTokens(tokens);
  }, [acceptTokens]);

  const register = useCallback((payload: Parameters<typeof authApi.register>[0]) => authApi.register(payload), []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const tokens = await authApi.verifyEmail(email.trim().toLowerCase(), code);
    await acceptTokens(tokens);
  }, [acceptTokens]);

  const signOut = useCallback(async () => {
    const refreshToken = await SecureStore.getItemAsync('laupay_refresh_token');
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Local credentials are removed even when the backend cannot be reached.
    } finally {
      await clearSession();
      setUser(null);
      setState('signedOut');
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.me();
    setUser(profile);
    return profile;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state, user, retryRestore, login, register, verifyEmail,
    resendEmailCode: authApi.resendEmailCode,
    forgotPassword: authApi.forgotPassword,
    resetPassword: authApi.resetPassword,
    signOut, refreshProfile, changePassword: authApi.changePassword,
  }), [state, user, retryRestore, login, register, verifyEmail, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
