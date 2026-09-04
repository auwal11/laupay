import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

interface PinPadProps {
  length?: number;
  label: string;
  error?: string | null;
  onComplete: (pin: string) => void;
  disabled?: boolean;
}

/**
 * Collects a PIN as discrete digits and hands the assembled string to
 * `onComplete` — this component never validates, hashes, or "verifies" the
 * PIN itself. That happens server-side; this is presentation only.
 */
export function PinPad({ length = 4, label, error, onComplete, disabled }: PinPadProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (clean && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== "")) {
      onComplete(next.join(""));
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <fieldset className="flex flex-col items-center gap-3">
      <legend className="mb-1 text-sm font-medium text-laupay-ink">{label}</legend>
      <div className="flex gap-2" role="group" aria-label={label}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-label={`Digit ${i + 1} of ${length}`}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "h-12 w-11 rounded-md border border-laupay-border text-center text-lg font-semibold text-laupay-ink",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo",
              error && "border-laupay-danger",
            )}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-laupay-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
