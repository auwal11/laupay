import { request, setAccessToken } from "./api";
import type { ApiResult } from "@app/types/common";
import type {
  AuthSession,
  AuthUser,
  ForgotPasswordPayload,
  LoginPayload,
  OtpPayload,
  RegisterPayload,
  RegistrationReceipt,
} from "@app/types/auth";

const REFRESH_KEY = "laupay_refresh_token";

/**
 * Real adapter for the backend auth module. Paths are relative to
 * VITE_API_BASE_URL (which includes the `/api` prefix).
 *
 * Registration does NOT issue tokens — the account stays PENDING_VERIFICATION
 * until POST /auth/verify-otp succeeds, then the user logs in.
 */
export const authService = {
  async register(payload: RegisterPayload): Promise<ApiResult<RegistrationReceipt>> {
    // confirmPassword is a UI-only concern; the backend never receives it.
    const { confirmPassword: _confirmPassword, ...rest } = payload;
    return request<RegistrationReceipt>("/auth/register", {
      method: "POST",
      body: rest,
    });
  },

  async login(payload: LoginPayload): Promise<ApiResult<AuthSession>> {
    const result = await request<AuthSession>("/auth/login", {
      method: "POST",
      body: payload,
    });
    if (result.ok) {
      setAccessToken(result.data.accessToken);
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(REFRESH_KEY, result.data.refreshToken);
      }
    }
    return result;
  },

  async me(): Promise<ApiResult<AuthUser>> {
    return request<AuthUser>("/auth/me");
  },

  async verifyOtp(payload: OtpPayload): Promise<ApiResult<AuthSession>> {
    const result = await request<AuthSession>("/auth/verify-otp", {
      method: "POST",
      body: payload,
    });
    if (result.ok) {
      setAccessToken(result.data.accessToken);
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(REFRESH_KEY, result.data.refreshToken);
    }
    return result;
  },

  async resendOtp(email: string): Promise<ApiResult<{ sent: true }>> {
    return request<{ sent: true }>("/auth/resend-otp", { method: "POST", body: { email } });
  },

  async resetPassword(token: string, password: string): Promise<ApiResult<{ reset: true }>> {
    return request<{ reset: true }>("/auth/reset-password", {
      method: "POST",
      body: { token, password },
    });
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<ApiResult<{ sent: true }>> {
    return request<{ sent: true }>("/auth/forgot-password", {
      method: "POST",
      body: payload,
    });
  },

  logout(): void {
    setAccessToken(null);
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(REFRESH_KEY);
  },
};
