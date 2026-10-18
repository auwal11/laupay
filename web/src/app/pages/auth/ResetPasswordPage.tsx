import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Input } from "@app/components/ui/Input";
import { Button } from "@app/components/ui/Button";
import { auth } from "@app/services";

/**
 * Landing page for the password-reset link. The backend emails a link whose
 * token arrives as ?token=…; the new password is posted back with that token.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await auth.resetPassword(token, password);
    setBusy(false);
    if (result.ok) setMessage("Your password has been reset. You can now log in.");
    else setError(result.error.message);
  }

  return (
    <AuthShell
      variant="centered"
      eyebrow="Reset password"
      header={
        <>
          <h1 className="mt-4 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-white">
            {message ? "Password updated" : "Set a new password"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            {message
              ? "You're all set — log in with your new password."
              : "Choose a new password for your LAUPAY account."}
          </p>
        </>
      }
    >
      {message ? (
        <>
          <p className="text-sm leading-6 text-laupay-ink-muted">{message}</p>
          <Link
            to="/login"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-laupay-indigo px-4 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-laupay-indigo-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
          >
            Back to log in
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {!token && (
            <p
              role="alert"
              className="rounded-lg border border-laupay-danger/25 bg-laupay-danger/[.06] px-3.5 py-2.5 text-sm font-medium text-laupay-danger"
            >
              This reset link is missing its token. Please request a new one.
            </p>
          )}
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-laupay-danger/25 bg-laupay-danger/[.06] px-3.5 py-2.5 text-sm font-medium text-laupay-danger"
            >
              {error}
            </p>
          )}
          <Button type="submit" fullWidth loading={busy} className="mt-1 py-3">
            {busy ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
