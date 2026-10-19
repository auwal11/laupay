import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@app/context/AuthContext";
import { LaupayScreenLoader } from "@/components/laupay/LaupayLoader";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "checking") {
    return <LaupayScreenLoader />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ sessionStatus: status }} />;
  }

  // Authenticated: straight through. PINs are no longer part of the login
  // path — the transaction PIN is only required when confirming a purchase
  // (and new accounts still set one during onboarding).
  return <>{children}</>;
}
