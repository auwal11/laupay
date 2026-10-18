import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Input } from "@app/components/ui/Input";
import { Button } from "@app/components/ui/Button";
import { useAuth } from "@app/context/AuthContext";
import type { Role } from "@app/types/common";

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
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const failure = await register({
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      role,
      profilePhotoData,
    });
    setSubmitting(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    // The account is created PENDING_VERIFICATION and is not signed in yet —
    // verify the emailed code, then log in.
    navigate("/verify-otp", { replace: true, state: { email } });
  }

  return (
    <AuthShell
      variant="centered"
      eyebrow="Get started"
      header={
        <>
          <h1 className="mt-4 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-white">
            Create your account
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Set up LAUPAY in a couple of minutes.
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-laupay-border p-3">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-laupay-surface-muted text-xs">
            {profilePhotoData ? (
              <img src={profilePhotoData} alt="Profile preview" className="h-full w-full object-cover" />
            ) : (
              "Photo"
            )}
          </span>
          <span className="text-sm text-laupay-ink-muted">
            Add profile photo
            <span className="block text-xs">Optional · JPG, PNG or WebP up to 2MB</span>
          </span>
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setError("Profile photo must be 2MB or smaller.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setProfilePhotoData(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-laupay-ink">Account type</legend>
          <div className="flex gap-2" role="radiogroup" aria-label="Account type">
            {(["customer", "agent"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors duration-150 " +
                  (role === r
                    ? "border-laupay-indigo bg-laupay-indigo text-white shadow-raised"
                    : "border-laupay-border bg-laupay-surface-muted text-laupay-ink-muted hover:border-laupay-indigo-soft/40 hover:bg-white")
                }
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>

        <Input
          label="Full name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Phone number"
          type="tel"
          autoComplete="tel"
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
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-laupay-danger/25 bg-laupay-danger/[.06] px-3.5 py-2.5 text-sm font-medium text-laupay-danger"
          >
            {error}
          </p>
        )}
        <Button type="submit" fullWidth loading={submitting} className="mt-1 py-3">
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 border-t border-laupay-border pt-5 text-center text-sm text-laupay-ink-muted">
        Already have an account?{" "}
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
