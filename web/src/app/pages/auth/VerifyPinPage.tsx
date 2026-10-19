import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { PinPad } from "@app/components/security/PinPad";
import { security } from "@app/services";
import { useAuth } from "@app/context/AuthContext";

/**
 * Step-up challenge shown right after an existing user logs in (or restores a
 * session) before they can reach the dashboard. The PIN is only ever sent to
 * the backend, which decides if it is correct — this page is presentation.
 */
export function VerifyPinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { markPinVerified, logout, user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(pin: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await security.verifyPin(pin);
    if (!result.ok) {
      setBusy(false);
      setError(result.error.message || "Incorrect PIN. Please try again.");
      // Remount the pad so the previous digits are cleared for a retry.
      setAttempt((value) => value + 1);
      return;
    }
    markPinVerified(true);
    setBusy(false);
    const to = (location.state as { from?: string } | null)?.from ?? "/app";
    navigate(to, { replace: true });
  }

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <AuthShell
      variant="centered"
      eyebrow="Confirm it's you"
      header={
        <>
          <h1 className="mt-4 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-white">
            Enter your transaction PIN
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            {user?.fullName ? `Welcome back, ${user.fullName.split(" ")[0]}. ` : ""}
            Enter your 4-digit PIN to continue to your dashboard.
          </p>
        </>
      }
    >
      <div className="flex flex-col items-center gap-5">
        <PinPad
          key={attempt}
          label="Transaction PIN"
          error={error}
          disabled={busy}
          onComplete={(pin) => void submit(pin)}
        />
        {busy && (
          <p role="status" className="text-sm font-medium text-laupay-ink-muted">
            Verifying your PIN…
          </p>
        )}
        <button
          type="button"
          onClick={signOut}
          className="text-sm font-medium text-laupay-indigo transition-colors hover:text-laupay-indigo-soft hover:underline"
        >
          Log in with a different account
        </button>
      </div>
    </AuthShell>
  );
}
