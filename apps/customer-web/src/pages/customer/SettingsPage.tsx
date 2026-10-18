import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/ui/UserAvatar";

export function SettingsPage() {
  const { user } = useAuth(); if (!user) return null;
  return <div className="mx-auto flex max-w-lg flex-col gap-5"><h1 className="font-display text-xl font-semibold text-laupay-ink">Settings</h1><Card><div className="flex items-center gap-3"><UserAvatar user={user} /><div><p className="font-semibold text-laupay-ink">{user.fullName}</p><p className="text-sm text-laupay-ink-muted">{user.email}</p></div></div><Link to="/app/profile" className="mt-5 block rounded-md border border-laupay-border px-4 py-3 text-sm font-medium text-laupay-ink hover:bg-laupay-surface-muted">Profile · Name, phone and photo</Link></Card><Card><h2 className="text-sm font-semibold text-laupay-ink">Security</h2><Link to="/app/security" className="mt-3 block rounded-md border border-laupay-border px-4 py-3 text-sm font-medium text-laupay-ink hover:bg-laupay-surface-muted">PIN, sessions and security notifications</Link></Card><Card><h2 className="text-sm font-semibold text-laupay-ink">Notifications</h2><p className="mt-2 text-sm text-laupay-ink-muted">Transaction and security notifications are shown in the bell menu. Notification preferences will be available here as the service expands.</p></Card><Card><h2 className="text-sm font-semibold text-laupay-ink">Legal</h2><p className="mt-2 text-sm text-laupay-ink-muted">LAUPAY is a service of Ibrahim Lau Provision Shop.</p><div className="mt-3 flex gap-4 text-sm font-medium text-laupay-indigo"><Link to="/terms">Terms of Service</Link><Link to="/privacy">Privacy Policy</Link></div></Card></div>;
}
