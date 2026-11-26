import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, FormField, InlineNotice, Screen, StatusBadge } from '../src/components/ui';
import { Bank, Withdrawal, withdrawalsApi } from '../src/api/services';
import { colors, spacing } from '../src/theme';

type Step = 'details' | 'review' | 'pin' | 'processing' | 'result';
const FINAL = new Set(['success', 'successful', 'completed', 'failed', 'rejected', 'cancelled', 'paid', 'refunded', 'reversed', 'refund_failed']);
const statusKey = (value: string) => value.toLowerCase().replace(/[-\s]/g, '_');
const money = (value: string | number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(value));

export default function Withdraw() {
  const banks = useQuery({ queryKey: ['withdrawal-banks'], queryFn: withdrawalsApi.banks });
  const [step, setStep] = useState<Step>('details');
  const [bank, setBank] = useState<Bank | null>(null);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [request, setRequest] = useState<Withdrawal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (!request || step !== 'processing') return;
    let active = true; let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const current = await withdrawalsApi.detail(request.id);
        if (!active) return;
        setRequest(current);
        if (FINAL.has(statusKey(current.status)) || attempts >= 12) setStep('result');
      } catch (e) {
        if (attempts >= 12 && active) { setError(e instanceof Error ? e.message : 'Could not refresh withdrawal status.'); setStep('result'); }
      }
    };
    void poll(); const timer = setInterval(() => void poll(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [request, step]);

  const value = Number(amount);
  const valid = Boolean(bank) && Number.isFinite(value) && value >= 100 && value <= 500000 && account.length === 10 && name.trim().length >= 2;
  const submit = async () => {
    if (submitting.current || !key.current || !bank) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      const result = await withdrawalsApi.create({ amount: value, bankName: bank.name, bankCode: bank.code, accountName: name.trim(), accountNumber: account, pin, idempotencyKey: key.current });
      setRequest(result); setPin(''); setStep('processing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The backend could not accept this withdrawal.');
      submitting.current = false; setBusy(false);
    }
  };
  const startPin = () => { key.current ??= Crypto.randomUUID(); setError(null); setStep('pin'); };

  if (step === 'review') return <Shell title="Review withdrawal" step="2 of 4" onBack={() => setStep('details')}>
    <AppCard><Text style={s.heading}>Withdrawal details</Text><Summary label="Amount" value={money(value)} /><Summary label="Bank" value={bank?.name || ''} /><Summary label="Account" value={`•••• ${account.slice(-4)}`} /><Summary label="Account name" value={name.trim()} /><Text style={s.note}>The backend decides whether this request is eligible and whether it remains pending for review. No payout is assumed from a successful HTTP response.</Text></AppCard>
    <AppButton title="Continue to PIN" onPress={startPin} />
  </Shell>;

  if (step === 'pin') return <Shell title="Authorize withdrawal" step="3 of 4" onBack={() => setStep('review')}>
    <Text style={s.body}>Enter your 4-digit transaction PIN. This is the final authorization step before sending the request to LAUPAY.</Text>
    <FormField label="Transaction PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))} secureTextEntry keyboardType="number-pad" maxLength={4} autoFocus placeholder="4 digits" />
    {error ? <InlineNotice title="Withdrawal not submitted" body={error} tone="error" /> : null}
    <AppButton title="Authorize and submit" loading={busy} disabled={busy || !/^\d{4}$/.test(pin)} onPress={() => void submit()} />
  </Shell>;

  if (step === 'processing') return <Shell title="Processing withdrawal" step="4 of 4"><View style={s.processing}><ActivityIndicator size="large" color={colors.gold} /><Text style={s.heading}>Checking backend status…</Text><Text style={s.body}>Keep this screen open. LAUPAY may return pending while the request is reviewed.</Text></View></Shell>;

  if (step === 'result' && request) return <Shell title="Withdrawal result" step="Complete"><AppCard><Text style={s.heading}>Withdrawal request</Text><View style={s.status}><Text style={s.label}>Backend status</Text><StatusBadge status={request.status} /></View><Summary label="Amount" value={money(request.amount)} /><Summary label="Reference" value={request.reference || request.id} /><Summary label="Bank account" value={`•••• ${request.accountNumber.slice(-4)}`} />{request.failureReason ? <InlineNotice title="Why it did not complete" body={request.failureReason} tone="error" /> : <Text style={s.note}>{FINAL.has(statusKey(request.status)) ? 'This result came from the LAUPAY backend.' : 'The backend has not returned a final state. Check history before retrying.'}</Text>}</AppCard><AppButton title="Back to dashboard" onPress={() => router.replace('/(tabs)')} /><AppButton title="Open wallet" variant="secondary" onPress={() => router.replace('/wallet')} /></Shell>;

  return <Shell title="Withdraw" step="1 of 4"><InlineNotice title="Eligibility and review" body="A bank list does not guarantee payout availability. The backend may reject test-credit funds or hold a request for review; payout is never assumed automatically." />
    <FormField label="Amount (₦100–₦500,000)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Enter amount" />
    <Text style={s.label}>Choose a backend-provided bank</Text>{banks.isPending ? <Text style={s.body}>Loading verified banks…</Text> : null}{banks.isError ? <InlineNotice title="Bank list unavailable" body="No static bank directory is used." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void banks.refetch()} />} /> : null}<View style={s.list}>{(banks.data || []).map((item) => <AppButton key={item.code} title={item.name} variant={bank?.code === item.code ? 'primary' : 'secondary'} onPress={() => setBank(item)} />)}</View>
    <FormField label="Account name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Name on bank account" /><FormField label="10-digit account number" value={account} onChangeText={(v) => setAccount(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" maxLength={10} placeholder="0123456789" />
    {error ? <InlineNotice title="Something went wrong" body={error} tone="error" /> : null}<AppButton title="Review withdrawal" disabled={!valid} onPress={() => setStep('review')} />
  </Shell>;
}
function Shell({ title, step, children, onBack }: { title: string; step: string; children: ReactNode; onBack?: () => void }) { return <Screen scroll><View style={s.header}>{onBack ? <Pressable onPress={onBack} accessibilityRole="button"><Text style={s.back}>‹ Back</Text></Pressable> : <Text style={s.back}>LAUPAY</Text>}<Text style={s.progress}>{step}</Text></View><Text style={s.kicker}>LAUPAY WALLET</Text><Text style={s.title}>{title}</Text>{children}</Screen>; }
function Summary({ label, value }: { label: string; value: string }) { return <View style={s.summary}><Text style={s.summaryLabel}>{label}</Text><Text style={s.summaryValue}>{value}</Text></View>; }
const s = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between' }, back: { color: colors.navy2, fontWeight: '800' }, progress: { color: colors.muted, fontSize: 12, fontWeight: '700' }, kicker: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: spacing.xl }, title: { fontSize: 28, fontWeight: '900', color: colors.midnight, marginTop: spacing.xs, marginBottom: spacing.md }, heading: { fontWeight: '900', color: colors.midnight, fontSize: 18, marginBottom: spacing.sm }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: spacing.md }, label: { color: colors.navy, fontWeight: '800', marginTop: spacing.sm }, list: { gap: 8 }, processing: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl }, status: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, summary: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm }, summaryLabel: { color: colors.muted, fontSize: 11 }, summaryValue: { color: colors.navy, fontSize: 15, fontWeight: '800', marginTop: 2 }, note: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.md } });
