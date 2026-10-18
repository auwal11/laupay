import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { auth } from "@/services";

export function ResetPasswordPage() {
  const [params] = useSearchParams(); const token = params.get("token") ?? ""; const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); if (password.length < 8 || password !== confirm) { setError(password.length < 8 ? "Password must be at least 8 characters." : "Passwords do not match."); return; } setBusy(true); const result = await auth.resetPassword(token, password); setBusy(false); if (result.ok) setMessage("Your password has been reset. You can now log in."); else setError(result.error.message); }
  return <AuthLayout><h1 className="font-display text-lg font-semibold text-laupay-ink">Set a new password</h1>{message ? <><p className="mt-3 text-sm text-laupay-ink-muted">{message}</p><Link className="mt-5 inline-block text-sm font-medium text-laupay-indigo" to="/login">Back to login</Link></> : <form onSubmit={submit} className="mt-6 flex flex-col gap-4"><fieldset disabled={busy} className="contents"><Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /><Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />{error && <p role="alert" className="text-sm text-laupay-danger">{error}</p>}<Button type="submit" fullWidth loading={busy} loadingLabel="Resetting…">Reset password</Button></fieldset></form>}</AuthLayout>;
}
