import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { LaupayScreenLoader } from "@/components/laupay/LaupayLoader";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "checking") {
    return <LaupayScreenLoader />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ sessionStatus: status }} />;
  }

  return <>{children}</>;
}
