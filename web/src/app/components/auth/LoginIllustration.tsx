import { Check, Receipt, Smartphone, WalletCards, Wifi } from "lucide-react";

const services = [
  { label: "Airtime", icon: Smartphone, position: "left-0 top-8" },
  { label: "Data", icon: Wifi, position: "right-0 top-1" },
  { label: "Bills", icon: Receipt, position: "left-2 bottom-1" },
  { label: "Wallet", icon: WalletCards, position: "right-1 bottom-5" },
];

/** Compact decorative product art for auth screens; it does not represent live account data. */
export function LoginIllustration() {
  return (
    <div className="relative mx-auto h-[174px] w-[270px]" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-40 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-laupay-indigo/10" />
      <div className="absolute left-1/2 top-1/2 h-32 w-48 -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] rounded-full border border-laupay-amber/35" />

      {services.map(({ label, icon: Icon, position }) => (
        <div key={label} className={`absolute z-20 flex items-center gap-1.5 rounded-lg border border-laupay-border bg-white px-2.5 py-1.5 text-[9px] font-extrabold text-laupay-indigo shadow-[0_10px_24px_rgba(23,29,80,.12)] ${position}`}>
          <Icon size={12} className="text-laupay-indigo" strokeWidth={2.2} />
          {label}
        </div>
      ))}

      <div className="absolute left-1/2 top-1/2 z-10 h-[156px] w-[84px] -translate-x-1/2 -translate-y-1/2 rotate-[7deg] rounded-[18px] border-[3px] border-laupay-ink bg-laupay-ink shadow-[0_18px_35px_rgba(23,29,80,.28)]">
        <div className="absolute left-1/2 top-1.5 h-1.5 w-7 -translate-x-1/2 rounded-full bg-white/20" />
        <div className="absolute inset-[6px] overflow-hidden rounded-[12px] bg-laupay-indigo-deep px-2 py-3 text-white">
          <div className="flex items-center justify-between text-[5px] text-white/60"><span>LAUPAY</span><span>9:41</span></div>
          <p className="mt-4 text-[5px] text-white/55">Available balance</p>
          <p className="mt-1 whitespace-nowrap font-display text-[10px] font-extrabold tracking-[-.04em]">₦125,450.00</p>
          <div className="mt-3 h-1 rounded-full bg-laupay-amber/80" />
          <div className="mt-3 grid grid-cols-4 gap-1">
            {services.map(({ label, icon: Icon }) => <div key={label} className="flex flex-col items-center gap-1 text-[4px] text-white/65"><span className="flex h-4 w-4 items-center justify-center rounded-md bg-white/10"><Icon size={8} className="text-laupay-amber" /></span>{label}</div>)}
          </div>
          <div className="mt-3 rounded-md bg-white/[.08] p-1.5"><div className="flex items-center gap-1 text-[4px] text-white/70"><Check size={7} className="text-laupay-amber" /> Recent activity</div><div className="mt-1 h-1 w-10 rounded-full bg-white/20" /><div className="mt-1 h-1 w-7 rounded-full bg-white/10" /></div>
        </div>
      </div>
    </div>
  );
}
