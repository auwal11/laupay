import type { HTMLAttributes } from "react";
import { cn } from "@app/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-laupay-border bg-white p-5 shadow-card",
        className,
      )}
      {...rest}
    />
  );
}
