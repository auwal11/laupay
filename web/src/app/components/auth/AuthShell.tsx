import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@app/lib/cn";
import { FlowMark } from "@/components/laupay/FlowMark";

/**
 * Shared presentation shell for the LAUPAY authentication screens.
 *
 * It only provides brand framing (approved logo lockup, indigo/navy + amber
 * background treatment, card depth). All form state, validation, API calls and
 * routing stay in the individual pages.
 *
 * Two compositions keep Login and Register from reading as duplicate screens:
 *  - "split"    → Login: brand panel on the left, form card on the right.
 *  - "centered" → Register: single card with an indigo header band.
 */
export type AuthShellVariant = "split" | "centered";

function BrandLockup({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <FlowMark inverse={inverse} size={compact ? 26 : 30} />
      <span
        className={cn(
          "font-display font-extrabold tracking-[-.06em]",
          compact ? "text-[17px]" : "text-[19px]",
          inverse ? "text-white" : "text-laupay-indigo",
        )}
      >
        LAUPAY
      </span>
    </span>
  );
}

/** Indigo/navy brand panel with amber accents — mirrors the landing hero. */
function BrandPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="relative hidden overflow-hidden bg-laupay-indigo-deep lg:flex lg:flex-col lg:justify-between">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_78%_8%,#2A2E6B_0%,#171A4A_46%,#101233_100%)]" />
        <div className="absolute inset-0 opacity-[.16] [background-image:radial-gradient(rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute -right-32 -top-24 h-[460px] w-[460px] rounded-full border border-white/[.07]" />
        <div className="absolute -right-16 top-24 h-[260px] w-[260px] rounded-full border border-laupay-amber/20" />
        <div className="absolute -bottom-40 -left-28 h-[420px] w-[420px] rounded-full border border-white/[.05]" />
        <div className="absolute bottom-[-10%] right-[8%] h-[280px] w-[280px] rounded-full bg-laupay-amber/[.08] blur-3xl" />
      </div>

      <div className="relative px-12 pt-12">
        <Link
          to="/"
          className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-laupay-amber"
          aria-label="LAUPAY home"
        >
          <BrandLockup inverse />
        </Link>
      </div>

      <div className="relative max-w-[430px] px-12 pb-14">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-white/70">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-laupay-amber" />
          {children}
        </p>
        <h2 className="mt-7 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-.06em] text-balance text-white">
          Everyday digital services.{" "}
          <span className="text-laupay-amber">One simple flow.</span>
        </h2>
        <p className="mt-5 text-[15px] leading-7 text-white/60">
          Airtime, data, payments and your wallet — connected so your next
          transaction feels clear from the start.
        </p>
      </div>
    </aside>
  );
}

/** Soft indigo-tinted stage used by the "centered" composition. */
function CenteredStage() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(115%_80%_at_50%_-10%,#FFFFFF_0%,#F6F7FB_44%,#E9EAF4_100%)]" />
      <div className="absolute -top-40 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-laupay-indigo/[.07] blur-3xl" />
      <div className="absolute -bottom-48 -right-24 h-[420px] w-[420px] rounded-full bg-laupay-amber/[.10] blur-3xl" />
      <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(23,26,74,.10)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(70%_60%_at_50%_35%,#000_0%,transparent_100%)]" />
    </div>
  );
}

export function AuthShell({
  variant = "split",
  eyebrow,
  header,
  children,
  footer,
}: {
  variant?: AuthShellVariant;
  eyebrow?: string;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (variant === "centered") {
    return (
      <div className="grain relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-laupay-surface-muted px-4 py-10 sm:px-6 sm:py-14">
        <CenteredStage />

        <main className="relative w-full max-w-[460px]">
          <div className="mb-6 flex justify-center">
            <Link
              to="/"
              className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-laupay-indigo"
              aria-label="LAUPAY home"
            >
              <BrandLockup />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-laupay-border bg-white shadow-[0_24px_60px_-24px_rgba(23,26,74,.28)]">
            {header && (
              <div className="relative overflow-hidden bg-laupay-indigo-deep px-7 py-6 sm:px-8 sm:py-7">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-0 bg-[radial-gradient(120%_140%_at_85%_10%,#2A2E6B_0%,#171A4A_55%,#101233_100%)]" />
                  <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full border border-laupay-amber/20" />
                </div>
                <div className="relative flex items-center gap-2">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-laupay-amber" />
                  {eyebrow && (
                    <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-white/65">
                      {eyebrow}
                    </p>
                  )}
                </div>
                {header}
              </div>
            )}

            <div className="px-7 py-7 sm:px-8 sm:py-8">{children}</div>
          </div>

          {footer && <div className="mt-6 text-center">{footer}</div>}

          <p className="mt-6 text-center text-[11px] font-semibold text-laupay-ink-muted/70">
            © 2026 LAUPAY. Digital services, simply connected.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="grain relative min-h-[100dvh] overflow-hidden bg-laupay-indigo-deep">
      <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <BrandPanel>{eyebrow ?? "Digital services, connected"}</BrandPanel>

        <main className="relative flex items-center justify-center bg-[radial-gradient(110%_80%_at_50%_0%,#FFFFFF_0%,#F6F7FB_52%,#E9EAF4_100%)] px-4 py-10 sm:px-8 sm:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-32 top-1/2 h-[380px] w-[380px] -translate-y-1/2 rounded-full border border-laupay-indigo/[.07]" />
            <div className="absolute -left-24 bottom-0 h-[260px] w-[260px] rounded-full bg-laupay-amber/[.08] blur-3xl" />
          </div>

          <div className="relative w-full max-w-[440px]">
            <div className="mb-7 flex justify-center lg:hidden">
              <Link
                to="/"
                className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-laupay-indigo"
                aria-label="LAUPAY home"
              >
                <BrandLockup />
              </Link>
            </div>

            <div className="rounded-2xl border border-laupay-border bg-white p-6 shadow-[0_24px_60px_-24px_rgba(23,26,74,.28)] sm:p-8">
              {children}
            </div>

            {footer && <div className="mt-6 text-center">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AuthShell;