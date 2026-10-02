import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FlowMark } from "@/components/laupay/FlowMark";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
  /** Shows the animated LAUPAY mark and blocks repeat submissions. */
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-laupay-indigo text-white hover:bg-laupay-indigo-soft",
  secondary: "bg-laupay-surface-muted text-laupay-ink hover:bg-laupay-border",
  ghost: "bg-transparent text-laupay-ink hover:bg-laupay-surface-muted",
  danger: "bg-laupay-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  fullWidth,
  className,
  disabled,
  loading = false,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium",
        "transition-colors duration-150 focus-visible:outline focus-visible:outline-2",
        "focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <FlowMark
          size={16}
          inverse={variant === "primary" || variant === "danger"}
          className="laupay-loader-mark"
        />
      )}
      {children}
    </button>
  );
}
