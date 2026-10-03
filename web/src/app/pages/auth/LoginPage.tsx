import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Input } from "@app/components/ui/Input";
import { Button } from "@app/components/ui/Button";
import { useAuth } from "@app/context/AuthContext";

const SESSION_MESSAGES: Record<string, string> = {
  session_expired: "Your session expired. Please log in again.",
  session_revoked: "You were signed out for your security. Please log in again.",
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionNotice =
    SESSION_MESSAGES[(location.state as { sessionStatus?: string } | null)?.sessionStatus ?? ""];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const failure = await login({ email, password });
    setSubmitting(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    navigate("/app", { replace: true });
  }

  return (
    <AuthShell variant="split" eyebrow="Welcome back">
      <h1 className="font-display text-2xl font-extrabold tracking-[-.045em] text-laupay-ink">
        Log in
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-laupay-ink-muted">
        Welcome back to your LAUPAY account.
      </p>

      {sessionNotice && (
        <p
          role="status"
          className="mt-5 flex items-start gap-2.5 rounded-lg border border-laupay-amber-soft bg-laupay-amber-soft/45 px-3.5 py-3 text-sm leading-6 text-laupay-ink"
        >
          <span
            aria-hidden="true"
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-laupay-amber"
          />
          {sessionNotice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
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
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        <Link
          to="/forgot-password"
          className="font-medium text-laupay-indigo transition-colors hover:text-laupay-indigo-soft hover:underline"
        >
          Forgot password?
        </Link>
        <Link
          to="/register"
          className="font-medium text-laupay-indigo transition-colors hover:text-laupay-indigo-soft hover:underline"
        >
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}
