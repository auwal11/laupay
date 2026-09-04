import { useState } from "react";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { TransactionList } from "@/components/wallet/TransactionList";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { wallet } from "@/services";
import { generateIdempotencyKey } from "@/lib/idempotency";

export function WalletPage() {
  const [showFund, setShowFund] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Wallet</h1>
      <BalanceCard />

      {showFund ? (
        <FundWalletForm onDone={() => setShowFund(false)} />
      ) : (
        <Button onClick={() => setShowFund(true)} className="self-start">
          Fund wallet
        </Button>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-laupay-ink">Transaction history</h2>
        <TransactionList />
      </div>
    </div>
  );
}

function FundWalletForm({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [idempotencyKey] = useState(generateIdempotencyKey);

  async function handleFund() {
    setSubmitting(true);
    const result = await wallet.fundWallet({ amount, method: "bank_transfer", idempotencyKey });
    setSubmitting(false);
    if (result.ok) {
      setMessage("Funding request submitted. We'll credit your wallet once it's confirmed.");
    } else {
      setMessage(result.error.message);
    }
  }

  if (message) {
    return (
      <Card>
        <p className="text-sm text-laupay-ink">{message}</p>
        <Button variant="secondary" className="mt-4" onClick={onDone}>
          Done
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <Input
        label="Amount (₦)"
        type="number"
        inputMode="decimal"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleFund} disabled={submitting || !amount}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </Card>
  );
}
