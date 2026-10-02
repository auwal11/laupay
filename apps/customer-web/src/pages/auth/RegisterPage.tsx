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
  const [role, setRole] = useState<Role>("customer");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const failure = await register({ fullName, email, phone, password, role });
    setSubmitting(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    navigate("/app", { replace: true });
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-lg font-semibold text-laupay-ink">Create your account</h1>
      <p className="mt-1 text-sm text-laupay-ink-muted">Set up LAUPAY in a couple of minutes.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
