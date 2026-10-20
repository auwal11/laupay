import { FlowMark } from "@/components/laupay/FlowMark";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Share2 } from "lucide-react";
import { Button } from "@app/components/ui/Button";
import { Input } from "@app/components/ui/Input";
import { Card } from "@app/components/ui/Card";
import { StatusBadge } from "@app/components/ui/Badge";
import { PinPad } from "@app/components/security/PinPad";
import { formatDateTime, formatNaira } from "@app/lib/format";
import { useReducedMotion } from "@app/hooks/useReducedMotion";
import { usePurchaseFlow } from "@app/hooks/usePurchaseFlow";
import { beneficiaries } from "@app/services";
import type { Beneficiary, BeneficiaryNetwork } from "@app/types/beneficiaries";
import type { PurchaseKind, Order, PurchaseNotice } from "@app/types/orders";
import type { PurchaseStep } from "@app/hooks/usePurchaseFlow";
import type { ApiError } from "@app/types/common";

const STEP_LABELS: Record<PurchaseStep, string> = {
  select_network: "Choose network",
  enter_phone: "Phone number",
  select_amount_plan: "Choose amount",
  review: "Review",
  processing: "Processing",
  verify: "Verify it's you",
  result: "Done",
};

export function PurchaseWizard({ kind }: { kind: PurchaseKind }) {
  const flow = usePurchaseFlow(kind);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { state } = flow;
  const productName = kind === "airtime" ? "Airtime" : "Data";

  /** Done = primary exit: reset the wizard and return home with a one-shot banner. */
  function handleDone() {
    const order = state.order;
    let notice: PurchaseNotice;
    if (order?.status === "success") {
      notice = {
        tone: "success",
        title: `${productName} purchase successful`,
        body: `${formatNaira(order.total ?? order.amount)} sent to ${order.phoneNumber}.`,
      };
    } else if (order?.status === "refunded") {
      notice = {
        tone: "error",
        title: "Purchase could not be completed",
        body: "The amount debited was returned to your wallet.",
      };
    } else if (order && ["pending", "processing", "unknown"].includes(order.status)) {
      notice = {
        tone: "pending",
        title: "Purchase is still processing",
        body: "We'll update Transactions as soon as LAUPAY confirms the result.",
      };
    } else if (order) {
      notice = {
        tone: "error",
        title: "Purchase could not be completed",
        body: order.failureReason ?? "The provider could not complete this purchase.",
      };
    } else {
      notice = {
        tone: "error",
        title: "Purchase could not be completed",
        body: state.error?.message ?? "Please try again.",
      };
    }
    flow.restart();
    navigate("/app", { replace: true, state: { purchaseNotice: notice } });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      {state.step !== "result" && (
        <ol className="flex items-center gap-2" aria-label="Purchase progress">
          {(["select_network", "enter_phone", "select_amount_plan", "review"] as const).map((s, i) => (
            <li
              key={s}
              className={
                "h-1.5 flex-1 rounded-full " +
                (stepIndex(state.step) >= i ? "bg-laupay-amber" : "bg-laupay-border")
              }
              aria-current={state.step === s ? "step" : undefined}
            />
          ))}
        </ol>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {state.step === "select_network" && (
            <StepCard title={STEP_LABELS.select_network}>
              {state.networksLoading ? <div role="status" aria-label="Loading networks" className="grid grid-cols-2 gap-2">{[1, 2, 3, 4].map((item) => <span key={item} className="h-12 animate-pulse rounded-md bg-laupay-surface-muted" />)}</div> : state.networks.length > 0 ? <div className="grid grid-cols-2 gap-2">
                {state.networks.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => flow.selectNetwork(n.id)}
                    className="rounded-md border border-laupay-border bg-white px-4 py-3 text-sm font-medium text-laupay-ink hover:border-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
                  >
                    {n.name}
                  </button>
                ))}
              </div> : <div role="alert" className="text-sm text-laupay-danger"><p>Unable to load networks. Please try again.</p><button type="button" onClick={flow.loadNetworks} className="mt-3 font-medium underline">Retry</button></div>}
            </StepCard>
          )}

          {state.step === "enter_phone" && (
            <StepCard title={STEP_LABELS.enter_phone} onBack={flow.goBack}>
              <PhoneForm onSubmit={flow.submitPhoneNumber} initialValue={state.phoneNumber} network={state.networkId} />
            </StepCard>
          )}

          {state.step === "select_amount_plan" && (
            <StepCard title={STEP_LABELS.select_amount_plan} onBack={flow.goBack}>
              {kind === "airtime" ? (
                <AirtimeAmountPicker amounts={flow.airtimeAmounts} onSelect={flow.selectAmount} />
              ) : state.plansLoading ? (
                <div role="status" aria-label="Loading data plans" className="flex flex-col gap-2">
                  {[1, 2, 3].map((item) => <span key={item} className="h-12 animate-pulse rounded-md bg-laupay-surface-muted" />)}
                </div>
              ) : state.plansError ? (
                <div role="alert" className="text-sm text-laupay-danger">
                  <p>{state.plansError}</p>
                  <button type="button" onClick={flow.retryPlans} className="mt-3 font-medium underline">Retry</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {state.plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => flow.selectPlan(plan.id)}
                      className="flex items-center justify-between rounded-md border border-laupay-border bg-white px-4 py-3 text-left text-sm hover:border-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
                    >
                      <span className="font-medium text-laupay-ink">{plan.label}</span>
                      <span className="font-semibold tabular-nums text-laupay-ink">
                        {formatNaira(plan.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </StepCard>
          )}

          {state.step === "review" && (
            <StepCard title={STEP_LABELS.review} onBack={flow.goBack}>
              <dl className="flex flex-col gap-3 text-sm">
                <Row label="Network" value={state.networks.find((n) => n.id === state.networkId)?.name ?? "—"} />
                <Row label="Phone number" value={state.phoneNumber} />
                {kind === "airtime" && (
                  <Row label="Amount" value={formatNaira(state.amount ?? "0")} />
                )}
                {kind === "data" && (
                  <Row
                    label="Plan"
                    value={state.plans.find((p) => p.id === state.planId)?.label ?? "—"}
                  />
                )}
              </dl>
              <p className="mt-4 text-xs text-laupay-ink-muted">
                LAUPAY determines the final price, fees, and whether extra verification is needed once you confirm.
              </p>
              <Button fullWidth className="mt-4" onClick={flow.confirm}>
                Confirm purchase
              </Button>
            </StepCard>
          )}

          {state.step === "processing" && (
            <StepCard title={STEP_LABELS.processing}>
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span role="status" aria-label="Processing your purchase">
                  <FlowMark size={40} className="laupay-loader-mark" />
                </span>
                <p className="text-sm font-medium text-laupay-ink">{state.processingLabel}</p>
                <p className="text-sm text-laupay-ink-muted">Sending airtime securely for confirmation.</p>
              </div>
            </StepCard>
          )}

          {state.step === "verify" && (
            <StepCard title={STEP_LABELS.verify}>
              <p className="mb-4 text-center text-sm text-laupay-ink-muted">
                For your security, enter your transaction PIN to finish this purchase.
              </p>
              <PinPad
                key={state.verifyAttempt}
                label="Transaction PIN"
                error={state.verifyError}
                disabled={false}
                onComplete={flow.submitVerification}
              />
            </StepCard>
          )}

          {state.step === "result" && (
            <ResultCard kind={kind} order={state.order} networks={state.networks} error={state.error} onRestart={flow.restart} onDone={handleDone} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function stepIndex(step: string): number {
  const idx = ["select_network", "enter_phone", "select_amount_plan", "review"].indexOf(step);
  // "processing"/"verify" come after "review" in the flow — keep the bar fully lit rather than resetting.
  if (idx === -1 && (step === "processing" || step === "verify")) return 3;
  return idx;
}

function StepCard({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Go back"
            className="rounded-md p-1 text-laupay-ink-muted hover:bg-laupay-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"
          >
            ←
          </button>
        )}
        <h2 className="text-sm font-semibold text-laupay-ink">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-laupay-ink-muted">{label}</dt>
      <dd className="font-medium text-laupay-ink">{value}</dd>
    </div>
  );
}

function PhoneForm({
  onSubmit,
  initialValue,
  network,
}: {
  onSubmit: (v: string) => void;
  initialValue: string;
  network: string | null;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState<Beneficiary[]>([]);
  const [saveNumber, setSaveNumber] = useState(true);

  useEffect(() => {
    let cancelled = false;
    beneficiaries.list().then((result) => {
      if (!cancelled && result.ok) {
        setSaved(result.data.filter((item) => item.network === network));
      }
    });
    return () => { cancelled = true; };
  }, [network]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeNgPhone(value);
    if (!normalized) {
      setError("Enter a valid Nigerian phone number, e.g. 08012345678.");
      return;
    }
    setError(undefined);
    if (saveNumber && isBeneficiaryNetwork(network)) {
      void beneficiaries.save({ phoneNumber: normalized, network });
    }
    onSubmit(normalized);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {saved.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Saved beneficiaries</p>
          <div className="flex flex-wrap gap-2">
            {saved.map((beneficiary) => (
              <button
                key={beneficiary.id}
                type="button"
                onClick={() => setValue(beneficiary.phoneNumber)}
                className="flex flex-col items-start rounded-lg border border-laupay-border bg-laupay-surface-muted/60 px-3 py-2 text-left hover:border-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"
              >
                <span className="text-xs font-semibold text-laupay-ink">{beneficiary.label}</span>
                <span className="text-[11px] tabular-nums text-laupay-ink-muted">{beneficiary.phoneNumber}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <Input
        label="Phone number"
        type="tel"
        inputMode="tel"
        placeholder="+234 801 234 5678"
        value={value}
        error={error}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <label className="flex items-center gap-2 text-sm text-laupay-ink">
        <input type="checkbox" checked={saveNumber} onChange={(event) => setSaveNumber(event.target.checked)} className="h-4 w-4 rounded border-laupay-border text-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo" />
        Save this number for next time
      </label>
      <Button type="submit" fullWidth>
        Continue
      </Button>
    </form>
  );
}

function isBeneficiaryNetwork(value: string | null): value is BeneficiaryNetwork {
  return value === "MTN" || value === "AIRTEL" || value === "GLO" || value === "9MOBILE";
}

function AirtimeAmountPicker({ amounts, onSelect }: { amounts: string[]; onSelect: (amount: string) => void }) {
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  function submitCustom(event: FormEvent) {
    event.preventDefault();
    const value = Number(custom);
    if (!Number.isInteger(value) || value < 100 || value > 10000) {
      setError("Enter an amount from ₦100 to ₦10,000.");
      return;
    }
    setError(null);
    onSelect(String(value));
  }
  return <div className="flex flex-col gap-4"><div className="grid grid-cols-3 gap-2">{amounts.map((amount) => <button key={amount} onClick={() => onSelect(amount)} className="rounded-md border border-laupay-border bg-white px-3 py-3 text-sm font-semibold text-laupay-ink hover:border-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo">{formatNaira(amount)}</button>)}</div><form onSubmit={submitCustom} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-medium text-laupay-ink">Custom amount<input value={custom} onChange={(event) => setCustom(event.target.value.replace(/\D/g, ""))} type="number" min="100" max="10000" step="1" inputMode="numeric" placeholder="₦100 – ₦10,000" className="mt-1.5 w-full rounded-md border border-laupay-border px-3 py-2.5 text-sm outline-none focus:border-laupay-indigo" /></label><Button type="submit">Use amount</Button></form>{error && <p role="alert" className="text-xs text-laupay-danger">{error}</p>}</div>;
}

function normalizeNgPhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^0[789]\d{9}$/.test(compact)) return compact;
  if (/^\+234[789]\d{9}$/.test(compact)) return `0${compact.slice(4)}`;
  return "";
}

const TERMINAL_MESSAGES: Partial<Record<Order["status"], { tone: "muted" | "danger"; text: string }>> = {
  pending: {
    tone: "muted",
    text: "We'll update this once LAUPAY confirms it — check Transactions for the latest status.",
  },
  processing: {
    tone: "muted",
    text: "Still being confirmed — check Transactions shortly for the final result.",
  },
  unknown: {
    tone: "muted",
    text: "We lost the connection while confirming this. We'll update it once it's confirmed — please don't retry yet.",
  },
  held: {
    tone: "muted",
    text: "This transaction is temporarily under security review. We have not charged your wallet for this yet.",
  },
  cancelled: {
    tone: "muted",
    text: "This transaction was cancelled.",
  },
};

function ResultCard({
  kind,
  order,
  networks,
  error,
  onRestart,
  onDone,
}: {
  kind: PurchaseKind;
  order: Order | null;
  networks: { id: string; name: string }[];
  error: ApiError | null;
  onRestart: () => void;
  onDone: () => void;
}) {
  const orderId = order?.id;
  const orderStatus = order?.status;
  useEffect(() => {
    if (!orderId || !orderStatus) return;
    // The backend writes the notification as the order settles; ask the shell
    // to refetch now instead of waiting for the next navigation.
    window.dispatchEvent(new Event("laupay:notifications-changed"));
  }, [orderId, orderStatus]);

  if (error) {
    return (
      <>
        <LiveTransactionNotice tone="error" title="Transaction failed" message={error.message} />
        <Card>
        <p className="text-sm font-semibold text-laupay-danger">Couldn't complete this purchase</p>
        <p className="mt-2 text-sm text-laupay-ink-muted">{error.message}</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button fullWidth onClick={onDone}>Done</Button>
          <Button variant="secondary" fullWidth onClick={onRestart}>Try again</Button>
        </div>
        </Card>
      </>
    );
  }

  if (!order) return null;

  const networkName = networks.find((network) => network.id === order.networkId)?.name ?? order.networkId;
  const shareText = `LAUPAY ${kind === "airtime" ? "airtime" : "data"} purchase — ${formatNaira(order.amount)} for ${maskPhone(order.phoneNumber)}. Reference: ${order.reference}`;
  const share = async () => {
    if (navigator.share) await navigator.share({ title: "LAUPAY receipt", text: shareText });
    else await navigator.clipboard?.writeText(shareText);
  };

  const insufficientFunds =
    order.status === "cancelled" && order.failureReason === "INSUFFICIENT_FUNDS";
  const terminalMessage = TERMINAL_MESSAGES[order.status];
  const successful = order.status === "success";
  const failed = order.status === "failed" || order.status === "refunded" || order.status === "cancelled";
  const pending = !successful && !failed;
  const resultTitle = successful
    ? `${kind === "airtime" ? "Airtime" : "Data"} purchase successful`
    : failed ? "Purchase failed" : "Purchase processing";
  const resultMessage = successful
    ? "Your purchase was completed successfully."
    : failed
      ? insufficientFunds ? "Your wallet balance was not enough for this purchase." : order.status === "refunded" ? "The purchase failed and the debit was returned to your wallet." : order.failureReason ?? "The provider could not complete this purchase."
      : terminalMessage?.text ?? "We are still confirming this purchase. You do not need to retry.";

  return (
    <>
    <LiveTransactionNotice tone={successful ? "success" : failed ? "error" : "pending"} title={successful ? "Transaction successful" : failed ? "Transaction failed" : "Transaction pending"} message={resultMessage} />
    <Card className="border-laupay-amber/40">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${successful ? "bg-laupay-success/15 text-laupay-success" : failed ? "bg-laupay-danger/10 text-laupay-danger" : "bg-laupay-amber/20 text-laupay-pending"}`}>{successful ? "✓" : failed ? "!" : "…"}</span>
        <p className="font-display text-xl font-extrabold text-laupay-indigo">{resultTitle}</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-laupay-ink">
          {kind === "airtime" ? "Airtime" : "Data"} purchase
        </p>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-laupay-ink">
        {formatNaira(order.total ?? order.amount)}
      </p>
      <dl className="mt-4 space-y-2 rounded-lg bg-laupay-surface-muted p-3 text-sm"><Row label="Network" value={networkName} /><Row label="Destination" value={maskPhone(order.phoneNumber)} /><Row label="Time" value={formatDateTime(order.createdAt)} /><Row label="Reference" value={order.reference} /></dl>
      {failed && order.failureReason && (
        <p className="mt-2 text-sm text-laupay-danger">{order.failureReason}</p>
      )}
      {insufficientFunds && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-laupay-amber bg-amber-50 px-3 py-2.5 text-sm"
        >
          <p className="font-semibold text-laupay-pending">Insufficient wallet balance</p>
          <p className="mt-0.5 text-laupay-ink-muted">
            Your wallet doesn't have enough to cover this purchase. Top up your wallet and try
            again — you have not been charged.
          </p>
        </div>
      )}
      {pending && terminalMessage && !insufficientFunds && (
        <p
          className={
            "mt-2 text-sm " + (terminalMessage.tone === "danger" ? "text-laupay-danger" : "text-laupay-pending")
          }
        >
          {terminalMessage.text}
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2">
        <Button fullWidth onClick={onDone}>Done</Button>
        <Button variant="secondary" fullWidth onClick={onRestart}>New purchase</Button>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => void share()}><Share2 size={15} /> Share receipt</Button>
          {insufficientFunds ? (
            <Link
              to="/app/wallet"
              className="flex flex-1 items-center justify-center rounded-md border border-laupay-border px-4 py-2.5 text-center text-sm font-medium text-laupay-ink hover:bg-laupay-surface-muted"
            >
              Fund wallet
            </Link>
          ) : (
            <Link
              to={`/app/transactions/${order.id}`}
              className="flex flex-1 items-center justify-center rounded-md border border-laupay-border px-4 py-2.5 text-center text-sm font-medium text-laupay-ink hover:bg-laupay-surface-muted"
            >
              View details
            </Link>
          )}
        </div>
      </div>
    </Card>
    </>
  );
}

function LiveTransactionNotice({ tone, title, message }: { tone: "success" | "error" | "pending"; title: string; message: string }) {
  const color = tone === "success" ? "success" : tone === "pending" ? "pending" : "danger";
  return <div role="status" className={`fixed inset-x-4 top-4 z-[60] mx-auto max-w-sm rounded-xl border px-4 py-3 shadow-[0_16px_40px_rgba(23,29,80,.2)] ${color === "success" ? "border-laupay-success/30 bg-white" : color === "pending" ? "border-laupay-amber/40 bg-white" : "border-laupay-danger/30 bg-white"}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${color === "success" ? "bg-laupay-success/15 text-laupay-success" : color === "pending" ? "bg-laupay-amber/20 text-laupay-pending" : "bg-laupay-danger/10 text-laupay-danger"}`}>{color === "success" ? "✓" : color === "pending" ? "…" : "!"}</span><div><p className="text-sm font-bold text-laupay-ink">{title}</p><p className="mt-0.5 text-xs leading-5 text-laupay-ink-muted">{message}</p></div></div></div>;
}

function maskPhone(value: string) { return value.length > 6 ? `${value.slice(0, 4)}••••${value.slice(-3)}` : value; }
