import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@app/components/ui/Card";
import { Button } from "@app/components/ui/Button";
import { useAuth } from "@app/context/AuthContext";
import { users } from "@app/services";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!user) return null;

  async function uploadPhoto(file: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Choose a JPG, PNG or WebP image under 5 MB.");
      return;
    }
    setBusy(true); setMessage(null);
    const data = await fileToDataUrl(file);
    const result = await users.updateProfile({ profilePhotoData: data });
    if (result.ok) { await refreshUser(); setMessage("Profile photo updated."); } else setMessage(result.error.message);
    setBusy(false);
  }

  async function removePhoto() {
    setBusy(true); setMessage(null);
    const result = await users.updateProfile({ removeProfilePhoto: "true" });
    if (result.ok) { await refreshUser(); setMessage("Profile photo removed."); } else setMessage(result.error.message);
    setBusy(false);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Profile</h1>

      <Card>
        <div className="mb-5 flex items-center gap-4">
          {user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="Profile" className="h-16 w-16 rounded-full object-cover ring-2 ring-laupay-amber/40" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-laupay-indigo text-lg font-extrabold text-white ring-2 ring-laupay-amber/40">{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); e.currentTarget.value = ""; }} />
            <Button type="button" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Saving…" : user.profilePhotoUrl ? "Change photo" : "Add photo"}</Button>
            {user.profilePhotoUrl && <Button type="button" variant="ghost" disabled={busy} onClick={() => void removePhoto()}>Remove</Button>}
          </div>
        </div>
        {message && <p className="mb-4 text-sm text-laupay-ink-muted" role="status">{message}</p>}
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-laupay-ink-muted">{label}</dt>
      <dd className="font-medium capitalize text-laupay-ink">{value}</dd>
    </div>
  );
}
