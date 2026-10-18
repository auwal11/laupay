import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Button } from "@app/components/ui/Button";
import { auth } from "@app/services";

/**
 * Post-registration email verification. Reached from RegisterPage with the
 * account email in router state; on success the user is sent to /login (the
 * backend does not issue a session at verify time).
 */
export function VerifyOtpPage() {
  const email = (useLocation().state as { email?: string } | null)?.email ?? "";
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(30);
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
    const result = await auth.verifyOtp({ email, code });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    navigate("/login", { replace: true, state: { verified: true } });
  }

  async function resend() {
    setError(null);
    const result = await auth.resendOtp(email);
    if (!result.ok) setError(result.error.message);
    else setCooldown(30);
  }

  return (
    <AuthShell
      variant="centered"
      eyebrow="Verify email"
      header={
        <>
          <h1 className="mt-4 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-white">
            Verify your email
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Enter the 6-digit code we sent to {email || "your email"}.
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
        <label className="text-sm font-medium text-laupay-ink">
          Email verification code
          <input
            ref={inputRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
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
        disabled={cooldown > 0}
        onClick={() => void resend()}
        className="mt-5 w-full text-center text-sm font-medium text-laupay-indigo transition-colors hover:text-laupay-indigo-soft disabled:text-laupay-ink-muted"
      >
        {cooldown ? `Resend code in ${cooldown}s` : "Resend code"}
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
