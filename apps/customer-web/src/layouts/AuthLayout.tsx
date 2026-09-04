import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-laupay-surface-muted px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <span className="font-display text-xl font-semibold tracking-tight text-laupay-indigo">
            LAUPAY
          </span>
        </div>
        <div className="rounded-lg border border-laupay-border bg-white p-6 shadow-card">{children}</div>
      </div>
    </div>
  );
}
