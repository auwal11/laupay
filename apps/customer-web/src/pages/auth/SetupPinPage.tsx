import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { PinPad } from "@/components/security/PinPad";
import { useAuth } from "@/context/AuthContext";
import { security } from "@/services";

export function SetupPinPage() {
  const navigate = useNavigate(); const { refreshPin } = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function create(pin: string) { setBusy(true); setError(null); const result = await security.createPin(pin); if (!result.ok) { setError(result.error.message); setBusy(false); return; } await refreshPin(); setBusy(false); navigate("/app", { replace: true }); }
  return <AuthLayout><h1 className="font-display text-lg font-semibold text-laupay-ink">Create your transaction PIN</h1><p className="mt-2 text-sm text-laupay-ink-muted">Your 4-digit PIN protects purchases and sensitive wallet actions. It is stored securely and never shown to us.</p><div className="mt-7"><PinPad label={busy ? "Saving your PIN…" : "Choose a 4-digit PIN"} onComplete={create} disabled={busy} error={error} /></div></AuthLayout>;
}
