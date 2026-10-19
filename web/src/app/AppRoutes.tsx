import { Route } from 'react-router-dom';
import { useAuth } from '@app/context/AuthContext';
import { ProtectedRoute } from '@app/routes/ProtectedRoute';
import { AppShellLayout } from '@app/layouts/AppShellLayout';
import { LoginPage } from '@app/pages/auth/LoginPage';
import { RegisterPage } from '@app/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@app/pages/auth/ForgotPasswordPage';
import { VerifyOtpPage } from '@app/pages/auth/VerifyOtpPage';
import { ResetPasswordPage } from '@app/pages/auth/ResetPasswordPage';
import { SetupPinPage } from '@app/pages/auth/SetupPinPage';
import { RegisterSuccessPage } from '@app/pages/auth/RegisterSuccessPage';
import { PrivacyPage, TermsPage } from '@app/pages/legal/LegalPage';
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
import { AdminLoginPage } from '@app/pages/admin/AdminLoginPage';
import { AdminOverviewPage } from '@app/pages/admin/AdminOverviewPage';
import { AdminUsersPage } from '@app/pages/admin/AdminUsersPage';
import { AdminUserDetailPage } from '@app/pages/admin/AdminUserDetailPage';
import { AdminTransactionsPage } from '@app/pages/admin/AdminTransactionsPage';
import { AdminTransactionDetailPage } from '@app/pages/admin/AdminTransactionDetailPage';
import { AdminWalletsPage } from '@app/pages/admin/AdminWalletsPage';
import { AdminOrdersPage } from '@app/pages/admin/AdminOrdersPage';
import { AdminAuditPage } from '@app/pages/admin/AdminAuditPage';
import { AdminSettingsPage } from '@app/pages/admin/AdminSettingsPage';
import { AdminDisputesPage } from '@app/pages/admin/AdminDisputesPage';
import { AdminLayout } from '@app/admin/AdminLayout';
import { AdminProtectedRoute } from '@app/admin/AdminProtectedRoute';

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
    <Route path="/terms" element={<TermsPage />} />
    <Route path="/privacy" element={<PrivacyPage />} />
    <Route path="/register-success" element={<ProtectedRoute><RegisterSuccessPage /></ProtectedRoute>} />
    <Route path="/setup-pin" element={<ProtectedRoute><SetupPinPage /></ProtectedRoute>} />
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

    {/* Admin console — its own session, isolated from the customer app. */}
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route
      path="/admin"
      element={
        <AdminProtectedRoute>
          <AdminLayout />
        </AdminProtectedRoute>
      }
    >
      <Route index element={<AdminOverviewPage />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="users/:id" element={<AdminUserDetailPage />} />
      <Route path="transactions" element={<AdminTransactionsPage />} />
      <Route path="transactions/:id" element={<AdminTransactionDetailPage />} />
      <Route path="wallets" element={<AdminWalletsPage />} />
      <Route path="orders" element={<AdminOrdersPage />} />
      <Route path="disputes" element={<AdminDisputesPage />} />
      <Route path="audit" element={<AdminAuditPage />} />
      <Route path="settings" element={<AdminSettingsPage />} />
    </Route>
  </>
);

export default appRoutes;
