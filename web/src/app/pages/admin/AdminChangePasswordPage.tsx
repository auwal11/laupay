import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Button } from "@app/components/ui/Button";
import { Input } from "@app/components/ui/Input";
import { useAdminAuth } from "@app/admin/AdminAuthContext";
import { adminService } from "@app/admin/services";

export function AdminChangePasswordPage() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await adminService.changePassword(currentPassword, newPassword);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    // Password changes revoke existing sessions, so start a fresh admin login.
    logout();
    navigate("/admin/login", { replace: true, state: { notice: "Password changed. Sign in with your new password." } });
  }

  return (
    <AuthShell
      variant="centered"
      eyebrow="Secure your admin account"
      header={<h1 className="mt-3 font-display text-2xl font-extrabold tracking-[-.045em] text-white">Change your password</h1>}
    >
      <p className="text-sm leading-6 text-laupay-ink-muted">
        This temporary password can only be used for your first sign-in. Set a private password before continuing.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <Input label="Temporary password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        <Input label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
        {error && <p role="alert" className="rounded-lg border border-laupay-danger/25 bg-laupay-danger/[.06] px-3.5 py-2.5 text-sm font-medium text-laupay-danger">{error}</p>}
        <Button type="submit" fullWidth loading={busy} className="mt-1 py-3">{busy ? "Updating…" : "Update password"}</Button>
      </form>
    </AuthShell>
  );
}
