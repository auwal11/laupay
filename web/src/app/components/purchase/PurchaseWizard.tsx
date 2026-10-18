import { FlowMark } from "@/components/laupay/FlowMark";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@app/components/ui/Button";
import { Input } from "@app/components/ui/Input";
import { Card } from "@app/components/ui/Card";
import { StatusBadge } from "@app/components/ui/Badge";
import { PinPad } from "@app/components/security/PinPad";
import { formatNaira } from "@app/lib/format";
import { useReducedMotion } from "@app/hooks/useReducedMotion";
import { usePurchaseFlow } from "@app/hooks/usePurchaseFlow";
import type { PurchaseKind, Order } from "@app/types/orders";
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
  const { state } = flow;

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
              <PhoneForm onSubmit={flow.submitPhoneNumber} initialValue={state.phoneNumber} />
            </StepCard>
          )}

          {state.step === "select_amount_plan" && (
            <StepCard title={STEP_LABELS.select_amount_plan} onBack={flow.goBack}>
              {kind === "airtime" ? (
                <div className="grid grid-cols-3 gap-2">
                  {flow.airtimeAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => flow.selectAmount(amount)}
                      className="rounded-md border border-laupay-border bg-white px-3 py-3 text-sm font-semibold text-laupay-ink hover:border-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
                    >
                      {formatNaira(amount)}
                    </button>
                  ))}
                </div>
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
                <p className="text-sm text-laupay-ink-muted">Sending this to LAUPAY for confirmation…</p>
              </div>
            </StepCard>
          )}

          {state.step === "verify" && (
            <StepCard title={STEP_LABELS.verify}>
              <p className="mb-4 text-center text-sm text-laupay-ink-muted">
                For your security, enter your transaction PIN to finish this purchase.
              </p>
              <PinPad
                label="Transaction PIN"
                error={state.verifyError}
                onComplete={flow.submitVerification}
              />
            </StepCard>
          )}

          {state.step === "result" && (
            <ResultCard kind={kind} order={state.order} error={state.error} onRestart={flow.restart} />
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

function PhoneForm({ onSubmit, initialValue }: { onSubmit: (v: string) => void; initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\+?\d{10,14}$/.test(value.replace(/\s/g, ""))) {
      setError("Enter a valid phone number.");
      return;
    }
    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
      <Button type="submit" fullWidth>
        Continue
      </Button>
    </form>
  );
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
  error,
  onRestart,
}: {
  kind: PurchaseKind;
  order: Order | null;
  error: ApiError | null;
  onRestart: () => void;
}) {
  if (error) {
    return (
      <Card>
        <p className="text-sm font-semibold text-laupay-danger">Couldn't complete this purchase</p>
        <p className="mt-2 text-sm text-laupay-ink-muted">{error.message}</p>
        <Button className="mt-4" fullWidth onClick={onRestart}>
          Try again
        </Button>
      </Card>
    );
  }

  if (!order) return null;

  const terminalMessage = TERMINAL_MESSAGES[order.status];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-laupay-ink">
          {kind === "airtime" ? "Airtime" : "Data"} purchase
        </p>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-laupay-ink">
        {formatNaira(order.total ?? order.amount)}
      </p>
      <p className="mt-1 text-sm text-laupay-ink-muted">{order.phoneNumber}</p>
      {order.status === "failed" && order.failureReason && (
        <p className="mt-2 text-sm text-laupay-danger">{order.failureReason}</p>
      )}
      {terminalMessage && (
        <p
          className={
            "mt-2 text-sm " + (terminalMessage.tone === "danger" ? "text-laupay-danger" : "text-laupay-pending")
          }
        >
          {terminalMessage.text}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Link
          to={`/app/transactions/${order.id}`}
          className="flex-1 rounded-md border border-laupay-border px-4 py-2.5 text-center text-sm font-medium text-laupay-ink hover:bg-laupay-surface-muted"
        >
          View details
        </Link>
        <Button className="flex-1" onClick={onRestart}>
          New purchase
        </Button>
      </div>
    </Card>
  );
}
