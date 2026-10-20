import { useState } from "react";
import { PurchaseWizard } from "@app/components/purchase/PurchaseWizard";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { PurchaseStep } from "@app/hooks/usePurchaseFlow";

export function AirtimePage() {
  const [step, setStep] = useState<PurchaseStep>("select_network");
  const reviewing = step === "review";

  return (
    <div className="-mx-5 -my-6 min-h-[calc(100dvh-61px)] bg-white px-5 py-5 md:mx-0 md:my-0 md:min-h-0 md:bg-transparent md:px-0 md:py-0">
      <Link to="/app" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-laupay-ink-muted hover:text-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"><ArrowLeft size={16} /> Back home</Link>
      <h1 className="font-display text-2xl font-semibold text-laupay-ink">{reviewing ? "Review your purchase" : "Buy airtime"}</h1>
      {reviewing ? (
        <p className="mb-5 mt-1 text-sm text-laupay-ink-muted">Check your airtime details before confirming.</p>
      ) : (
        <div className="mb-5" />
      )}
      <PurchaseWizard kind="airtime" onStepChange={setStep} />
    </div>
  );
}
