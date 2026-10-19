import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@app/context/AuthContext";
import { LaupayScreenLoader } from "@/components/laupay/LaupayLoader";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, pinReady, pinVerified } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return <LaupayScreenLoader />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ sessionStatus: status }} />;
  }

  if (pinReady === null) return <LaupayScreenLoader label="Checking account security…" />;

  // No PIN yet: an existing account created before PINs, or a fresh signup.
  // Send them to create one, remembering that they came from a normal login so
  // setup can route them straight to the dashboard afterwards.
  if (!pinReady) {
    if (location.pathname !== "/setup-pin") {
      return <Navigate to="/setup-pin" replace state={{ from: "login" }} />;
    }
    return <>{children}</>;
  }

  // Has a PIN but hasn't entered it for this session: step-up challenge first.
  if (!pinVerified && location.pathname !== "/verify-pin") {
    return <Navigate to="/verify-pin" replace />;
  }

  return <>{children}</>;
}
