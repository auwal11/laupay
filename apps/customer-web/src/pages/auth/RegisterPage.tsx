import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!termsAccepted) { setError("Please agree to the Terms of Service and Privacy Policy to continue."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSubmitting(true);
    setError(null);
    const failure = await register({ fullName, email, phone, password, confirmPassword, termsAccepted: true, termsVersion: "2026-10-15" });
    setSubmitting(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    navigate("/verify-otp", { replace: true, state: { email } });
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-lg font-semibold text-laupay-ink">Create your account</h1>
      <p className="mt-1 text-sm text-laupay-ink-muted">Set up LAUPAY in a couple of minutes.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <fieldset disabled={submitting} className="contents">
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <Input
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label className="flex items-start gap-2 text-sm text-laupay-ink-muted"><input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-laupay-indigo" /> <span>I agree to the <Link to="/terms" className="font-medium text-laupay-indigo underline">Terms of Service</Link> and <Link to="/privacy" className="font-medium text-laupay-indigo underline">Privacy Policy</Link>.</span></label>
        {!termsAccepted && error?.includes("Terms") && <p role="alert" className="text-sm font-medium text-laupay-danger">{error}</p>}
        {error && !error.includes("Terms") && (
          <p role="alert" className="text-sm font-medium text-laupay-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth loading={submitting} loadingLabel="Creating account…">
          {submitting ? "Creating account…" : "Create account"}
        </Button>
        </fieldset>
      </form>

      <p className="mt-5 text-center text-sm text-laupay-ink-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-laupay-indigo hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
