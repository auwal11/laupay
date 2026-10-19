import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@app/context/AuthContext";
import { LaupayScreenLoader } from "@/components/laupay/LaupayLoader";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, pinReady } = useAuth();
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
  // setup can route them straight to the dashboard afterwards. A user who
  // already has a PIN goes straight through — they are not asked to re-enter
  // it at login.
  if (!pinReady) {
    if (location.pathname !== "/setup-pin") {
      return <Navigate to="/setup-pin" replace state={{ from: "login" }} />;
    }
    return <>{children}</>;
  }

  return <>{children}</>;
}
