import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, FormField, InlineNotice, Screen, StatusBadge } from './ui';
import { catalogApi, ordersApi, Network, DataPlan, Order } from '../api/services';
import { colors, spacing } from '../theme';

const naira = (value: number | string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value));
const FINAL_STATES = new Set(['success', 'successful', 'fulfilled', 'failed', 'refunded', 'cancelled', 'reversed']);
const normalize = (value: string) => value.toLowerCase().replace(/[-\s]/g, '_');
type Step = 'network' | 'phone' | 'product' | 'review' | 'pin' | 'processing' | 'result';

export default function PurchaseFlow({ kind }: { kind: 'airtime' | 'data' }) {
  const params = useLocalSearchParams<{ network?: string }>();
  const networks = useQuery({ queryKey: ['catalog-networks'], queryFn: catalogApi.networks });
  const [step, setStep] = useState<Step>(params.network ? 'phone' : 'network');
  const [network, setNetwork] = useState(params.network || '');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [plan, setPlan] = useState<DataPlan | null>(null);
  const [pin, setPin] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const selected = networks.data?.find((item) => item.code === network) || null;
  const plans = useQuery({ queryKey: ['data-plans', network], queryFn: () => catalogApi.dataPlans(network), enabled: kind === 'data' && Boolean(network) && step === 'product' });

  useEffect(() => {
    if (!order || step !== 'processing') return;
    let active = true; let attempts = 0;
    const poll = async () => { attempts += 1; try { const current = await ordersApi.detail(order.id); if (!active) return; setOrder(current); if (FINAL_STATES.has(normalize(current.status)) || attempts >= 12) setStep('result'); } catch (pollError) { if (attempts >= 12 && active) { setError(pollError instanceof Error ? pollError.message : 'Could not refresh the order status.'); setStep('result'); } } };
    void poll(); const timer = setInterval(() => void poll(), 5000); return () => { active = false; clearInterval(timer); };
  }, [order, step]);

  const validPhone = /^(?:\+234|0)[789]\d{9}$/.test(phone.trim());
  const parsedAmount = Number(amount);
  const productValid = kind === 'data' ? Boolean(plan) : Number.isFinite(parsedAmount) && parsedAmount >= 50;
  const price = kind === 'data' ? Number(plan?.priceNaira ?? 0) : parsedAmount;
  const submit = async () => {
    if (submitting.current || !idempotencyKey.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try { const result = kind === 'airtime' ? await ordersApi.airtime({ network, phoneNumber: phone.trim(), amount: parsedAmount, idempotencyKey: idempotencyKey.current, pin }) : await ordersApi.data({ network, phoneNumber: phone.trim(), dataPlanId: plan!.id, idempotencyKey: idempotencyKey.current, pin }); setOrder(result); setPin(''); setStep('processing'); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'The backend could not accept this request.'); submitting.current = false; setBusy(false); }
  };
  const back = (next: Step) => { setError(null); setStep(next); };
  const startPin = () => { idempotencyKey.current ??= Crypto.randomUUID(); setError(null); setStep('pin'); };

  if (step === 'network') return <FlowShell title="Choose network" step="1 of 4"><Text style={s.body}>Select a network from LAUPAY’s live catalog.</Text>{networks.isPending ? <Text style={s.body}>Loading networks…</Text> : networks.isError ? <InlineNotice title="Networks unavailable" body="We could not load configured networks from LAUPAY." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void networks.refetch()} />} /> : <View style={s.choices}>{(networks.data || []).map((item: Network) => <AppButton key={item.code} title={item.name} variant={network === item.code ? 'primary' : 'secondary'} onPress={() => { setNetwork(item.code); setStep('phone'); }} />)}</View>}</FlowShell>;

  if (step === 'phone') return <FlowShell title="Phone number" step="2 of 4" onBack={() => back('network')}><Text style={s.body}>Enter the Nigerian phone number that should receive the {kind}.</Text><FormField label="Nigerian phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08012345678" maxLength={14} error={phone && !validPhone ? 'Enter a valid Nigerian phone number.' : undefined} /><AppButton title="Continue" disabled={!validPhone} onPress={() => back('product')} /></FlowShell>;

  if (step === 'product') return <FlowShell title={kind === 'airtime' ? 'Choose amount' : 'Choose data plan'} step="3 of 4" onBack={() => back('phone')}><Text style={s.body}>{selected?.name || network} · {phone}</Text>{kind === 'airtime' ? <><FormField label="Amount (₦)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Minimum ₦50" /><View style={s.choices}>{['100', '200', '500', '1000'].map((value) => <AppButton key={value} title={`₦${value}`} variant={amount === value ? 'primary' : 'secondary'} onPress={() => setAmount(value)} />)}</View></> : <>{plans.isPending ? <Text style={s.body}>Loading live data plans…</Text> : null}{plans.isError ? <InlineNotice title="Plans unavailable" body="No price is assumed. Retry the live catalog." tone="error" action={<AppButton title="Retry plans" variant="secondary" onPress={() => void plans.refetch()} />} /> : null}<View style={s.planList}>{(plans.data || []).map((item) => <AppButton key={item.id} title={`${item.label} · ${naira(item.priceNaira)}${item.validityDays ? ` · ${item.validityDays} days` : ''}`} variant={plan?.id === item.id ? 'primary' : 'secondary'} onPress={() => setPlan(item)} />)}</View></>}<AppButton title="Review purchase" disabled={!productValid} onPress={() => back('review')} /></FlowShell>;

  if (step === 'review') return <FlowShell title="Review purchase" step="4 of 4" onBack={() => back('product')}><AppCard><Text style={s.heading}>{kind === 'airtime' ? 'Airtime purchase' : 'Data purchase'}</Text><Summary label="Network" value={selected?.name || network} /><Summary label="Recipient" value={phone} /><Summary label={kind === 'data' ? 'Plan' : 'Amount'} value={kind === 'data' ? `${plan?.label || ''} · ${naira(price)}` : naira(price)} /><Text style={s.note}>LAUPAY determines the final price, fees and transaction status. Review carefully before continuing.</Text></AppCard><AppButton title="Continue to PIN" onPress={startPin} /></FlowShell>;
  if (step === 'pin') return <FlowShell title="Verify it’s you" step="Security" onBack={() => back('review')}><Text style={s.body}>Enter your transaction PIN to finish this purchase. Your PIN is sent only to the LAUPAY backend.</Text><FormField label="Transaction PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="4 digits" autoFocus />{error ? <InlineNotice title="Could not submit" body={error} tone="error" /> : null}<AppButton title="Authorize and submit" loading={busy} disabled={busy || !/^\d{4}$/.test(pin)} onPress={() => void submit()} /><Text style={s.note}>Do not press submit more than once. A unique request key protects this transaction from duplicates.</Text></FlowShell>;
  if (step === 'processing') return <FlowShell title="Processing" step="Checking"><View style={s.processing}><ActivityIndicator size="large" color={colors.gold} /><Text style={s.heading}>Checking the backend result…</Text><Text style={s.body}>Please keep this screen open. Success is not assumed until LAUPAY returns the status.</Text></View></FlowShell>;
  if (step === 'result' && order) return <FlowShell title="Transaction result" step="Complete"><AppCard><Text style={s.heading}>{kind === 'airtime' ? 'Airtime purchase' : 'Data purchase'}</Text><View style={s.statusRow}><Text style={s.label}>Backend status</Text><StatusBadge status={order.status} /></View><Summary label="Amount" value={naira(order.amount)} /><Summary label="Recipient" value={order.phoneNumber || phone} /><Summary label="Reference" value={order.id} />{order.failureReason ? <InlineNotice title="Why this did not complete" body={order.failureReason} tone="error" /> : <Text style={s.note}>{FINAL_STATES.has(normalize(order.status)) ? 'This result came from the LAUPAY backend.' : 'The backend has not returned a final state yet. Check transaction history before retrying.'}</Text>}</AppCard><AppButton title="Back to dashboard" onPress={() => router.replace('/(tabs)')} /><AppButton title="View transaction history" variant="secondary" onPress={() => router.replace('/(tabs)/history')} /></FlowShell>;
  return null;
}

function FlowShell({ title, step, children, onBack }: { title: string; step: string; children: ReactNode; onBack?: () => void }) { return <Screen scroll><View style={s.header}>{onBack ? <Pressable accessibilityRole="button" onPress={onBack}><Text style={s.back}>‹ Back</Text></Pressable> : <Text style={s.back}>LAUPAY</Text>}<Text style={s.progress}>{step}</Text></View><Text style={s.kicker}>LAUPAY SERVICES</Text><Text style={s.title}>{title}</Text>{children}</Screen>; }
function Summary({ label, value }: { label: string; value: string }) { return <View style={s.summary}><Text style={s.summaryLabel}>{label}</Text><Text style={s.summaryValue}>{value}</Text></View>; }
const s = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, back: { color: colors.navy2, fontWeight: '800', fontSize: 14 }, progress: { color: colors.muted, fontSize: 12, fontWeight: '700' }, kicker: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: spacing.xl }, title: { fontSize: 28, fontWeight: '900', color: colors.midnight, marginTop: spacing.xs, marginBottom: spacing.md }, heading: { fontWeight: '900', color: colors.midnight, fontSize: 18, marginBottom: spacing.sm }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: spacing.md }, label: { color: colors.navy, fontWeight: '800', marginTop: spacing.sm }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }, planList: { gap: 8, marginBottom: spacing.md }, note: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.md }, processing: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl }, statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }, summary: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm }, summaryLabel: { color: colors.muted, fontSize: 11 }, summaryValue: { color: colors.navy, fontSize: 15, fontWeight: '800', marginTop: 2 } });
