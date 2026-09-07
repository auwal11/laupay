import { FlowMark } from './FlowMark';

/** Small inline spinner for buttons and compact areas. */
export function LaupaySpinner({ size = 18, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <span
      className="laupay-loader-ring inline-block rounded-full border-2 border-current border-t-transparent"
      style={{ height: size, width: size, opacity: inverse ? 0.9 : 0.7 }}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Inline loading state for a card or section. */
export function LaupayLoader({ label = 'Loading', inverse = false }: { label?: string; inverse?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10" role="status" aria-label={label}>
      <FlowMark inverse={inverse} size={32} className="laupay-loader-mark" />
      <span className={`text-xs font-semibold ${inverse ? 'text-white/60' : 'text-laupay-ink-muted'}`}>{label}</span>
    </div>
  );
}

/** Full-page loading state used while the session is being resolved. */
export function LaupayScreenLoader({ label = 'Loading LAUPAY' }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-laupay-surface-muted"
      role="status"
      aria-label={label}
    >
      <FlowMark size={44} className="laupay-loader-mark" />
      <span className="text-xs font-semibold tracking-wide text-laupay-ink-muted">{label}</span>
    </div>
  );
}

export default LaupayLoader;
