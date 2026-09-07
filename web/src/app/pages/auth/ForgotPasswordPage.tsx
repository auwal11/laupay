import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "@app/layouts/AuthLayout";
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

  if (sent) {
    return (
      <AuthLayout>
        <h1 className="font-display text-lg font-semibold text-laupay-ink">Check your email</h1>
        <p className="mt-2 text-sm text-laupay-ink-muted">
          If an account exists for {email}, we've sent a link to reset your password.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-medium text-laupay-indigo hover:underline"
        >
          Back to log in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-lg font-semibold text-laupay-ink">Reset your password</h1>
      <p className="mt-1 text-sm text-laupay-ink-muted">
        Enter your email and we'll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-laupay-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <Link to="/login" className="mt-5 inline-block text-sm font-medium text-laupay-indigo hover:underline">
        Back to log in
      </Link>
    </AuthLayout>
  );
}
