import { PurchaseWizard } from "@/components/purchase/PurchaseWizard";

export function AirtimePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Buy airtime</h1>
      <PurchaseWizard kind="airtime" />
    </div>
  );
}
