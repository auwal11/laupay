import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { Route } from 'react-router-dom';
import { useAuth } from '@app/context/AuthContext';
import { ProtectedRoute } from '@app/routes/ProtectedRoute';
import { AppShellLayout } from '@app/layouts/AppShellLayout';
// Route-level screens are loaded on demand so the public landing page does
// not download the entire customer and admin application upfront.
// Customer screens are declared below with lazy imports.
// Admin and support screens are declared below with lazy imports.
import { AdminLayout } from '@app/admin/AdminLayout';
import { AdminProtectedRoute } from '@app/admin/AdminProtectedRoute';

const lazyNamed = (loader: () => Promise<any>, exportName: string) =>
  lazy(async () => ({ default: (await loader())[exportName] }));

const LoginPage = lazyNamed(() => import('@app/pages/auth/LoginPage'), 'LoginPage');
const RegisterPage = lazyNamed(() => import('@app/pages/auth/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyNamed(() => import('@app/pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const VerifyOtpPage = lazyNamed(() => import('@app/pages/auth/VerifyOtpPage'), 'VerifyOtpPage');
const ResetPasswordPage = lazyNamed(() => import('@app/pages/auth/ResetPasswordPage'), 'ResetPasswordPage');
const SetupPinPage = lazyNamed(() => import('@app/pages/auth/SetupPinPage'), 'SetupPinPage');
const RegisterSuccessPage = lazyNamed(() => import('@app/pages/auth/RegisterSuccessPage'), 'RegisterSuccessPage');
const TermsPage = lazyNamed(() => import('@app/pages/legal/LegalPage'), 'TermsPage');
const PrivacyPage = lazyNamed(() => import('@app/pages/legal/LegalPage'), 'PrivacyPage');
const DashboardPage = lazyNamed(() => import('@app/pages/customer/DashboardPage'), 'DashboardPage');
const AgentDashboardPage = lazyNamed(() => import('@app/pages/agent/AgentDashboardPage'), 'AgentDashboardPage');
const WalletPage = lazyNamed(() => import('@app/pages/customer/WalletPage'), 'WalletPage');
const AirtimePage = lazyNamed(() => import('@app/pages/customer/AirtimePage'), 'AirtimePage');
const DataPage = lazyNamed(() => import('@app/pages/customer/DataPage'), 'DataPage');
const TransactionsPage = lazyNamed(() => import('@app/pages/customer/TransactionsPage'), 'TransactionsPage');
const TransactionDetailPage = lazyNamed(() => import('@app/pages/customer/TransactionDetailPage'), 'TransactionDetailPage');
const ReceiptPage = lazyNamed(() => import('@app/pages/customer/ReceiptPage'), 'ReceiptPage');
const ProfilePage = lazyNamed(() => import('@app/pages/customer/ProfilePage'), 'ProfilePage');
const SecurityPage = lazyNamed(() => import('@app/pages/customer/SecurityPage'), 'SecurityPage');
const BeneficiariesPage = lazyNamed(() => import('@app/pages/customer/BeneficiariesPage'), 'BeneficiariesPage');
const WithdrawPage = lazyNamed(() => import('@app/pages/customer/WithdrawPage'), 'WithdrawPage');
const AdminLoginPage = lazyNamed(() => import('@app/pages/admin/AdminLoginPage'), 'AdminLoginPage');
const AdminOverviewPage = lazyNamed(() => import('@app/pages/admin/AdminOverviewPage'), 'AdminOverviewPage');
const AdminUsersPage = lazyNamed(() => import('@app/pages/admin/AdminUsersPage'), 'AdminUsersPage');
const AdminUserDetailPage = lazyNamed(() => import('@app/pages/admin/AdminUserDetailPage'), 'AdminUserDetailPage');
const AdminTransactionsPage = lazyNamed(() => import('@app/pages/admin/AdminTransactionsPage'), 'AdminTransactionsPage');
const AdminTransactionDetailPage = lazyNamed(() => import('@app/pages/admin/AdminTransactionDetailPage'), 'AdminTransactionDetailPage');
const AdminWalletsPage = lazyNamed(() => import('@app/pages/admin/AdminWalletsPage'), 'AdminWalletsPage');
const AdminOrdersPage = lazyNamed(() => import('@app/pages/admin/AdminOrdersPage'), 'AdminOrdersPage');
const AdminOrderDetailPage = lazyNamed(() => import('@app/pages/admin/AdminOrderDetailPage'), 'AdminOrderDetailPage');
const AdminDisputeDetailPage = lazyNamed(() => import('@app/pages/admin/AdminDisputeDetailPage'), 'AdminDisputeDetailPage');
const AdminReportsPage = lazyNamed(() => import('@app/pages/admin/AdminReportsPage'), 'AdminReportsPage');
const AdminAuditPage = lazyNamed(() => import('@app/pages/admin/AdminAuditPage'), 'AdminAuditPage');
const AdminSettingsPage = lazyNamed(() => import('@app/pages/admin/AdminSettingsPage'), 'AdminSettingsPage');
const AdminDisputesPage = lazyNamed(() => import('@app/pages/admin/AdminDisputesPage'), 'AdminDisputesPage');
const AdminWithdrawalsPage = lazyNamed(() => import('@app/pages/admin/AdminWithdrawalsPage'), 'AdminWithdrawalsPage');
const AdminWithdrawalDetailPage = lazyNamed(() => import('@app/pages/admin/AdminWithdrawalDetailPage'), 'AdminWithdrawalDetailPage');
const AdminSupportPage = lazyNamed(() => import('@app/pages/admin/AdminSupportPage'), 'AdminSupportPage');
const AdminChangePasswordPage = lazyNamed(() => import('@app/pages/admin/AdminChangePasswordPage'), 'AdminChangePasswordPage');
const SupportPage = lazyNamed(() => import('@app/pages/support/SupportPage'), 'SupportPage');

function page(Component: ComponentType) {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/60" aria-label="Loading page" />}>
      <Component />
    </Suspense>
  );
}

function RoleAwareDashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'agent' ? page(AgentDashboardPage) : page(DashboardPage);
}

/**
 * Authenticated app routes, spread into the landing page's own <Routes>.
 * "/" stays owned by the marketing landing page.
 */
export const appRoutes = (
  <>
    <Route path="/login" element={page(LoginPage)} />
    <Route path="/register" element={page(RegisterPage)} />
    <Route path="/forgot-password" element={page(ForgotPasswordPage)} />
    <Route path="/verify-otp" element={page(VerifyOtpPage)} />
    <Route path="/reset-password" element={page(ResetPasswordPage)} />
    <Route path="/terms" element={page(TermsPage)} />
    <Route path="/privacy" element={page(PrivacyPage)} />
    <Route path="/support" element={page(SupportPage)} />
    <Route path="/register-success" element={<ProtectedRoute>{page(RegisterSuccessPage)}</ProtectedRoute>} />
    <Route path="/setup-pin" element={<ProtectedRoute>{page(SetupPinPage)}</ProtectedRoute>} />
    <Route
      path="/app"
      element={
        <ProtectedRoute>
          <AppShellLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<RoleAwareDashboard />} />
      <Route path="wallet" element={page(WalletPage)} />
      <Route path="airtime" element={page(AirtimePage)} />
      <Route path="data" element={page(DataPage)} />
      <Route path="transactions" element={page(TransactionsPage)} />
      <Route path="transactions/:id" element={page(TransactionDetailPage)} />
      <Route path="receipt/:id" element={page(ReceiptPage)} />
      <Route path="profile" element={page(ProfilePage)} />
      <Route path="security" element={page(SecurityPage)} />
      <Route path="beneficiaries" element={page(BeneficiariesPage)} />
      <Route path="withdraw" element={page(WithdrawPage)} />
      <Route path="support" element={page(SupportPage)} />
    </Route>

    {/* Admin console — its own session, isolated from the customer app. */}
    <Route path="/admin/login" element={page(AdminLoginPage)} />
    <Route
      path="/admin"
      element={
        <AdminProtectedRoute>
          <AdminLayout />
        </AdminProtectedRoute>
      }
    >
      <Route index element={page(AdminOverviewPage)} />
      <Route path="change-password" element={page(AdminChangePasswordPage)} />
      <Route path="users" element={page(AdminUsersPage)} />
      <Route path="users/:id" element={page(AdminUserDetailPage)} />
      <Route path="transactions" element={page(AdminTransactionsPage)} />
      <Route path="transactions/:id" element={page(AdminTransactionDetailPage)} />
      <Route path="wallets" element={page(AdminWalletsPage)} />
      <Route path="orders" element={page(AdminOrdersPage)} />
      <Route path="orders/:id" element={page(AdminOrderDetailPage)} />
      <Route path="disputes" element={page(AdminDisputesPage)} />
      <Route path="disputes/:id" element={page(AdminDisputeDetailPage)} />
      <Route path="withdrawals" element={page(AdminWithdrawalsPage)} />
      <Route path="withdrawals/:id" element={page(AdminWithdrawalDetailPage)} />
      <Route path="reports" element={page(AdminReportsPage)} />
      <Route path="audit" element={page(AdminAuditPage)} />
      <Route path="settings" element={page(AdminSettingsPage)} />
      <Route path="support" element={page(AdminSupportPage)} />
    </Route>
  </>
);

export default appRoutes;
