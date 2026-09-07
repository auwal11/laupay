/**
 * Display-only formatting. These never compute a price or balance —
 * they take a backend-authoritative decimal string and format it for
 * reading. All amounts stay strings end-to-end to avoid float drift.
 */

export function formatNaira(amount: string): string {
  const value = Number(amount);
  if (Number.isNaN(value)) return `₦${amount}`;
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
