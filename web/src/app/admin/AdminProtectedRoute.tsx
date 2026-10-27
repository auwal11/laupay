import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAdminAuth } from "./AdminAuthContext";
import { LaupayScreenLoader } from "@/components/laupay/LaupayLoader";

export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { status, session } = useAdminAuth();
  const location = useLocation();

  if (status === "checking") return <LaupayScreenLoader />;
  if (status !== "authenticated") {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  if (session?.mustChangePassword && location.pathname !== "/admin/change-password") {
    return <Navigate to="/admin/change-password" replace />;
  }
  return <>{children}</>;
}
