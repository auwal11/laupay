import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock3, Info, Landmark } from "lucide-react";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { Input } from "@app/components/ui/Input";
import { Skeleton } from "@app/components/ui/Skeleton";
import { PinPad } from "@app/components/security/PinPad";
import { formatNaira } from "@app/lib/format";
import { generateIdempotencyKey } from "@app/lib/idempotency";
import { wallet, withdrawals } from "@app/services";
import type { Withdrawal } from "@app/types/withdrawals";

type Step = "details" | "pin" | "pending";

// Mirrors the server-side withdrawal rules (RequestWithdrawalDto + WithdrawalsService).
const MIN_WITHDRAWAL = 100;
const MAX_WITHDRAWAL = 500_000;

function maskAccount(accountNumber: string): string {
  return accountNumber.length > 4
    ? `${"•".repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`
    : accountNumber;
}

export function WithdrawPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("details");
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [banks, setBanks] = useState<Array<{ code: string; name: string }>>([]);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [available, setAvailable] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
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
      setBalanceLoading(false);
    });
  }, []);

  useEffect(() => {
    void withdrawals.banks().then((result) => {
      if (result.ok) setBanks(result.data);
      else setBanksError(result.error.message);
    });
  }, []);

  const amountValue = Number(amount);
  const amountIsValid =
    Number.isFinite(amountValue) &&
    amountValue >= MIN_WITHDRAWAL &&
    amountValue <= MAX_WITHDRAWAL &&
    (available === null || amountValue <= Number(available));
  const detailsValid =
    amountIsValid &&
    bankName.trim().length >= 2 &&
    accountName.trim().length >= 2 &&
    /^\d{10}$/.test(accountNumber);
  const canWithdrawAll =
    available !== null && Number(available) >= MIN_WITHDRAWAL && Number(available) <= MAX_WITHDRAWAL;

  let amountHint = `Minimum ${formatNaira(String(MIN_WITHDRAWAL))} · Maximum ${formatNaira(String(MAX_WITHDRAWAL))} per request`;
  let amountError: string | undefined;
  if (amount !== "") {
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      amountError = "Enter a valid amount";
    } else if (amountValue < MIN_WITHDRAWAL) {
      amountError = `Minimum withdrawal is ${formatNaira(String(MIN_WITHDRAWAL))}`;
    } else if (amountValue > MAX_WITHDRAWAL) {
      amountError = `Maximum withdrawal is ${formatNaira(String(MAX_WITHDRAWAL))}`;
    } else if (available !== null && amountValue > Number(available)) {
      amountError = "Amount is more than your available balance";
    }
  }
  if (available !== null) amountHint += ` · Available ${formatNaira(available)}`;

  function continueToPin() {
    if (!detailsValid) {
      setFormError(
        amountError ??
          (!amount ? "Enter the amount you want to withdraw" : "Complete your bank account details"),
      );
      return;
    }
    setFormError(null);
    setSubmitError(null);
    setPinError(null);
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
      bankCode,
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-6">
      <Link
        to="/app/wallet"
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-laupay-ink-muted hover:text-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"
      >
        <ArrowLeft size={16} /> Back to wallet
      </Link>

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-laupay-ink">
          Withdraw funds
        </h1>
        <p className="mt-1 text-sm text-laupay-ink-muted">
          Transfer money from your LAUPAY wallet to your bank account.
        </p>
        <p className="mt-3 inline-flex items-start gap-2 rounded-lg border border-laupay-border bg-white px-3 py-2 text-xs leading-relaxed text-laupay-ink-muted">
          <Info size={14} className="mt-0.5 shrink-0 text-laupay-pending" aria-hidden="true" />
          Withdrawals are limited to your available balance and LAUPAY withdrawal rules.
        </p>
      </div>

      <Card className="rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-laupay-amber/15 text-laupay-pending">
            <Landmark size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-laupay-ink-muted">
              Available balance
            </p>
            {balanceLoading ? (
              <Skeleton className="mt-1.5 h-7 w-36" />
            ) : (
              <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-laupay-ink">
                {available !== null ? formatNaira(available) : "—"}
              </p>
            )}
          </div>
          <Link
            to="/app/wallet"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-laupay-indigo hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"
          >
            View wallet <ArrowUpRight size={13} />
          </Link>
        </div>
      </Card>

      {step === "details" ? (
        <Card className="rounded-2xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-laupay-ink">Bank withdrawal</h2>
          <p className="mt-1 text-sm text-laupay-ink-muted">
            Enter your bank details and the amount you want to withdraw.
          </p>

          <div className="mt-5 flex flex-col gap-5">
            <div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Amount (₦)"
                    type="number"
                    inputMode="decimal"
                    min={MIN_WITHDRAWAL}
                    step="0.01"
                    placeholder="Enter withdrawal amount"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setFormError(null);
                    }}
                    hint={amountHint}
                    error={amountError}
                    className="h-[52px]"
                  />
                </div>
                {canWithdrawAll && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmount(available ?? "");
                      setFormError(null);
                    }}
                    className="mb-0.5 h-[52px] shrink-0 rounded-md border border-laupay-border px-3 text-xs font-semibold text-laupay-indigo transition hover:border-laupay-indigo hover:bg-laupay-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
                  >
                    Withdraw all
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-laupay-border pt-5">
              <h3 className="text-sm font-semibold text-laupay-ink">Destination account</h3>
              <div className="mt-3 flex flex-col gap-4">
                <div>
                  <label htmlFor="withdrawal-bank" className="mb-1.5 block text-sm font-medium text-laupay-ink">Bank</label>
                  <select id="withdrawal-bank" value={bankCode} onChange={(event) => { const selected = banks.find((bank) => bank.code === event.target.value); setBankCode(event.target.value); setBankName(selected?.name ?? ""); }} className="h-[52px] w-full rounded-md border border-laupay-border bg-white px-3 text-sm text-laupay-ink focus:border-laupay-indigo focus:outline-none focus:ring-2 focus:ring-laupay-indigo/20" disabled={!banks.length}>
                    <option value="">{banks.length ? "Select your bank" : "Bank directory unavailable"}</option>
                    {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
                  </select>
                  {banksError && <p className="mt-1 text-xs text-laupay-danger">{banksError}</p>}
                  {!banksError && !banks.length && <p className="mt-1 text-xs text-laupay-ink-muted">Withdrawals are temporarily unavailable because no verified bank directory is configured.</p>}
                </div>
                <Input
                  label="Account number"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit account number"
                  hint="Nigerian bank accounts are 10 digits."
                  className="h-[52px]"
                />
                <Input
                  label="Account name"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="Name on the bank account"
                  hint="Enter the name exactly as it appears on the account. LAUPAY does not verify account names yet."
                  className="h-[52px]"
                />
              </div>
            </div>

            {amountIsValid && (
              <div className="rounded-xl border border-laupay-border bg-laupay-surface-muted/60 px-4 py-3">
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-laupay-ink-muted">Withdrawal amount</dt>
                    <dd className="font-medium tabular-nums text-laupay-ink">
                      {formatNaira(amount)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-laupay-ink-muted">Withdrawal fee</dt>
                    <dd className="font-medium tabular-nums text-laupay-ink">{formatNaira("0")}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-laupay-border pt-2">
                    <dt className="font-semibold text-laupay-ink">Total debit</dt>
                    <dd className="font-semibold tabular-nums text-laupay-ink">
                      {formatNaira(amount)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-laupay-ink-muted">Balance after withdrawal</dt>
                    <dd className="font-medium tabular-nums text-laupay-ink">
                      {available !== null
                        ? formatNaira(String(Math.max(0, Number(available) - amountValue)))
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {formError && (
            <p role="alert" className="mt-4 text-sm font-medium text-laupay-danger">
              {formError}
            </p>
          )}

          <Button
            fullWidth
            onClick={continueToPin}
            disabled={!detailsValid || submitting}
            className="mt-5 h-14"
          >
            Continue <ArrowRight size={17} />
          </Button>

          <p className="mt-3 text-xs leading-relaxed text-laupay-ink-muted">
            Your request is recorded securely, and the amount is reserved from your available
            balance while it is reviewed.
          </p>
        </Card>
      ) : (
        <Card className="rounded-2xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-laupay-ink">
            Confirm withdrawal
          </h2>
          <p className="mt-1 text-sm text-laupay-ink-muted">
            Check the details below, then enter your transaction PIN.
          </p>

          <div className="mt-4 rounded-xl border border-laupay-border bg-laupay-surface-muted/60 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-laupay-ink-muted">
              Total debit
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-laupay-ink">
              {formatNaira(amount)}
            </p>
            <dl className="mt-3 flex flex-col gap-2 border-t border-laupay-border pt-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-laupay-ink-muted">Bank</dt>
                <dd className="font-medium text-laupay-ink">{bankName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-laupay-ink-muted">Account</dt>
                <dd className="font-medium tabular-nums text-laupay-ink">
                  {maskAccount(accountNumber)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-laupay-ink-muted">Account name</dt>
                <dd className="text-right font-medium text-laupay-ink">{accountName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-laupay-ink-muted">Fee</dt>
                <dd className="font-medium tabular-nums text-laupay-ink">{formatNaira("0")}</dd>
              </div>
            </dl>
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

          <Button
            variant="ghost"
            fullWidth
            className="mt-5 h-12"
            onClick={() => setStep("details")}
            disabled={submitting}
          >
            Edit details
          </Button>
        </Card>
      )}
    </div>
  );
}

function WithdrawalPending({ withdrawal }: { withdrawal: Withdrawal }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(withdrawal);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await withdrawals.detail(withdrawal.id);
      if (!cancelled && result.ok) setCurrent(result.data);
    };
    void load();
    const interval = window.setInterval(load, 8000);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [withdrawal.id]);

  const statusCopy: Record<string, { title: string; message: string; tone: string }> = {
    PENDING: { title: "Withdrawal pending", message: "Your request has been received and is awaiting admin review.", tone: "bg-laupay-amber/15 text-laupay-pending" },
    APPROVED: { title: "Withdrawal approved", message: "Your request was approved and is queued for processing.", tone: "bg-laupay-indigo/10 text-laupay-indigo" },
    PROCESSING: { title: "Withdrawal processing", message: "Your bank payout is being processed. We will update this screen when it is confirmed.", tone: "bg-laupay-indigo/10 text-laupay-indigo" },
    SUCCESSFUL: { title: "Withdrawal successful", message: "Your bank payout has been confirmed.", tone: "bg-laupay-success/10 text-laupay-success" },
    REFUNDED: { title: "Withdrawal refunded", message: "The withdrawal did not complete and the reserved amount has been returned to your wallet.", tone: "bg-laupay-success/10 text-laupay-success" },
    REFUND_PENDING: { title: "Refund pending", message: "Your withdrawal failed and the wallet refund is being processed.", tone: "bg-laupay-amber/15 text-laupay-pending" },
    FAILED: { title: "Withdrawal failed", message: current.failureReason ?? "The bank payout could not be completed.", tone: "bg-red-50 text-red-700" },
    REJECTED: { title: "Withdrawal rejected", message: current.failureReason ?? "The withdrawal request was rejected.", tone: "bg-red-50 text-red-700" },
    REVERSED: { title: "Withdrawal reversed", message: "The payout was reversed. Check your wallet for the returned funds.", tone: "bg-red-50 text-red-700" },
    REFUND_FAILED: { title: "Refund needs attention", message: current.failureReason ?? "The wallet refund could not be completed yet.", tone: "bg-red-50 text-red-700" },
  };
  const copy = statusCopy[current.status] ?? statusCopy.PENDING;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-6">
      <Link
        to="/app/wallet"
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-laupay-ink-muted hover:text-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"
      >
        <ArrowLeft size={16} /> Back to wallet
      </Link>

      <Card className="rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${copy.tone}`}>
            <Clock3 size={22} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-laupay-ink">
              {copy.title}
            </h1>
            <p className="mt-1 text-sm text-laupay-ink-muted">
              {copy.message}
            </p>
          </div>
        </div>

        <p className="mt-5 font-display text-4xl font-semibold tabular-nums text-laupay-ink">
          {formatNaira(current.amount)}
        </p>

        <dl className="mt-4 divide-y divide-laupay-border rounded-xl border border-laupay-border px-4 text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Bank</dt>
            <dd className="font-medium text-laupay-ink">{current.bankName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Account</dt>
            <dd className="font-medium tabular-nums text-laupay-ink">
              {current.accountNumber}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Account name</dt>
            <dd className="text-right font-medium text-laupay-ink">{current.accountName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Reference</dt>
            <dd className="font-mono text-xs text-laupay-ink">{current.reference}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-laupay-ink-muted">Status</dt>
            <dd>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${copy.tone}`}>
                {current.status.replace(/_/g, " ")}
              </span>
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2">
          <Button fullWidth className="h-14" onClick={() => navigate("/app/wallet")}>
            Back to wallet
          </Button>
          <Button
            fullWidth
            variant="secondary"
            className="h-12"
            onClick={() => navigate("/app/transactions")}
          >
            View transactions
          </Button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-laupay-ink-muted">
          {current.status === "PENDING" || current.status === "APPROVED" || current.status === "PROCESSING"
            ? "This page refreshes automatically while your withdrawal is being reviewed or processed."
            : "Your withdrawal status is based on the latest confirmed update from LAUPAY."}
        </p>
      </Card>
    </div>
  );
}
