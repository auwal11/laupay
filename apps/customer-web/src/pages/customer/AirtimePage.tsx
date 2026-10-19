import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PurchaseWizard } from "@/components/purchase/PurchaseWizard";

export function AirtimePage() {
  return (
    <div className="-mx-5 -my-6 min-h-[calc(100dvh-61px)] bg-white px-5 py-5 md:mx-0 md:my-0 md:min-h-0 md:bg-transparent md:px-0 md:py-0">
      <Link to="/app" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-laupay-ink-muted"><ArrowLeft size={16} /> Back home</Link>
      <h1 className="mb-5 font-display text-2xl font-semibold text-laupay-ink">Buy airtime</h1>
      <PurchaseWizard kind="airtime" />
    </div>
  );
}
