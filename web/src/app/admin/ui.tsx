import { useEffect, useState } from "react";
import type { DependencyList, ReactNode } from "react";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { Skeleton } from "@app/components/ui/Skeleton";
import { cn } from "@app/lib/cn";
import type { ApiError, ApiResult } from "@app/types/common";

type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "success"; data: T };

/** Minimal data hook for admin screens — refetches whenever `deps` change. */
export function useAsync<T>(
  load: () => Promise<ApiResult<T>>,
  deps: DependencyList,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    load().then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ status: "success", data: result.data });
      else setState({ status: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

const TONE: Record<string, string> = {
  ACTIVE: "bg-green-50 text-laupay-success",
  FULFILLED: "bg-green-50 text-laupay-success",
  SUCCESS: "bg-green-50 text-laupay-success",
  CREDIT: "bg-green-50 text-laupay-success",
  PAID: "bg-indigo-50 text-laupay-indigo-soft",
  PROCESSING: "bg-indigo-50 text-laupay-indigo-soft",
  FULFILLING: "bg-indigo-50 text-laupay-indigo-soft",
  CREATED: "bg-laupay-surface-muted text-laupay-ink-muted",
  PRICED: "bg-laupay-surface-muted text-laupay-ink-muted",
  PENDING_VERIFICATION: "bg-amber-50 text-laupay-pending",
  PENDING: "bg-amber-50 text-laupay-pending",
  UNKNOWN: "bg-amber-50 text-laupay-pending",
  FROZEN: "bg-amber-50 text-laupay-pending",
  SUSPENDED: "bg-red-50 text-laupay-danger",
  FAILED: "bg-red-50 text-laupay-danger",
  FULFILLMENT_FAILED: "bg-red-50 text-laupay-danger",
  CANCELLED: "bg-red-50 text-laupay-danger",
  DEBIT: "bg-red-50 text-laupay-danger",
  CLOSED: "bg-laupay-surface-muted text-laupay-ink-muted",
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-laupay-ink-muted">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        TONE[value] ?? "bg-laupay-surface-muted text-laupay-ink-muted",
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function RoleBadge({ value }: { value: string }) {
  const tone =
    value === "ADMIN"
      ? "bg-laupay-indigo text-white"
      : value === "SUPPORT"
        ? "bg-indigo-50 text-laupay-indigo-soft"
        : value === "AGENT"
          ? "bg-amber-50 text-laupay-pending"
          : "bg-laupay-surface-muted text-laupay-ink-muted";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {value}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string | null | undefined }) {
  if (!mode) return <span className="text-laupay-ink-muted">—</span>;
  const tone =
    mode === "live"
      ? "bg-red-50 text-laupay-danger"
      : mode === "provider_test"
        ? "bg-amber-50 text-laupay-pending"
        : "bg-laupay-surface-muted text-laupay-ink-muted";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {mode.replace(/_/g, " ")}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-xl font-semibold text-laupay-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-laupay-ink-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (next: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-laupay-ink-muted">
      <span>
        Page {page} of {pages} · {total.toLocaleString()} record{total === 1 ? "" : "s"}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-laupay-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-laupay-ink-muted">{hint}</p>}
    </Card>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-laupay-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-laupay-ink-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn("border-b border-laupay-border px-3 py-2.5 align-middle text-sm text-laupay-ink", className)}>
      {children}
    </td>
  );
}

export const selectClass =
  "rounded-md border border-laupay-border bg-white px-3 py-2.5 text-sm text-laupay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo";


/**
 * Reason-gated confirmation used by every sensitive admin action. Enforces a
 * written reason (min length) in the UI; the API enforces it again.
 */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  requireToken,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireToken?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, token: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function submit() {
    if (reason.trim().length < 5) {
      setError("Enter a reason of at least 5 characters.");
      return;
    }
    if (requireToken && token.trim() !== requireToken) {
      setError(`Type ${requireToken} exactly to continue.`);
      return;
    }
    setError(null);
    onConfirm(reason.trim(), token.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-laupay-ink/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="font-display text-base font-semibold text-laupay-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-laupay-ink-muted">{description}</p>}
        <label className="mt-4 block text-sm font-medium text-laupay-ink">
          Reason (required, audited)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-md border border-laupay-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
            placeholder="Why are you making this change?"
          />
        </label>
        {requireToken && (
          <label className="mt-3 block text-sm font-medium text-laupay-ink">
            Type {requireToken} to confirm
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-laupay-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
              placeholder={requireToken}
            />
          </label>
        )}
        {error && <p className="mt-3 text-xs font-medium text-laupay-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={submit} loading={busy}>
            {busy ? "Processing…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
