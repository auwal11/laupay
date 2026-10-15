import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types/common";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profilePhotoData, setProfilePhotoData] = useState<string | undefined>();
  const [role, setRole] = useState<Role>("customer");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSubmitting(true);
    setError(null);
    const failure = await register({ fullName, email, phone, password, confirmPassword, role, profilePhotoData });
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
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-laupay-border p-3"><span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-laupay-surface-muted text-xs">{profilePhotoData ? <img src={profilePhotoData} alt="Profile preview" className="h-full w-full object-cover" /> : "Photo"}</span><span className="text-sm text-laupay-ink-muted">Add profile photo <span className="block text-xs">Optional · JPG, PNG or WebP up to 2MB</span></span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError("Profile photo must be 2MB or smaller."); return; } const reader = new FileReader(); reader.onload = () => setProfilePhotoData(String(reader.result)); reader.readAsDataURL(file); }} /></label>
        <div className="flex gap-2" role="radiogroup" aria-label="Account type">
          {(["customer", "agent"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={
                "flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize " +
                (role === r
                  ? "border-laupay-indigo bg-laupay-indigo text-white"
                  : "border-laupay-border bg-white text-laupay-ink-muted")
              }
            >
              {r}
            </button>
          ))}
        </div>
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
        {error && (
          <p role="alert" className="text-sm font-medium text-laupay-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
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
