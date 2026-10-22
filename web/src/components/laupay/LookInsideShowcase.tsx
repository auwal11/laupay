import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, Check, Receipt, Smartphone, WalletCards, Wifi } from 'lucide-react';

type ShowcaseService = {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  amount: string;
  meta: string;
};

type ShowcaseStage = 'dashboard' | 'select' | 'process' | 'confirm';

const quickActions = [
  { key: 'airtime', label: 'Airtime', icon: Smartphone },
  { key: 'data', label: 'Data', icon: Wifi },
  { key: 'payments', label: 'Bills', icon: Receipt },
  { key: 'wallet', label: 'Wallet', icon: WalletCards },
];

const activity = [
  { label: 'Data purchase', detail: 'MTN • 10GB', amount: '-₦3,500', icon: Wifi, tint: '#91B7FF', status: 'Successful' },
  { label: 'Airtime top-up', detail: 'MTN • 0803 XXX XXXX', amount: '-₦1,000', icon: Smartphone, tint: '#F4B33F', status: 'Successful' },
  { label: 'Wallet funding', detail: 'Bank transfer', amount: '+₦10,000', icon: WalletCards, tint: '#A7C997', status: 'Successful' },
];

function StatusChip({ label, tone }: { label: string; tone: 'ok' | 'pending' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
        tone === 'ok' ? 'bg-[#DDF2E7] text-[#2E9B68]' : 'bg-[#F4B33F]/20 text-[#B17819]'
      }`}
    >
      {tone === 'ok' && <Check size={10} strokeWidth={3} />}
      {label}
    </span>
  );
}

export function LookInsideShowcase({ active, stage }: { active: ShowcaseService; stage: ShowcaseStage }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const ActiveIcon = active.icon;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const liveStatus: { label: string; tone: 'ok' | 'pending' } =
    stage === 'process' ? { label: 'Processing', tone: 'pending' } : { label: 'Successful', tone: 'ok' };

  return (
    <div ref={rootRef} className={`showcase relative mx-auto w-[min(100%,460px)]${visible ? ' is-visible' : ''}`}>
      {/* floating accents — desktop only, decorative */}
      <div
        aria-hidden
        className="showcase-item absolute -right-8 -top-7 z-10 hidden items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-[0_16px_36px_rgba(23,26,74,.12)] xl:flex"
        style={{ animation: 'bridge-drift 7s ease-in-out infinite', transitionDelay: '.35s' }}
      >
        <span className="h-2 w-2 rounded-full bg-[#2E9B68]" />
        <span className="text-[10px] font-extrabold">Data purchase • Successful</span>
      </div>
      {/* main dashboard panel */}
      <div className="showcase-item relative overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_28px_70px_rgba(23,26,74,.14)]" style={{ transitionDelay: '.05s' }}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F4B33F]" />
            <span className="font-display text-sm font-extrabold tracking-[-.03em]">LAUPAY Dashboard</span>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">Example</span>
        </div>

        <div className="grid gap-5 p-6 sm:p-7">
          {/* balance */}
          <div className="showcase-item relative overflow-hidden rounded-2xl bg-[#171A4A] p-6 text-white" style={{ transitionDelay: '.12s' }}>
            <div aria-hidden className="absolute -right-12 -top-14 h-40 w-40 rounded-full border border-white/10" />
            <div aria-hidden className="absolute -bottom-16 -left-10 h-36 w-36 rounded-full border border-[#F4B33F]/20" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-white/55">Available balance</p>
                <p className="mt-2 font-display text-[2rem] font-extrabold leading-none tracking-[-.05em]">₦125,450.00</p>
                <p className="mt-2 text-[9px] font-semibold text-white/40">Illustrative account view</p>
              </div>
              <WalletCards size={19} className="text-[#F4B33F]" />
            </div>
            <div className="relative mt-5 flex items-center justify-between rounded-xl bg-white/[.07] px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[10px] font-bold text-white/75">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F4B33F] text-[#171A4A]">
                  <ActiveIcon size={13} />
                </span>
                {active.label}
              </span>
              <span className="text-[11px] font-extrabold text-[#F4B33F] transition-opacity duration-500">{active.amount}</span>
            </div>
          </div>

          {/* quick actions */}
          <div className="showcase-item" style={{ transitionDelay: '.2s' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-muted-foreground">Quick actions</p>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {quickActions.map(({ key, label, icon: Icon }) => {
                const selected = key === active.key;
                return (
                  <div
                    key={key}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center transition-all duration-500 ${
                      selected
                        ? 'border-[#F4B33F] bg-[#171A4A] text-white shadow-[0_10px_22px_rgba(23,26,74,.18)]'
                        : 'border-border bg-secondary/60 text-foreground'
                    }`}
                  >
                    <Icon size={16} className={selected ? 'text-[#F4B33F]' : 'text-muted-foreground'} strokeWidth={1.9} />
                    <span className={`text-[9px] font-extrabold ${selected ? '' : 'text-muted-foreground'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* activity */}
          <div className="showcase-item" style={{ transitionDelay: '.28s' }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-muted-foreground">Recent activity</p>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#8D6116] dark:text-[#F4B33F]">
                View all <ArrowUpRight size={11} />
              </span>
            </div>
            <div className="mt-2.5 divide-y divide-border rounded-xl border border-border bg-card px-3.5">
              {activity.map(({ label, detail, amount, icon: Icon, tint, status }) => (
                <div key={label} className="flex items-center gap-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${tint}38` }}>
                    <Icon size={14} className="text-[#171A4A]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-extrabold">{label}</p>
                    <p className="mt-0.5 text-[9px] font-semibold text-muted-foreground">{detail}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[11px] font-extrabold ${amount.startsWith('+') ? 'text-[#2E9B68]' : ''}`}>{amount}</span>
                    {status === 'live' ? (
                      <StatusChip label={liveStatus.label} tone={liveStatus.tone} />
                    ) : (
                      <StatusChip label={status} tone="ok" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* customer → service → agent line */}
      <div className="showcase-item mt-6 flex items-center justify-center gap-3 text-[9px] font-extrabold uppercase tracking-[.18em] text-muted-foreground" style={{ transitionDelay: '.38s' }}>
        <span>Customer</span>
        <span className="h-px w-8 bg-border" />
        <span className="text-[#8D6116] dark:text-[#F4B33F]">Service</span>
        <span className="h-px w-8 bg-border" />
        <span>Agent</span>
      </div>
    </div>
  );
}
