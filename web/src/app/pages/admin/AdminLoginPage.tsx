import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Input } from "@app/components/ui/Input";
import { Button } from "@app/components/ui/Button";
import { useAdminAuth } from "@app/admin/AdminAuthContext";

export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const outcome = await login(email, password);
    setSubmitting(false);
    if (outcome.error) {
      setError(outcome.error.message);
      return;
    }
    navigate(outcome.mustChangePassword ? "/admin/change-password" : from, { replace: true });
  }

  return (
    <AuthShell
      variant="centered"
      eyebrow="Admin access"
      header={
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-[-.045em] text-white">
          Admin sign in
        </h1>
      }
    >
      <p className="text-sm leading-6 text-laupay-ink-muted">
        Restricted area. Authorised LAUPAY staff only.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-laupay-ink-muted">
        <Link to="/" className="font-medium text-laupay-indigo hover:underline">
          Back to LAUPAY
        </Link>
      </p>
    </AuthShell>
  );
}
