import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Input } from "@app/components/ui/Input";
import { Button } from "@app/components/ui/Button";
import { useAuth } from "@app/context/AuthContext";

type Step = 1 | 2;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function continueDetails() {
    setError(null);
    const normalizedPhone = phone.replace(/[\s()-]/g, "");
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (!/^(?:\+234|0)[789]\d{9}$/.test(normalizedPhone)) return setError("Enter a valid Nigerian phone number.");
    setStep(2);
  }

  async function createAccount() {
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return setError("Use at least 8 characters with upper-case, lower-case and a number.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!termsAccepted) return setError("Please agree to the Terms of Service and Privacy Policy to continue.");
    setSubmitting(true);
    const failure = await register({ fullName, email, phone, password, confirmPassword, termsAccepted: true, termsVersion: "2026-10-19" });
    setSubmitting(false);
    if (failure) return setError(failure.message);
    navigate("/verify-otp", { replace: true, state: { email } });
  }

  return (
    <AuthShell variant="centered">
      <div className="mb-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-laupay-indigo">Step {step} of 5</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-laupay-ink">Create your LAUPAY account</h1>
        <p className="mt-2 text-sm leading-6 text-laupay-ink-muted">A few steps to get you set up securely.</p>
      </div>
      <Progress step={step} />
      {step === 1 ? <div className="flex flex-col gap-4">
        <Input label="Full name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Phone number" type="tel" autoComplete="tel" placeholder="0801 234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button type="button" fullWidth onClick={continueDetails}>Continue</Button>
      </div> : <form onSubmit={(e) => { e.preventDefault(); void createAccount(); }} className="flex flex-col gap-4">
        <Input label="Password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="-mt-2 text-xs text-laupay-ink-muted">At least 8 characters, with upper-case, lower-case and a number.</p>
        <Input label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <label className="flex items-start gap-2 text-sm text-laupay-ink-muted"><input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-laupay-indigo" /><span>I agree to the <Link to="/terms" className="font-medium text-laupay-indigo underline">Terms of Service</Link> and <Link to="/privacy" className="font-medium text-laupay-indigo underline">Privacy Policy</Link>.</span></label>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => { setError(null); setStep(1); }} disabled={submitting}>Back</Button><Button type="submit" fullWidth loading={submitting}>{submitting ? "Creating account…" : "Continue"}</Button></div>
        <p className="text-center text-xs text-laupay-ink-muted">LAUPAY · Ibrahim Lau Provision Shop</p>
      </form>}
      <p className="mt-6 border-t border-laupay-border pt-5 text-center text-sm text-laupay-ink-muted">Already have an account? <Link to="/login" className="font-medium text-laupay-indigo hover:underline">Log in</Link></p>
    </AuthShell>
  );
}

function Progress({ step }: { step: number }) { return <div className="mb-5 flex gap-2" aria-label={`Registration step ${step} of 5`}>{[1, 2, 3, 4, 5].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? "bg-laupay-amber" : "bg-laupay-border"}`} />)}</div>; }
function ErrorMessage({ children }: { children: string }) { return <p role="alert" className="rounded-lg border border-laupay-danger/25 bg-laupay-danger/[.06] px-3.5 py-2.5 text-sm font-medium text-laupay-danger">{children}</p>; }
