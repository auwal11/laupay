import { cn } from "@app/lib/cn";
import type { TransactionState } from "@app/types/security";

type Status = TransactionState;

const STATUS_STYLES: Record<Status, string> = {
  created: "bg-indigo-50 text-laupay-indigo-soft",
  pending: "bg-amber-50 text-laupay-pending",
  auth_required: "bg-amber-50 text-laupay-pending",
  processing: "bg-indigo-50 text-laupay-indigo-soft",
  success: "bg-green-50 text-laupay-success",
  failed: "bg-red-50 text-laupay-danger",
  refunded: "bg-amber-50 text-laupay-pending",
  unknown: "bg-amber-50 text-laupay-pending",
  cancelled: "bg-laupay-surface-muted text-laupay-ink-muted",
  held: "bg-amber-50 text-laupay-pending",
};

const STATUS_LABEL: Record<Status, string> = {
  created: "Created",
  pending: "Pending",
  auth_required: "Verification needed",
  processing: "Processing",
  success: "Successful",
  failed: "Failed",
  refunded: "Refunded",
  unknown: "Confirming",
  cancelled: "Cancelled",
  held: "Under review",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
