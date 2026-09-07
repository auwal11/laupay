import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-laupay-border px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-laupay-ink">{title}</h3>
      <p className="max-w-sm text-sm text-laupay-ink-muted">{description}</p>
      {action}
    </div>
  );
}
