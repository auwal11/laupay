import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

export function ProfilePage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Profile</h1>

      <Card>
        <dl className="flex flex-col gap-3 text-sm">
          <Row label="Name" value={user.fullName} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone} />
          <Row label="Account type" value={user.role} />
        </dl>
      </Card>

      <Link
        to="/app/security"
        className="rounded-lg border border-laupay-border bg-white px-4 py-3.5 text-sm font-medium text-laupay-ink hover:border-laupay-indigo"
      >
        Security — PIN, devices, notifications
      </Link>

      <Button variant="danger" onClick={logout} className="self-start">
        Log out
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-laupay-ink-muted">{label}</dt>
      <dd className="font-medium capitalize text-laupay-ink">{value}</dd>
    </div>
  );
}
