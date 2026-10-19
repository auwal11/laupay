import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FlowMark } from "@/components/laupay/FlowMark";

export function AuthLayout({ children, visual }: { children: ReactNode; visual?: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-laupay-surface-muted px-4 py-5 sm:py-8">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-4 flex justify-center"><span className="inline-flex items-center gap-2"><FlowMark size={28} /><span className="font-display text-xl font-extrabold tracking-[-.06em] text-laupay-indigo">LAUPAY</span></span></Link>
        {visual && <div className="mb-3">{visual}</div>}
        <div className="rounded-lg border border-laupay-border bg-white p-6 shadow-card">{children}</div>
      </div>
    </div>
  );
}
