import { request, setAccessToken } from "./api";
import type { ApiResult } from "@/types/common";
import type {
  AuthSession, OtpPayload, RegistrationReceipt,
  AuthUser,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth";

/**
 * Real adapter for POST /auth/register, POST /auth/login, GET /me.
 * Expected backend endpoints — confirm exact shapes with the backend agent
 * before wiring this up for real; response field names below are assumptions.
 */
export const authService = {
  async register(payload: RegisterPayload): Promise<ApiResult<RegistrationReceipt>> {
    const { confirmPassword: _confirmPassword, ...rest } = payload;
    const result = await request<RegistrationReceipt>("/api/auth/register", {
      method: "POST",
      body: rest,
    });
    return result;
  },

  async login(payload: LoginPayload): Promise<ApiResult<AuthSession>> {
    const result = await request<AuthSession>("/api/auth/login", {
      method: "POST",
      body: payload,
    });
    if (result.ok) { setAccessToken(result.data.accessToken); sessionStorage.setItem("laupay_refresh_token", result.data.refreshToken); }
    return result;
  },

  async me(): Promise<ApiResult<AuthUser>> {
    const result = await request<AuthUser>("/api/auth/me");
    return result;
  },

  async verifyOtp(payload: OtpPayload): Promise<ApiResult<AuthSession>> {
    const result = await request<AuthSession>("/api/auth/verify-otp", { method: "POST", body: payload });
    if (result.ok) { setAccessToken(result.data.accessToken); sessionStorage.setItem("laupay_refresh_token", result.data.refreshToken); }
    return result;
  },

  resendOtp(email: string) {
    return request<{ sent: true }>("/api/auth/resend-otp", { method: "POST", body: { email } });
  },

  resetPassword(token: string, password: string) {
    return request<{ reset: true }>("/api/auth/reset-password", { method: "POST", body: { token, password } });
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<ApiResult<{ sent: true }>> {
    return request<{ sent: true }>("/api/auth/forgot-password", {
      method: "POST",
      body: payload,
    });
  },

  logout(): void {
    setAccessToken(null);
    sessionStorage.removeItem("laupay_refresh_token");
  },
};
