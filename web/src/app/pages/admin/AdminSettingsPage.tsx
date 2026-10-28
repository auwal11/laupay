import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
  ModeBadge,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  Td,
  Th,
  useAsync,
} from "@app/admin/ui";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { ErrorState } from "@app/components/ui/ErrorState";
import { Input } from "@app/components/ui/Input";
import { formatDateTime } from "@app/lib/format";

const EDITABLE = [
  { key: "support_email", label: "Support email" },
  { key: "support_phone", label: "Support phone" },
  { key: "maintenance_message", label: "Maintenance message" },
  { key: "order_timeout_minutes", label: "Order timeout (minutes)", type: "number" },
  { key: "margin_airtime_percent", label: "Airtime margin (%)", type: "number" },
  { key: "margin_data_percent", label: "Data margin (%)", type: "number" },
  { key: "otp_max_attempts", label: "OTP max attempts", type: "number" },
  { key: "otp_cooldown_seconds", label: "OTP cooldown (seconds)", type: "number" },
  { key: "risk_max_orders_per_day", label: "Max orders per day", type: "number" },
  { key: "risk_max_amount_per_day", label: "Max daily amount (NGN)", type: "number" },
  { key: "risk_max_failed_tx_per_hour", label: "Max failed tx per hour", type: "number" },
] as const;

const SWITCHES = [
  { key: "service_airtime_enabled", label: "Airtime service" },
  { key: "service_data_enabled", label: "Data service" },
  { key: "service_wallet_funding_enabled", label: "Wallet funding" },
  { key: "maintenance_mode", label: "Maintenance mode" },
];

export function AdminSettingsPage() {
  const state = useAsync(() => adminService.settings(), []);
  const risk = useAsync(() => adminService.riskEvents({ pageSize: 10 }), []);
  const [form, setForm] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    danger?: boolean;
    requireToken?: string;
    run: (reason: string) => Promise<{ ok: boolean; error?: { message: string } }>;
  } | null>(null);
  const [mode, setMode] = useState("provider_test");
  const [modeReason, setModeReason] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (state.status === "success") {
      setForm({ ...(state.data.settings ?? {}) });
      const effective = state.data.effective?.fulfillmentMode ?? state.data.fulfillmentMode;
      setMode(effective === "live" ? "live" : effective === "simulated" || effective === "mock" ? "simulated" : "provider_test");
    }
  }, [state.status, state.status === "success" ? state.data : null]);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError("Enter a reason of at least 5 characters.");
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    const payload: Record<string, string> = {};
    for (const field of EDITABLE) payload[field.key] = form[field.key] ?? "";
    payload.risk_require_second_approval = form.risk_require_second_approval ?? "false";
    const result = await adminService.updateSettingsV2(payload, reason.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setReason("");
    setNotice("Settings saved and audited.");
    state.reload();
  }

  async function runPending(r: string) {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await pending.run(r);
    setBusy(false);
    if (!result.ok) {
      setError(result.error?.message ?? "Action failed.");
      return;
    }
    setPending(null);
    setNotice(`${pending.confirmLabel} completed.`);
    state.reload();
    risk.reload();
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Settings" />
        <LoadingRows rows={5} />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState error={state.error} onRetry={state.reload} />;

  const settings = state.data;
  const values = settings.settings ?? {};

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Runtime configuration, service switches, provider mode and risk limits. Secrets stay in environment variables."
      />

      {(notice || error) && (
        <p
          role={error ? "alert" : "status"}
          className={
            "rounded-lg px-4 py-3 text-sm font-medium " +
            (error ? "bg-red-50 text-laupay-danger" : "bg-green-50 text-laupay-success")
          }
        >
          {error ?? notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-laupay-ink">Service switches</h2>
          <p className="mt-1 text-xs text-laupay-ink-muted">
            Kill switches take effect immediately for new requests. Each change requires a reason.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {SWITCHES.map((sw) => {
              const paused = sw.key === "maintenance_mode" ? values[sw.key] === "true" : values[sw.key] === "false";
              return (
                <div key={sw.key} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-laupay-ink-muted">{sw.label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPending({
                        title: `${paused ? "Resume" : "Pause"} ${sw.label}`,
                        description: paused
                          ? "New requests for this service will be accepted again."
                          : "New requests for this service will be rejected immediately.",
                        confirmLabel: paused ? "Resume" : "Pause",
                        danger: !paused,
                        run: (r) => adminService.killSwitch(sw.key, !paused, r),
                      })
                    }
                    className={
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                      (paused
                        ? "bg-red-50 text-laupay-danger hover:bg-red-100"
                        : "bg-green-50 text-laupay-success hover:bg-green-100")
                    }
                  >
                    {paused ? "PAUSED — resume" : "ON — pause"}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-laupay-ink">Provider mode</h2>
          <dl className="mt-2 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-laupay-ink-muted">Effective mode</dt>
              <dd>
                <ModeBadge mode={settings.effective?.fulfillmentMode ?? settings.fulfillmentMode} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-laupay-ink-muted">Payment provider</dt>
              <dd className="font-medium">{settings.effective?.paymentProvider ?? String(settings.providers.paymentProvider ?? "—")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-laupay-ink-muted">VTU provider</dt>
              <dd className="font-medium">{String(settings.providers.vtuProvider ?? "—")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-laupay-ink-muted">Mail provider</dt>
              <dd className="font-medium">{settings.mailProvider}</dd>
            </div>
          </dl>
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPending({
                title: `Switch provider mode to ${mode}`,
                description:
                  mode === "live"
                    ? "LIVE mode sends real orders to the provider. This is irreversible without another audited switch."
                    : "Changes how orders are fulfilled for new requests.",
                confirmLabel: "Switch mode",
                danger: mode === "live",
                requireToken: mode === "live" ? "CONFIRM" : undefined,
                run: (r) => adminService.providerMode(mode, r, mode === "live" ? "CONFIRM" : undefined),
              });
            }}
          >
            <div className="flex flex-wrap items-end gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="rounded-md border border-laupay-border bg-white px-3 py-2 text-sm"
              >
                <option value="simulated">Simulated</option>
                <option value="provider_test">Provider test</option>
                <option value="live">Live</option>
              </select>
              <div className="min-w-[200px] flex-1">
                <Input
                  label="Reason (required)"
                  value={modeReason}
                  onChange={(e) => setModeReason(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={modeReason.trim().length < 5}>
                Switch
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-laupay-ink">Operational limits</h2>
        <form onSubmit={saveSettings} className="mt-3 grid gap-3 sm:grid-cols-2">
          {EDITABLE.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              type={"type" in field ? field.type : "text"}
              value={form[field.key] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          ))}
          <label className="flex items-center gap-2 text-sm text-laupay-ink">
            <input
              type="checkbox"
              checked={form.risk_require_second_approval === "true"}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, risk_require_second_approval: String(e.target.checked) }))
              }
            />
            Require second approval for risky actions
          </label>
          <div className="sm:col-span-2">
            <Input
              label="Reason for this change (required, audited)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy} disabled={reason.trim().length < 5}>
              Save limits
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-laupay-ink">Risk blacklist</h2>
        <p className="mt-1 text-xs text-laupay-ink-muted">
          Blacklisted phone numbers are blocked from placing orders and funding.
        </p>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const target = phone.trim();
            if (target.length < 7) return;
            setPending({
              title: `Blacklist ${target}`,
              description: "Blocks new orders and funding from this number.",
              confirmLabel: "Blacklist",
              danger: true,
              run: (r) => adminService.blacklistPhone(target, r),
            });
          }}
        >
          <div className="w-48">
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" variant="danger" disabled={phone.trim().length < 7}>
            Blacklist number
          </Button>
        </form>
        <ul className="mt-4 flex flex-col gap-2">
          {(settings.blacklist ?? []).map((entry) => (
            <li key={entry} className="flex items-center justify-between rounded-md bg-laupay-surface-muted px-3 py-2 text-sm">
              <span className="font-mono text-xs">{entry}</span>
              <Button
                variant="secondary"
                onClick={() =>
                  setPending({
                    title: `Remove ${entry} from blacklist`,
                    description: "Orders and funding from this number will be allowed again.",
                    confirmLabel: "Remove",
                    run: (r) => adminService.unblacklistPhone(entry, r),
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
          {(settings.blacklist ?? []).length === 0 && (
            <li className="text-xs text-laupay-ink-muted">No blacklisted numbers.</li>
          )}
        </ul>
      </Card>

      <Card className="p-0">
        <div className="border-b border-laupay-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-laupay-ink">Recent risk events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Type</Th>
                <Th>Severity</Th>
                <Th>Decision</Th>
                <Th>User</Th>
              </tr>
            </thead>
            <tbody>
              {(risk.status === "success" ? risk.data.items : []).map((event) => (
                <tr key={event.id} className="border-b border-laupay-border last:border-0">
                  <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">{formatDateTime(event.createdAt)}</Td>
                  <Td className="text-sm">{event.type.replace(/_/g, " ")}</Td>
                  <Td>
                    <StatusBadge value={event.severity} />
                  </Td>
                  <Td className="text-xs text-laupay-ink-muted">{event.decision?.replace(/_/g, " ") ?? "—"}</Td>
                  <Td className="text-xs">{event.user?.email ?? event.userId ?? "system"}</Td>
                </tr>
              ))}
              {(risk.status === "success" ? risk.data.items : []).length === 0 && (
                <tr>
                  <Td className="text-laupay-ink-muted">No risk events recorded.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ReasonDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        danger={pending?.danger}
        requireToken={pending?.requireToken}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(r) => void runPending(r)}
      />
    </div>
  );
}
