import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock3, Landmark, Lock } from "lucide-react";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { Input } from "@app/components/ui/Input";
import { PinPad } from "@app/components/security/PinPad";
import { formatNaira } from "@app/lib/format";
import { generateIdempotencyKey } from "@app/lib/idempotency";
import { wallet, withdrawals } from "@app/services";
import type { Withdrawal } from "@app/types/withdrawals";

type Step = "details" | "pin" | "pending";

export function WithdrawPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("details");
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [available, setAvailable] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pinAttempt, setPinAttempt] = useState(0);
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [idempotencyKey] = useState(generateIdempotencyKey);
  const inFlight = useRef(false);

  useEffect(() => {
    wallet.getBalance().then((result) => {
      if (result.ok) setAvailable(result.data.ngnAvailableBalance ?? result.data.ngnBalance);
    });
  }, []);

  function continueToPin() {
    const value = Number(amount);
    if (!value || value < 100) {
      setFormError("Enter an amount of at least ₦100.00");
      return;
    }
    if (available !== null && value > Number(available)) {
      setFormError("Amount is more than your available balance");
      return;
    }
    if (bankName.trim().length < 2) {
      setFormError("Enter the bank name");
      return;
    }
    if (accountName.trim().length < 2) {
      setFormError("Enter the account name");
      return;
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setFormError("Enter a valid 10-digit account number");
      return;
    }
    setFormError(null);
    setStep("pin");
  }

  async function submitPin(pin: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setPinError(null);
    const result = await withdrawals.request({
      amount,
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber,
      pin,
      idempotencyKey,
    });
    inFlight.current = false;
    setSubmitting(false);
    if (result.ok) {
      setWithdrawal(result.data);
      setStep("pending");
      window.dispatchEvent(new Event("laupay:wallet-changed"));
      return;
    }
    if (/pin/i.test(result.error.message)) {
      setPinError(result.error.message);
      setPinAttempt((attempt) => attempt + 1);
      return;
    }
    setSubmitError(result.error.message);
  }

  if (step === "pending" && withdrawal) {
    return <WithdrawalPending withdrawal={withdrawal} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link to="/app/wallet" className="inline-flex items-center gap-2 text-sm font-semibold text-laupay-ink-muted hover:text-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo">
        <ArrowLeft size={16} /> Back to wallet
      </Link>

      <div>
        <h1 className="font-display text-2xl font-semibold text-laupay-ink">Withdraw funds</h1>
        <p className="mt-1 text-sm text-laupay-ink-muted">
          Send money from your LAUPAY test balance to your bank account.
        </p>
      </div>

      {step === "details" ? (
        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-laupay-indigo/10 text-laupay-indigo">
              <Landmark size={18} />
            </span>
            <div>
              <h2 className="font-semibold text-laupay-ink">Bank account</h2>
              <p className="text-xs text-laupay-ink-muted">
                {available !== null ? `Available: ${formatNaira(available)}` : "Enter your account details"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <Input
              label="Amount (₦)"
              type="number"
              inputMode="decimal"
              min={100}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              hint="Minimum ₦100.00"
            />
            <Input
              label="Bank name"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              placeholder="e.g. GTBank"
              autoComplete="organization"
            />
            <Input
              label="Account number"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
              placeholder="0123456789"
            />
            <Input
              label="Account name"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="Name on the bank account"
            />
          </div>

          {formError && (
            <p role="alert" className="mt-3 text-sm font-medium text-laupay-danger">
              {formError}
            </p>
          )}

          <Button fullWidth className="mt-5" onClick={continueToPin}>
            Continue
          </Button>

          <p className="mt-3 text-xs leading-relaxed text-laupay-ink-muted">
            Test mode: the request is recorded and reviewed by LAUPAY. No real bank transfer is
            sent from this test deployment.
          </p>
        </Card>
      ) : (
        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-laupay-ink">
            <Lock size={15} /> Confirm with your PIN
          </div>

          <div className="mt-4 rounded-2xl bg-laupay-surface-muted px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-laupay-ink-muted">
              You are withdrawing
            </p>
            <p className="mt-1.5 font-display text-3xl font-semibold tabular-nums text-laupay-ink">
              {formatNaira(amount)}
            </p>
            <p className="mt-1 text-sm text-laupay-ink-muted">
              to {accountName} · {bankName}
            </p>
            <p className="text-sm tabular-nums text-laupay-ink-muted">{accountNumber}</p>
          </div>

          <div className="mt-5">
            <PinPad
              key={pinAttempt}
              label="Transaction PIN"
              error={pinError}
              disabled={submitting}
              onComplete={submitPin}
            />
          </div>

          {submitting && (
            <p role="status" className="mt-3 text-center text-sm text-laupay-ink-muted">
              Submitting your withdrawal…
            </p>
          )}
          {submitError && (
            <p role="alert" className="mt-3 text-center text-sm font-medium text-laupay-danger">
              {submitError}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <Button variant="ghost" onClick={() => setStep("details")} disabled={submitting}>
              Edit details
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function WithdrawalPending({ withdrawal }: { withdrawal: Withdrawal }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Card className="rounded-3xl p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-laupay-amber/15 text-laupay-pending">
          <Clock3 size={26} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold text-laupay-ink">
          Withdrawal pending
        </h1>
        <p className="mt-2 text-sm text-laupay-ink-muted">
          Your request has been received and is awaiting review. We'll notify you when it is
          processed.
        </p>

        <p className="mt-5 font-display text-4xl font-semibold tabular-nums text-laupay-ink">
          {formatNaira(withdrawal.amount)}
        </p>

        <dl className="mt-5 divide-y divide-laupay-border rounded-2xl bg-laupay-surface-muted px-4 text-left text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Bank</dt>
            <dd className="font-medium text-laupay-ink">{withdrawal.bankName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Account</dt>
            <dd className="font-medium tabular-nums text-laupay-ink">
              {withdrawal.accountNumber}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Name</dt>
            <dd className="text-right font-medium text-laupay-ink">{withdrawal.accountName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Reference</dt>
            <dd className="font-mono text-xs text-laupay-ink">{withdrawal.reference}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Status</dt>
            <dd>
              <span className="inline-flex rounded-full bg-laupay-amber/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-laupay-pending">
                Pending
              </span>
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2">
          <Button fullWidth onClick={() => navigate("/app/wallet")}>
            Back to wallet
          </Button>
          <Button fullWidth variant="secondary" onClick={() => navigate("/app/transactions")}>
            View transactions
          </Button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-laupay-ink-muted">
          Test mode: no real bank transfer is sent. The amount is held from your available balance
          while the request is pending.
        </p>
      </Card>
    </div>
  );
}
