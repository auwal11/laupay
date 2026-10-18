import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
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

  if (pinReady === false && location.pathname !== "/setup-pin") {
    return <Navigate to="/setup-pin" replace />;
  }

  return <>{children}</>;
}
