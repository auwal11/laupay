import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pencil, Phone, Trash2, UserPlus } from "lucide-react";
import { Card } from "@app/components/ui/Card";
import { Button } from "@app/components/ui/Button";
import { Input } from "@app/components/ui/Input";
import { Skeleton } from "@app/components/ui/Skeleton";
import { EmptyState } from "@app/components/ui/EmptyState";
import { beneficiaries } from "@app/services";
import type { Beneficiary, BeneficiaryNetwork } from "@app/types/beneficiaries";

const NETWORKS: BeneficiaryNetwork[] = ["MTN", "AIRTEL", "GLO", "9MOBILE"];

const NETWORK_STYLES: Record<BeneficiaryNetwork, string> = {
  MTN: "bg-[#FFCB05]/15 text-[#8a6d00]",
  AIRTEL: "bg-[#E40000]/10 text-[#b00000]",
  GLO: "bg-[#00A651]/10 text-[#007a3b]",
  "9MOBILE": "bg-[#0B7A3B]/10 text-[#075c2c]",
};

export function BeneficiariesPage() {
  const [items, setItems] = useState<Beneficiary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const result = await beneficiaries.list();
    if (result.ok) setItems(result.data);
    else { setItems([]); setError(result.error.message); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <Link to="/app/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-laupay-ink-muted hover:text-laupay-indigo">
        <ArrowLeft size={16} /> Profile
      </Link>
      <div>
        <h1 className="font-display text-xl font-semibold text-laupay-ink">Beneficiaries</h1>
        <p className="mt-1 text-sm text-laupay-ink-muted">Save the numbers you top up often so checkout takes seconds.</p>
      </div>

      <AddBeneficiaryForm
        onSaved={(beneficiary) => {
          setNotice(`${beneficiary.label} saved.`);
          setItems((current) => {
            if (!current) return [beneficiary];
            const rest = current.filter((item) => item.id !== beneficiary.id);
            return [beneficiary, ...rest];
          });
        }}
      />

      {notice && <p role="status" className="text-sm text-laupay-success">{notice}</p>}
      {error && (
        <div role="alert" className="rounded-lg border border-laupay-danger/30 bg-laupay-danger/5 p-4 text-sm text-laupay-danger">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-2 font-semibold underline">Try again</button>
        </div>
      )}

      {items === null ? (
        <div role="status" aria-label="Loading beneficiaries" className="flex flex-col gap-2">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16" />)}
        </div>
      ) : items.length === 0 && !error ? (
        <EmptyState title="No saved beneficiaries" description="Add a number above, or tick “Save this number” during checkout." />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((beneficiary) => (
            <BeneficiaryRow
              key={beneficiary.id}
              beneficiary={beneficiary}
              onChanged={(updated) => setItems((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null)}
              onDeleted={(id) => { setItems((current) => current?.filter((item) => item.id !== id) ?? null); setNotice("Beneficiary removed."); }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddBeneficiaryForm({ onSaved }: { onSaved: (beneficiary: Beneficiary) => void }) {
  const [label, setLabel] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [network, setNetwork] = useState<BeneficiaryNetwork>("MTN");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeNgPhone(phoneNumber);
    if (!normalized) { setError("Enter a valid Nigerian phone number, e.g. 08012345678."); return; }
    setSaving(true);
    setError(null);
    const result = await beneficiaries.save({ phoneNumber: normalized, network, ...(label.trim() ? { label: label.trim() } : {}) });
    setSaving(false);
    if (!result.ok) { setError(result.error.message); return; }
    onSaved(result.data);
    setLabel("");
    setPhoneNumber("");
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-laupay-ink">Add a beneficiary</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <Input label="Name (optional)" placeholder="Mum, Office line…" value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} />
        <Input label="Phone number" type="tel" inputMode="tel" placeholder="08012345678" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-laupay-ink">
          Network
          <select
            value={network}
            onChange={(event) => setNetwork(event.target.value as BeneficiaryNetwork)}
            className="rounded-md border border-laupay-border bg-white px-3 py-2.5 text-sm text-laupay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
          >
            {NETWORKS.map((item) => <option key={item} value={item}>{networkLabel(item)}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-laupay-danger">{error}</p>}
        <Button type="submit" loading={saving} className="self-start"><UserPlus size={16} /> Save beneficiary</Button>
      </form>
    </Card>
  );
}

function BeneficiaryRow({
  beneficiary,
  onChanged,
  onDeleted,
}: {
  beneficiary: Beneficiary;
  onChanged: (beneficiary: Beneficiary) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(beneficiary.label);
  const [phoneNumber, setPhoneNumber] = useState(beneficiary.phoneNumber);
  const [network, setNetwork] = useState<BeneficiaryNetwork>(beneficiary.network);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const normalized = normalizeNgPhone(phoneNumber);
    if (!normalized) { setError("Enter a valid Nigerian phone number."); return; }
    setBusy(true);
    setError(null);
    const result = await beneficiaries.update(beneficiary.id, { label: label.trim() || network, phoneNumber: normalized, network });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    onChanged(result.data);
    setEditing(false);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await beneficiaries.remove(beneficiary.id);
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    onDeleted(beneficiary.id);
  }

  return (
    <li>
      <Card className="p-4">
        {editing ? (
          <div className="flex flex-col gap-3">
            <Input label="Name" value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} />
            <Input label="Phone number" type="tel" inputMode="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
            <label className="flex flex-col gap-1.5 text-sm font-medium text-laupay-ink">
              Network
              <select
                value={network}
                onChange={(event) => setNetwork(event.target.value as BeneficiaryNetwork)}
                className="rounded-md border border-laupay-border bg-white px-3 py-2.5 text-sm text-laupay-ink"
              >
                {NETWORKS.map((item) => <option key={item} value={item}>{networkLabel(item)}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="text-sm text-laupay-danger">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" loading={busy} onClick={() => void save()}>Save</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setEditing(false); setError(null); setLabel(beneficiary.label); setPhoneNumber(beneficiary.phoneNumber); setNetwork(beneficiary.network); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-laupay-surface-muted text-laupay-indigo"><Phone size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-laupay-ink">{beneficiary.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${NETWORK_STYLES[beneficiary.network]}`}>{networkLabel(beneficiary.network)}</span>
              </div>
              <p className="mt-0.5 text-sm tabular-nums text-laupay-ink-muted">{beneficiary.phoneNumber}</p>
              {error && <p role="alert" className="mt-1 text-xs text-laupay-danger">{error}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label={`Edit ${beneficiary.label}`} onClick={() => setEditing(true)} className="rounded-md p-2 text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-indigo"><Pencil size={16} /></button>
              {confirmingDelete ? (
                <div className="flex items-center gap-1">
                  <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-md px-2 py-1 text-xs font-semibold text-laupay-danger hover:bg-laupay-danger/10">Delete</button>
                  <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-md px-2 py-1 text-xs font-semibold text-laupay-ink-muted">No</button>
                </div>
              ) : (
                <button type="button" aria-label={`Remove ${beneficiary.label}`} onClick={() => setConfirmingDelete(true)} className="rounded-md p-2 text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-danger"><Trash2 size={16} /></button>
              )}
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

function networkLabel(network: BeneficiaryNetwork): string {
  return network === "9MOBILE" ? "9mobile" : network.charAt(0) + network.slice(1).toLowerCase();
}

export function normalizeNgPhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  if (!compact) return "";
  if (/^0[789]\d{9}$/.test(compact)) return compact;
  if (/^\+234[789]\d{9}$/.test(compact)) return `0${compact.slice(4)}`;
  return "";
}
