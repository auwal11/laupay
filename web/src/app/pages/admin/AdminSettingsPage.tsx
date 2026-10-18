import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { adminService } from "@app/admin/services";
import { LoadingRows, ModeBadge, PageHeader, useAsync } from "@app/admin/ui";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { ErrorState } from "@app/components/ui/ErrorState";
import { Input } from "@app/components/ui/Input";

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-laupay-border py-2.5 last:border-0">
      <span className="text-sm text-laupay-ink-muted">{label}</span>
      <span className="text-sm font-medium text-laupay-ink">{children}</span>
    </div>
  );
}

export function AdminSettingsPage() {
  const state = useAsync(() => adminService.settings(), []);
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("5000");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      setEnabled(state.data.autoTestCredit.enabled);
      setAmount(String(state.data.autoTestCredit.amount));
    }
  }, [state.status, state.status === "success" ? state.data : null]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await adminService.updateSettings({
      autoTestCreditEnabled: enabled,
      autoTestCreditAmount: Number(amount),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("Settings saved.");
    state.reload();
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

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Settings" description="Runtime configuration and platform status." />

      <Card>
        <h2 className="text-sm font-semibold text-laupay-ink">Platform</h2>
        <dl className="mt-2">
          <InfoRow label="Fulfillment mode">
            <ModeBadge mode={settings.fulfillmentMode} />
          </InfoRow>
          <InfoRow label="VTU provider">{String(settings.providers.vtuProvider ?? "—")}</InfoRow>
          <InfoRow label="Payment provider">
            {String(settings.providers.paymentProvider ?? "—")}
          </InfoRow>
          <InfoRow label="Mail provider">{settings.mailProvider}</InfoRow>
          <InfoRow label="Admin web origin">{settings.adminWebOrigin}</InfoRow>
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-laupay-ink">Automatic test credit</h2>
        <p className="mt-1 text-xs leading-5 text-laupay-ink-muted">
          When enabled, every new account receives a one-time test credit automatically right after
          it is verified and a transaction PIN is set. Amounts are recorded in the ledger as
          <span className="font-mono"> test_allocation</span> from Ibrahim Lau Provision Shop.
        </p>

        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <label className="flex items-center gap-3 text-sm font-medium text-laupay-ink">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-laupay-border text-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
            />
            Enable automatic test credit
          </label>

          <Input
            label="Amount (NGN)"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint="Applied once per new account."
            required
          />

          {notice && (
            <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-laupay-success">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-laupay-danger">
              {error}
            </p>
          )}

          <div>
            <Button type="submit" loading={busy}>
              Save settings
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
