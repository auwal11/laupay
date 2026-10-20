import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, CreditCard, Landmark, RefreshCw } from "lucide-react";
import { BalanceCard } from "@app/components/wallet/BalanceCard";
import { TransactionList } from "@app/components/wallet/TransactionList";
import { Button } from "@app/components/ui/Button";
import { Input } from "@app/components/ui/Input";
import { Card } from "@app/components/ui/Card";
import { Skeleton } from "@app/components/ui/Skeleton";
import { wallet } from "@app/services";
import { generateIdempotencyKey } from "@app/lib/idempotency";
import type { VirtualAccount } from "@app/types/wallet";

export function WalletPage() {
  const [showFund, setShowFund] = useState(false);
  const depositRef = useRef<HTMLDivElement>(null);

  function openDeposit() {
    setShowFund(true);
    window.setTimeout(() => depositRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Wallet</h1>
      <BalanceCard onAddFund={openDeposit} />

      <div ref={depositRef}>
        {showFund ? (
          <DepositPanel onDone={() => setShowFund(false)} />
        ) : (
          <Button onClick={openDeposit} className="self-start">
            Fund wallet
          </Button>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-laupay-ink">Transaction history</h2>
        <TransactionList />
      </div>
    </div>
  );
}

function DepositPanel({ onDone }: { onDone: () => void }) {
  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [needsBvn, setNeedsBvn] = useState(false);
  const [bvn, setBvn] = useState("");
  const [showCard, setShowCard] = useState(false);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async (submittedBvn?: string) => {
    setStatus("loading");
    setError(null);
    const result = submittedBvn
      ? await wallet.ensureVirtualAccount(submittedBvn)
      : await wallet.ensureVirtualAccount();
    if (result.ok) {
      setAccount(result.data);
      setStatus("ready");
      setNeedsBvn(false);
      return;
    }
    setStatus("error");
    setError(result.error.message);
    setNeedsBvn(/bvn/i.test(result.error.message));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (showCard) {
    return (
      <FundWithCard
        onDone={onDone}
        onBack={() => {
          setShowCard(false);
          setChecked(false);
        }}
      />
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-laupay-indigo/10 text-laupay-indigo">
          <Landmark size={18} />
        </span>
        <div>
          <h2 className="font-semibold text-laupay-ink">Fund by bank transfer</h2>
          <p className="mt-1 text-sm text-laupay-ink-muted">
            Transfer any amount to your dedicated LAUPAY account. Your wallet is credited
            automatically once the bank confirms the payment.
          </p>
        </div>
      </div>

      {status === "loading" && (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      )}

      {status === "error" && (
        <div className="mt-5 rounded-xl border border-laupay-danger/20 bg-laupay-danger/5 p-4">
          <p className="text-sm text-laupay-danger">{error}</p>
          {needsBvn ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                label="Your BVN"
                inputMode="numeric"
                maxLength={11}
                value={bvn}
                onChange={(event) => setBvn(event.target.value.replace(/\D/g, ""))}
                hint="Used only to create your account with the bank. We never store it."
              />
              <Button
                onClick={() => void load(bvn)}
                disabled={bvn.length !== 11}
                className="sm:mb-6"
              >
                Create account
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void load()}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => setShowCard(true)}>
                Pay with card instead
              </Button>
            </div>
          )}
        </div>
      )}

      {status === "ready" && account && (
        <div className="mt-5">
          <div className="rounded-xl border border-laupay-border bg-laupay-canvas p-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Bank" value={account.bankName} />
              <Field label="Account number" value={account.accountNumber} copyable emphasize />
              <Field label="Account name" value={account.accountName} />
            </dl>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                window.dispatchEvent(new Event("laupay:wallet-changed"));
                setChecked(true);
              }}
            >
              <RefreshCw size={15} /> I've sent the money
            </Button>
            <Button variant="ghost" onClick={() => setShowCard(true)}>
              <CreditCard size={15} /> Pay with card instead
            </Button>
            <Button variant="ghost" onClick={onDone}>
              Done
            </Button>
          </div>

          <p className="mt-3 text-xs text-laupay-ink-muted">
            {checked
              ? "Checking your balance… transfers usually reflect within a minute."
              : "Save this account as a beneficiary — it stays the same for every deposit."}
          </p>
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  copyable,
  emphasize,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  emphasize?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-laupay-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-2">
        <span
          className={
            emphasize
              ? "font-display text-xl font-semibold tracking-wide text-laupay-ink tabular-nums"
              : "text-sm font-medium text-laupay-ink"
          }
        >
          {value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${label.toLowerCase()}`}
            className="rounded-md p-1.5 text-laupay-ink-muted transition hover:bg-white hover:text-laupay-indigo"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        )}
      </dd>
    </div>
  );
}

function FundWithCard({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [idempotencyKey] = useState(generateIdempotencyKey);

  async function handleFund() {
    setSubmitting(true);
    const result = await wallet.fundWallet({ amount, method: "bank_transfer", idempotencyKey });
    setSubmitting(false);
    if (result.ok) {
      if (result.data.checkoutUrl) {
        window.location.assign(result.data.checkoutUrl);
        return;
      }
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
      <h2 className="mb-3 font-semibold text-laupay-ink">Pay with card</h2>
      <Input
        label="Amount (₦)"
        type="number"
        inputMode="decimal"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleFund} loading={submitting} disabled={!amount}>
          {submitting ? "Submitting…" : "Continue"}
        </Button>
      </div>
    </Card>
  );
}
