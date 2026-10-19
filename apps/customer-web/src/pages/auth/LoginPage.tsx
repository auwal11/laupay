import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { LoginIllustration } from "@/components/auth/LoginIllustration";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout visual={<LoginIllustration />}>
      <h1 className="font-display text-2xl font-extrabold tracking-[-.045em] text-laupay-ink">Log in</h1>
      <p className="mt-1 text-sm text-laupay-ink-muted">Welcome back to your LAUPAY account.</p>

      {sessionNotice && (
        <p className="mt-4 rounded-md bg-laupay-amber-soft px-3 py-2 text-sm text-laupay-ink">
          {sessionNotice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
        <fieldset disabled={submitting} className="contents">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          placeholder="you@example.com"
          className="pl-10"
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="relative"><LockKeyhole size={17} className="pointer-events-none absolute left-3 top-[2.15rem] z-10 text-laupay-ink-muted" /><Input
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          placeholder="Enter your password"
          className="px-10"
          onChange={(e) => setPassword(e.target.value)}
          required
        /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2.5 top-[2rem] z-10 rounded p-1 text-laupay-ink-muted">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
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
