import { PurchaseWizard } from "@/components/purchase/PurchaseWizard";

export function DataPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Buy data</h1>
      <PurchaseWizard kind="data" />
    </div>
  );
}
