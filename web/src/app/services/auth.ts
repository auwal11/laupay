import { request, setAccessToken } from "./api";
import type { ApiResult } from "@app/types/common";
import type {
  AuthSession,
  AuthUser,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
} from "@app/types/auth";

/**
 * Real adapter for POST /auth/register, POST /auth/login, GET /me.
 * Expected backend endpoints — confirm exact shapes with the backend agent
 * before wiring this up for real; response field names below are assumptions.
 */
export const authService = {
  async register(payload: RegisterPayload): Promise<ApiResult<AuthSession>> {
    const result = await request<AuthSession>("/auth/register", {
      method: "POST",
      body: payload,
    });
    if (result.ok) setAccessToken(result.data.tokens.accessToken);
    return result;
  },

  async login(payload: LoginPayload): Promise<ApiResult<AuthSession>> {
    const result = await request<AuthSession>("/auth/login", {
      method: "POST",
      body: payload,
    });
    if (result.ok) setAccessToken(result.data.tokens.accessToken);
    return result;
  },

  async me(): Promise<ApiResult<AuthUser>> {
    return request<AuthUser>("/me");
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<ApiResult<{ sent: true }>> {
    return request<{ sent: true }>("/auth/forgot-password", {
      method: "POST",
      body: payload,
    });
  },

  logout(): void {
    setAccessToken(null);
  },
};
