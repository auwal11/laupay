import { Link } from "react-router-dom";
import { Button } from "@app/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-display text-2xl font-semibold text-laupay-ink">Page not found</p>
      <p className="text-sm text-laupay-ink-muted">The page you're looking for doesn't exist.</p>
      <Link to="/">
        <Button className="mt-2">Back to LAUPAY</Button>
      </Link>
    </div>
  );
}
