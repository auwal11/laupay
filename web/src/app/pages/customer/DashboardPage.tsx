import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, CreditCard, Receipt, Smartphone, Wallet, Wifi, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BalanceCard } from "@app/components/wallet/BalanceCard";
import { useAuth } from "@app/context/AuthContext";
import { firstNameFrom } from "@app/lib/name";
import { assetUrl } from "@app/lib/assets";
import type { PurchaseNotice } from "@app/types/orders";

const QUICK_ACTIONS: { to: string; icon: LucideIcon; label: string; ready: boolean }[] = [
  { to: "/app/airtime", icon: Smartphone, label: "Airtime", ready: true },
  { to: "/app/data", icon: Wifi, label: "Data", ready: true },
  { to: "/app/wallet", icon: Wallet, label: "Wallet", ready: true },
  { to: "/app/transactions", icon: CreditCard, label: "Payments", ready: true },
  { to: "/app/transactions", icon: Receipt, label: "Bills", ready: false },
];

export function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notice] = useState<PurchaseNotice | null>(
    () => (location.state as { purchaseNotice?: PurchaseNotice } | null)?.purchaseNotice ?? null,
  );
  const [noticeVisible, setNoticeVisible] = useState(Boolean(notice));

  // Consume the one-shot banner so a refresh or later visit doesn't repeat it.
  useEffect(() => {
    if (notice) navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center gap-3">
        <ProfileAvatar name={user?.fullName ?? "LAUPAY"} photo={assetUrl(user?.profilePhotoUrl)} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-laupay-ink-muted">Built for everyday payments</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-laupay-ink">Hi {firstNameFrom(user?.fullName)}</h1>
          <p className="text-sm text-laupay-ink-muted">Here's what's happening with your account.</p>
        </div>
      </div>

      {notice && noticeVisible && (
        <PurchaseNoticeBanner notice={notice} onDismiss={() => setNoticeVisible(false)} />
      )}

      <BalanceCard
        onAddFund={() => navigate("/app/wallet", { state: { openDeposit: true } })}
        onWithdraw={() => navigate("/app/withdraw")}
      />

      <Link
        to="/app/transactions"
        className="group flex min-h-[80px] w-full items-center gap-3 rounded-2xl border border-laupay-border bg-white px-4 py-3.5 shadow-card transition-all hover:border-laupay-indigo/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo active:scale-[0.99] sm:px-5"
        aria-label="Open Transaction History"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-laupay-indigo text-white shadow-sm">
          <CreditCard size={21} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-laupay-ink sm:text-[15px]">Transaction History</span>
          <span className="mt-0.5 block truncate text-xs text-laupay-ink-muted sm:text-sm">View all payments, transfers and withdrawals</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-laupay-indigo transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-laupay-ink">Quick actions</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {QUICK_ACTIONS.map((action) => (
            <QuickAction key={action.label} {...action} />
          ))}
        </div>
      </div>

    </div>
  );
}

function PurchaseNoticeBanner({ notice, onDismiss }: { notice: PurchaseNotice; onDismiss: () => void }) {
  const success = notice.tone === "success";
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${success ? "border-laupay-success/30 bg-laupay-success/10" : notice.tone === "pending" ? "border-laupay-amber/40 bg-laupay-amber/10" : "border-laupay-danger/30 bg-laupay-danger/5"}`}
    >
      <CheckCircle2 size={18} className={success ? "mt-0.5 shrink-0 text-laupay-success" : "mt-0.5 shrink-0 text-laupay-danger"} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-laupay-ink">{notice.title}</p>
        <p className="mt-0.5 text-sm text-laupay-ink-muted">{notice.body}</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="rounded p-1 text-laupay-ink-muted hover:bg-white/60">
        <X size={15} />
      </button>
    </div>
  );
}

function ProfileAvatar({ name, photo }: { name: string; photo?: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return photo ? <img src={photo} alt={`${name} profile`} className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-laupay-amber/40" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-laupay-indigo text-sm font-extrabold text-white ring-2 ring-laupay-amber/40">{initials || "L"}</span>;
}

function QuickAction({
  to,
  icon: Icon,
  label,
  ready,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  ready: boolean;
}) {
  const inner = (
    <>
      <span
        className={
          ready
            ? "flex h-10 w-10 items-center justify-center rounded-lg bg-laupay-indigo text-white"
            : "flex h-10 w-10 items-center justify-center rounded-lg bg-laupay-surface-muted text-laupay-ink-muted"
        }
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="text-xs font-semibold text-laupay-ink">{label}</span>
      {!ready && (
        <span className="rounded-full bg-laupay-amber-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8a5a00]">
          Coming soon
        </span>
      )}
    </>
  );

  if (!ready) {
    return (
      <div
        aria-disabled="true"
        className="flex cursor-not-allowed flex-col items-center gap-2 rounded-xl border border-dashed border-laupay-border bg-laupay-surface-muted/60 px-2 py-4 text-center"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2 rounded-xl border border-laupay-border bg-white px-2 py-4 shadow-card transition-colors hover:border-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
    >
      {inner}
    </Link>
  );
}
