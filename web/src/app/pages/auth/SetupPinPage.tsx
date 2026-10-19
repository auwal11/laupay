import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Button } from "@app/components/ui/Button";
import { PinPad } from "@app/components/security/PinPad";
import { security } from "@app/services";
import { useAuth } from "@app/context/AuthContext";

export function SetupPinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshPin } = useAuth();
  const [first, setFirst] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    if (first.length !== 4 || confirm.length !== 4) return setError("Enter and confirm your 4-digit PIN.");
    if (first !== confirm) return setError("PINs do not match.");
    if (/^(\d)\1{3}$/.test(first) || first === "1234" || first === "4321") return setError("Choose a less predictable PIN.");
    setBusy(true);
    const result = await security.createPin(first);
    if (!result.ok) { setBusy(false); return setError(result.error.message); }
    await refreshPin();
    setBusy(false);
    // Existing users who came from a normal login go straight to the dashboard;
    // the onboarding flow keeps its final "all set" confirmation step.
    const fromLogin = (location.state as { from?: string } | null)?.from === "login";
    navigate(fromLogin ? "/app" : "/register-success", { replace: true });
  }

  return <AuthShell variant="centered" eyebrow="Step 4 of 5" header={<><h1 className="mt-4 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-white">Create your transaction PIN</h1><p className="mt-2 text-sm leading-6 text-white/65">You’ll use this PIN to confirm purchases on LAUPAY.</p></>}>
    <Progress />
    <div className="flex flex-col gap-5"><PinPad label="Enter a 4-digit PIN" disabled={busy} onComplete={setFirst} /><PinPad label="Confirm your 4-digit PIN" disabled={busy} onComplete={setConfirm} /><Button fullWidth loading={busy} onClick={() => void save()}>{busy ? "Saving PIN…" : "Save PIN"}</Button>{error && <p role="alert" className="text-center text-sm font-medium text-laupay-danger">{error}</p>}</div>
  </AuthShell>;
}

function Progress() { return <div className="mb-5 flex gap-2" aria-label="Registration step 4 of 5">{[1, 2, 3, 4, 5].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= 4 ? "bg-laupay-amber" : "bg-laupay-border"}`} />)}</div>; }
