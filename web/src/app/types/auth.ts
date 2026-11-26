import type { Role } from "./common";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  profilePhotoUrl?: string | null;
  /** ISO 8601. Backend-authoritative; omitted by GET /auth/me. */
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
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
  /** Confirmation only — never sent to the backend (stripped in the adapter). */
  confirmPassword?: string;
  termsAccepted: boolean;
  termsVersion: string;
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

/** Response to POST /auth/register — no tokens until the email code is verified. */
export interface RegistrationReceipt {
  requiresVerification: true;
  email: string;
  message: string;
}

export interface OtpPayload {
  email: string;
  code: string;
}
