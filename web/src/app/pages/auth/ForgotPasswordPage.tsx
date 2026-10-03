import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Input } from "@app/components/ui/Input";
import { Button } from "@app/components/ui/Button";
import { auth } from "@app/services";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await auth.forgotPassword({ email });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSent(true);
  }

  const heading = (
    <>
      <h1 className="mt-4 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-white">
        {sent ? "Check your email" : "Reset your password"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-white/65">
        {sent
          ? "Your reset link is on its way."
          : "Enter your email and we'll send you a reset link."}
      </p>
    </>
  );

  return (
    <AuthShell variant="centered" eyebrow="Reset password" header={heading}>
      {sent ? (
        <>
          <p className="text-sm leading-6 text-laupay-ink-muted">
            If an account exists for{" "}
            <span className="font-medium text-laupay-ink">{email}</span>, we've sent a link to
            reset your password.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-laupay-surface-muted px-4 py-3 text-sm font-medium text-laupay-ink transition-colors duration-150 hover:bg-laupay-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
          >
            Back to log in
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          <Button type="submit" fullWidth loading={submitting} className="mt-1 py-3">
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
