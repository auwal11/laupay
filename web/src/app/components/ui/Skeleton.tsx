import { cn } from "@app/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-laupay-surface-muted motion-reduce:animate-none", className)}
    />
  );
}
