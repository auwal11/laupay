import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

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
    <AuthLayout>
      <h1 className="font-display text-lg font-semibold text-laupay-ink">Log in</h1>
      <p className="mt-1 text-sm text-laupay-ink-muted">Welcome back to your LAUPAY account.</p>

      {sessionNotice && (
        <p className="mt-4 rounded-md bg-laupay-amber-soft px-3 py-2 text-sm text-laupay-ink">
          {sessionNotice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <fieldset disabled={submitting} className="contents">
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
          <p role="alert" className="text-sm font-medium text-laupay-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth loading={submitting} loadingLabel="Signing in…">
          {submitting ? "Logging in…" : "Log in"}
        </Button>
        </fieldset>
      </form>

      <div className="mt-5 flex justify-between text-sm">
        <Link to="/forgot-password" className="font-medium text-laupay-indigo hover:underline">
          Forgot password?
        </Link>
        <Link to="/register" className="font-medium text-laupay-indigo hover:underline">
          Create account
        </Link>
      </div>
    </AuthLayout>
  );
}
