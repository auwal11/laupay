import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/services";

export function VerifyOtpPage() {
  const email = (useLocation().state as { email?: string } | null)?.email ?? "";
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (!cooldown) return; const timer = window.setInterval(() => setCooldown((v) => v - 1), 1000); return () => window.clearInterval(timer); }, [cooldown]);

  async function verify() {
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from your email."); return; }
    setBusy(true); setError(null);
    const failure = await verifyOtp({ email, code });
    setBusy(false);
    if (failure) { setError(failure.message); return; }
    navigate("/setup-pin", { replace: true });
  }
  async function resend() { setResending(true); setError(null); const result = await auth.resendOtp(email); setResending(false); if (!result.ok) setError(result.error.message); else setCooldown(30); }
  return <AuthLayout><h1 className="font-display text-lg font-semibold text-laupay-ink">Verify your email</h1><p className="mt-1 text-sm text-laupay-ink-muted">Enter the 6-digit code sent to {email}.</p><form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="mt-6 flex flex-col gap-4"><fieldset disabled={busy || resending} className="contents"><label className="text-sm font-medium text-laupay-ink">Email verification code<input ref={inputRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onPaste={(e) => { e.preventDefault(); setCode(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); }} className="mt-1 w-full rounded-md border border-laupay-border px-3 py-3 text-center text-xl tracking-[0.4em]" /></label>{error && <p role="alert" className="text-sm text-laupay-danger">{error}</p>}<Button type="submit" fullWidth loading={busy} loadingLabel="Verifying…">Verify code</Button></fieldset></form><button disabled={cooldown > 0 || busy || resending} onClick={() => void resend()} className="mt-5 text-sm font-medium text-laupay-indigo disabled:text-laupay-ink-muted">{resending ? "Sending…" : cooldown ? `Resend code in ${cooldown}s` : "Resend code"}</button></AuthLayout>;
}
