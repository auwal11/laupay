import type { Role } from "./common";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  profilePhotoUrl?: string | null;
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
  confirmPassword: string;
  role: Role;
  profilePhotoData?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface AuthSession {
  user?: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokens?: AuthTokens;
}

export interface RegistrationReceipt {
  requiresVerification: true;
  email: string;
  message: string;
}

export interface OtpPayload { email: string; code: string }
