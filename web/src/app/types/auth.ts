import type { Role } from "./common";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  createdAt: string; // ISO 8601, backend-authoritative
}

export interface AuthTokens {
  accessToken: string;
  /** Present once the backend implements refresh-token support. */
  refreshToken?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}
