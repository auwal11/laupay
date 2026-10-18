import { Route } from 'react-router-dom';
import { useAuth } from '@app/context/AuthContext';
import { ProtectedRoute } from '@app/routes/ProtectedRoute';
import { AppShellLayout } from '@app/layouts/AppShellLayout';
import { LoginPage } from '@app/pages/auth/LoginPage';
import { RegisterPage } from '@app/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@app/pages/auth/ForgotPasswordPage';
import { VerifyOtpPage } from '@app/pages/auth/VerifyOtpPage';
import { ResetPasswordPage } from '@app/pages/auth/ResetPasswordPage';
import { DashboardPage } from '@app/pages/customer/DashboardPage';
import { AgentDashboardPage } from '@app/pages/agent/AgentDashboardPage';
import { WalletPage } from '@app/pages/customer/WalletPage';
import { AirtimePage } from '@app/pages/customer/AirtimePage';
import { DataPage } from '@app/pages/customer/DataPage';
import { TransactionsPage } from '@app/pages/customer/TransactionsPage';
import { TransactionDetailPage } from '@app/pages/customer/TransactionDetailPage';
import { ReceiptPage } from '@app/pages/customer/ReceiptPage';
import { ProfilePage } from '@app/pages/customer/ProfilePage';
import { SecurityPage } from '@app/pages/customer/SecurityPage';

function RoleAwareDashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'agent' ? <AgentDashboardPage /> : <DashboardPage />;
}

/**
 * Authenticated app routes, spread into the landing page's own <Routes>.
 * "/" stays owned by the marketing landing page.
 */
export const appRoutes = (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/verify-otp" element={<VerifyOtpPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
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
  </>
);

export default appRoutes;
