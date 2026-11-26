import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, FormField, InlineNotice, Screen, StatusBadge } from './ui';
import { catalogApi, ordersApi, Network, DataPlan, Order } from '../api/services';
import { colors, spacing } from '../theme';

const naira = (value: number | string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(value));
const FINAL_STATES = new Set(['success', 'fulfilled', 'failed', 'refunded', 'cancelled']);
const normalize = (value: string) => value.toLowerCase().replace(/[-\s]/g, '_');

type Step = 'form' | 'review' | 'pin' | 'processing' | 'result';

export default function PurchaseFlow({ kind }: { kind: 'airtime' | 'data' }) {
  const params = useLocalSearchParams<{ network?: string }>();
  const networks = useQuery({ queryKey: ['catalog-networks'], queryFn: catalogApi.networks });
  const [step, setStep] = useState<Step>('form');
  const [network, setNetwork] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [plan, setPlan] = useState<DataPlan | null>(null);
  const [pin, setPin] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const chosen = network || params.network || '';
  const selected = networks.data?.find((item) => item.code === chosen) || null;
  const plans = useQuery({ queryKey: ['data-plans', chosen], queryFn: () => catalogApi.dataPlans(chosen), enabled: kind === 'data' && Boolean(chosen) });

  useEffect(() => {
    if (!order || step !== 'processing') return;
    let active = true;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const current = await ordersApi.detail(order.id);
        if (!active) return;
        setOrder(current);
        if (FINAL_STATES.has(normalize(current.status)) || attempts >= 12) setStep('result');
      } catch (pollError) {
        if (attempts >= 12 && active) {
          setError(pollError instanceof Error ? pollError.message : 'Could not refresh the order status.');
          setStep('result');
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [order, step]);

  const validPhone = /^(?:\+234|0)[789]\d{9}$/.test(phone.trim());
  const parsedAmount = Number(amount);
  const formValid = Boolean(chosen) && validPhone && (kind === 'data' ? Boolean(plan) : Number.isFinite(parsedAmount) && parsedAmount >= 50);
  const price = kind === 'data' ? Number(plan?.priceNaira ?? 0) : parsedAmount;

  const submit = async () => {
    if (submitting.current || !idempotencyKey.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = kind === 'airtime'
        ? await ordersApi.airtime({ network: chosen, phoneNumber: phone.trim(), amount: parsedAmount, idempotencyKey: idempotencyKey.current, pin })
        : await ordersApi.data({ network: chosen, phoneNumber: phone.trim(), dataPlanId: plan!.id, idempotencyKey: idempotencyKey.current, pin });
      setOrder(result);
      setPin('');
      setStep('processing');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The backend could not accept this request.');
      submitting.current = false;
      setBusy(false);
    }
  };

  const startReview = () => { setError(null); setStep('review'); };
  const startPin = () => { idempotencyKey.current ??= Crypto.randomUUID(); setError(null); setStep('pin'); };
  if (step === 'review') return <FlowShell title={`Review ${kind}`} step="2 of 4" onBack={() => setStep('form')}>
    <AppCard><Text style={s.heading}>{kind === 'airtime' ? 'Airtime purchase' : 'Data purchase'}</Text><Summary label="Network" value={selected?.name ?? chosen} /><Summary label="Recipient" value={phone} /><Summary label={kind === 'data' ? 'Plan' : 'Amount'} value={kind === 'data' ? `${plan?.label ?? ''} · ${naira(price)}` : naira(price)} /><Text style={s.note}>Prices, wallet debit and final status are controlled by LAUPAY backend. Review carefully before continuing.</Text></AppCard>
    <AppButton title="Continue to PIN" onPress={startPin} />
  </FlowShell>;

  if (step === 'pin') return <FlowShell title="Confirm transaction" step="3 of 4" onBack={() => setStep('review')}>
    <Text style={s.body}>Enter your 4-digit transaction PIN to authorize this request. Your PIN is sent only to the LAUPAY backend.</Text>
    <FormField label="Transaction PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="4 digits" autoFocus />
    {error ? <InlineNotice title="Could not submit" body={error} tone="error" /> : null}
    <AppButton title="Authorize and submit" loading={busy} disabled={busy || !/^\d{4}$/.test(pin)} onPress={() => void submit()} />
    <Text style={s.note}>Do not press submit more than once. A unique request key protects this transaction from accidental duplicates.</Text>
  </FlowShell>;

  if (step === 'processing') return <FlowShell title="Processing" step="4 of 4">
    <View style={s.processing}><ActivityIndicator size="large" color={colors.gold} /><Text style={s.heading}>Checking the backend result…</Text><Text style={s.body}>Please keep this screen open. We will not assume success until LAUPAY returns the final status.</Text></View>
  </FlowShell>;

  if (step === 'result' && order) return <FlowShell title="Transaction result" step="Complete">
    <AppCard><Text style={s.heading}>{kind === 'airtime' ? 'Airtime purchase' : 'Data purchase'}</Text><View style={s.statusRow}><Text style={s.label}>Backend status</Text><StatusBadge status={order.status} /></View><Summary label="Amount" value={naira(order.amount)} /><Summary label="Recipient" value={order.phoneNumber || phone} /><Summary label="Reference" value={order.id} /><Text style={s.note}>{FINAL_STATES.has(normalize(order.status)) ? 'This result came from the LAUPAY backend.' : 'The backend has not returned a final state yet. Check transaction history before retrying.'}</Text>{order.failureReason ? <InlineNotice title="Why this did not complete" body={order.failureReason} tone="error" /> : null}</AppCard>
    <AppButton title="Back to dashboard" onPress={() => router.replace('/(tabs)')} /><AppButton title="View transaction history" variant="secondary" onPress={() => router.replace('/(tabs)/history')} />
  </FlowShell>;

  return <FlowShell title={kind === 'airtime' ? 'Buy airtime' : 'Buy data'} step="1 of 4">
    <Text style={s.body}>Choose from the live LAUPAY catalog. Nothing is invented locally.</Text>
    {networks.isError ? <InlineNotice title="Networks unavailable" body="We could not load configured networks from LAUPAY." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void networks.refetch()} />} /> : null}
    <Text style={s.label}>Network</Text><View style={s.choices}>{(networks.data || []).map((item: Network) => <AppButton key={item.code} title={item.name} variant={chosen === item.code ? 'primary' : 'secondary'} onPress={() => { setNetwork(item.code); setPlan(null); }} />)}</View>
    <FormField label="Nigerian phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08012345678" maxLength={14} />
    {kind === 'airtime' ? <><FormField label="Amount (₦)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Minimum ₦50" /><View style={s.choices}>{['100', '200', '500', '1000'].map((value) => <AppButton key={value} title={`₦${value}`} variant={amount === value ? 'primary' : 'secondary'} onPress={() => setAmount(value)} />)}</View></> : <><Text style={s.label}>Live data plans</Text>{plans.isPending && chosen ? <Text style={s.body}>Loading plans…</Text> : null}{plans.isError ? <InlineNotice title="Plans unavailable" body="No price is assumed. Retry the live catalog." tone="error" action={<AppButton title="Retry plans" variant="secondary" onPress={() => void plans.refetch()} />} /> : null}<View style={s.planList}>{(plans.data || []).map((item) => <AppButton key={item.id} title={`${item.label} · ${naira(item.priceNaira)}${item.validityDays ? ` · ${item.validityDays} days` : ''}`} variant={plan?.id === item.id ? 'primary' : 'secondary'} onPress={() => setPlan(item)} />)}</View></>}
    {error ? <InlineNotice title="Something went wrong" body={error} tone="error" /> : null}
    <AppButton title="Review purchase" disabled={!formValid} onPress={startReview} />
  </FlowShell>;
}

function FlowShell({ title, step, children, onBack }: { title: string; step: string; children: ReactNode; onBack?: () => void }) {
  return <Screen scroll><View style={s.header}>{onBack ? <Pressable accessibilityRole="button" onPress={onBack}><Text style={s.back}>‹ Back</Text></Pressable> : <Text style={s.back}>LAUPAY</Text>}<Text style={s.progress}>{step}</Text></View><Text style={s.kicker}>LAUPAY SERVICES</Text><Text style={s.title}>{title}</Text>{children}</Screen>;
}
function Summary({ label, value }: { label: string; value: string }) { return <View style={s.summary}><Text style={s.summaryLabel}>{label}</Text><Text style={s.summaryValue}>{value}</Text></View>; }
const s = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, back: { color: colors.navy2, fontWeight: '800', fontSize: 14 }, progress: { color: colors.muted, fontSize: 12, fontWeight: '700' }, kicker: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: spacing.xl }, title: { fontSize: 28, fontWeight: '900', color: colors.midnight, marginTop: spacing.xs, marginBottom: spacing.md }, heading: { fontWeight: '900', color: colors.midnight, fontSize: 18, marginBottom: spacing.sm }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: spacing.md }, label: { color: colors.navy, fontWeight: '800', marginTop: spacing.sm }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm }, planList: { gap: 8, marginBottom: spacing.md }, note: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.md }, processing: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl }, statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }, summary: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm }, summaryLabel: { color: colors.muted, fontSize: 11 }, summaryValue: { color: colors.navy, fontSize: 15, fontWeight: '800', marginTop: 2 } });
