import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Button } from "@app/components/ui/Button";
import { useAuth } from "@app/context/AuthContext";

/**
 * Post-registration email verification. Reached from RegisterPage with the
 * account email in router state; successful verification opens mandatory PIN setup.
 */
export function VerifyOtpPage() {
  const email = (useLocation().state as { email?: string } | null)?.email ?? "";
  const navigate = useNavigate();
  const { verifyOtp } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((v) => v - 1), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await verifyOtp({ email, code });
    setBusy(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    navigate("/setup-pin", { replace: true });
  }

  async function resend() {
    setError(null);
    setResending(true);
    const { auth } = await import("@app/services");
    const result = await auth.resendOtp(email);
    setResending(false);
    if (!result.ok) setError(result.error.message);
    else setCooldown(60);
  }

  return (
    <AuthShell
      variant="centered"
      eyebrow="Step 3 of 5"
      header={
        <>
          <h1 className="mt-4 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-white">
            Verify your email
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
          Enter the 6-digit code we sent to {maskEmail(email)}.
          </p>
        </>
      }
    >
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void verify();
        }}
        className="flex flex-col gap-4"
      >
        <Progress />
        <p className="text-center text-xs text-laupay-ink-muted">This code expires in 10 minutes.</p>
        <label className="text-sm font-medium text-laupay-ink">
          Email verification code
          <input
            ref={inputRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            disabled={busy}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onPaste={(e) => {
              e.preventDefault();
              setCode(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6));
            }}
            className="mt-1 w-full rounded-lg border border-laupay-border bg-white px-3 py-3 text-center text-xl tracking-[0.4em] text-laupay-ink outline-none transition-colors focus-visible:border-laupay-indigo"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-laupay-danger/25 bg-laupay-danger/[.06] px-3.5 py-2.5 text-sm font-medium text-laupay-danger"
          >
            {error}
          </p>
        )}
        <Button type="submit" fullWidth loading={busy} className="mt-1 py-3">
          {busy ? "Verifying…" : "Verify code"}
        </Button>
      </form>

      <button
        type="button"
        disabled={cooldown > 0 || busy || resending}
        onClick={() => void resend()}
        className="mt-5 w-full text-center text-sm font-medium text-laupay-indigo transition-colors hover:text-laupay-indigo-soft disabled:text-laupay-ink-muted"
      >
        {resending ? "Sending…" : cooldown ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>

      <p className="mt-6 border-t border-laupay-border pt-5 text-center text-sm text-laupay-ink-muted">
        Already verified?{" "}
        <Link
          to="/login"
          className="font-medium text-laupay-indigo transition-colors hover:text-laupay-indigo-soft hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!name || !domain) return "your email";
  return `${name.slice(0, 1)}***@${domain}`;
}

function Progress() {
  return <div className="mb-1 flex gap-2" aria-label="Registration step 3 of 5">{[1, 2, 3, 4, 5].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= 3 ? "bg-laupay-amber" : "bg-laupay-border"}`} />)}</div>;
}
