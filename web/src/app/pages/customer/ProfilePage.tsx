import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@app/components/ui/Card";
import { Button } from "@app/components/ui/Button";
import { useAuth } from "@app/context/AuthContext";
import { users } from "@app/services";
import { assetUrl } from "@app/lib/assets";
import { compressProfileImage } from "@app/lib/image";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
  }, [user]);

  if (!user) return null;

  async function saveProfile() {
    const normalizedPhone = normalizeNgPhone(phone);
    if (!fullName.trim() || (phone.trim() && !normalizedPhone)) {
      setMessage("Enter your name and a valid Nigerian phone number.");
      return;
    }
    setSaving(true); setMessage(null);
    const result = await users.updateProfile({ fullName: fullName.trim(), ...(normalizedPhone ? { phone: normalizedPhone } : {}) });
    if (result.ok) { await refreshUser(); setMessage("Profile details saved."); } else setMessage(result.error.message);
    setSaving(false);
  }

  async function uploadPhoto(file: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage("Choose a JPG, PNG or WebP image under 10 MB.");
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const data = await compressProfileImage(file);
      const result = await users.updateProfile({ profilePhotoData: data });
      if (result.ok) { await refreshUser(); setMessage("Profile photo updated."); } else setMessage(result.error.message);
    } catch {
      setMessage("We could not read that image. Try a different photo.");
    }
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
          {user.profilePhotoUrl ? <img src={assetUrl(user.profilePhotoUrl)} alt="Profile" className="h-16 w-16 rounded-full object-cover ring-2 ring-laupay-amber/40" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-laupay-indigo text-lg font-extrabold text-white ring-2 ring-laupay-amber/40">{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); e.currentTarget.value = ""; }} />
            <Button type="button" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Saving…" : user.profilePhotoUrl ? "Change photo" : "Add photo"}</Button>
            {user.profilePhotoUrl && <Button type="button" variant="ghost" disabled={busy} onClick={() => void removePhoto()}>Remove</Button>}
          </div>
        </div>
        {message && <p className="mb-4 text-sm text-laupay-ink-muted" role="status">{message}</p>}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-laupay-ink">Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5 w-full rounded-lg border border-laupay-border px-3 py-2.5 text-sm outline-none focus:border-laupay-indigo" /></label>
          <label className="text-sm font-medium text-laupay-ink">Email<input value={user.email.toLowerCase()} readOnly className="mt-1.5 w-full rounded-lg border border-laupay-border bg-laupay-surface-muted px-3 py-2.5 text-sm text-laupay-ink-muted" /></label>
          <label className="text-sm font-medium text-laupay-ink">Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" inputMode="tel" className="mt-1.5 w-full rounded-lg border border-laupay-border px-3 py-2.5 text-sm outline-none focus:border-laupay-indigo" /></label>
          <Button type="button" onClick={() => void saveProfile()} loading={saving}>Save profile</Button>
        </div>
        <Row label="Account type" value="Customer" />
      </Card>

      <Link
        to="/app/beneficiaries"
        className="rounded-lg border border-laupay-border bg-white px-4 py-3.5 text-sm font-medium text-laupay-ink hover:border-laupay-indigo"
      >
        Beneficiaries — saved numbers for airtime and data
      </Link>

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

function normalizeNgPhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  if (!compact) return "";
  if (/^0[789]\d{9}$/.test(compact)) return compact;
  if (/^\+234[789]\d{9}$/.test(compact)) return `0${compact.slice(4)}`;
  return "";
}
