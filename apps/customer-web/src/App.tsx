import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AppShellLayout } from "@/layouts/AppShellLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { VerifyOtpPage } from "@/pages/auth/VerifyOtpPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { LegalPage } from "@/pages/legal/LegalPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { DashboardPage } from "@/pages/customer/DashboardPage";
import { AgentDashboardPage } from "@/pages/agent/AgentDashboardPage";
import { WalletPage } from "@/pages/customer/WalletPage";
import { AirtimePage } from "@/pages/customer/AirtimePage";
import { DataPage } from "@/pages/customer/DataPage";
import { TransactionsPage } from "@/pages/customer/TransactionsPage";
import { TransactionDetailPage } from "@/pages/customer/TransactionDetailPage";
import { ReceiptPage } from "@/pages/customer/ReceiptPage";
import { ProfilePage } from "@/pages/customer/ProfilePage";
import { SecurityPage } from "@/pages/customer/SecurityPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

/**
 * NOTE FOR INTEGRATION: this router intentionally does NOT define "/" —
 * the existing marketing landing page already owns that route in the real
 * repo. This shell only adds /login, /register, /forgot-password, and
 * everything under /app/*. See INTEGRATION.md for how to merge this into
 * the real router instead of replacing it.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShellLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleAwareDashboard />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="airtime" element={<AirtimePage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="transactions/:id" element={<TransactionDetailPage />} />
            <Route path="receipt/:id" element={<ReceiptPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="security" element={<SecurityPage />} />
          </Route>

          {/* Placeholder root: real repo should keep its existing landing page here. */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function RoleAwareDashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "agent" ? <AgentDashboardPage /> : <DashboardPage />;
}
