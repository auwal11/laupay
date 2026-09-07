import type { ApiError } from "@app/types/common";
import { Button } from "./Button";

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-laupay-border bg-red-50/40 px-6 py-10 text-center"
    >
      <h3 className="text-sm font-semibold text-laupay-ink">Couldn't load this</h3>
      <p className="max-w-sm text-sm text-laupay-ink-muted">{error.message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
