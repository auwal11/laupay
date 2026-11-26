import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, FormField, InlineNotice, NumericPinPad, Screen, StatusBadge } from '../src/components/ui';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
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
    <NumericPinPad value={pin} onChange={setPin} disabled={busy} />
    {error ? <InlineNotice title="Withdrawal not submitted" body={error} tone="error" /> : null}
    <AppButton title="Authorize and submit" loading={busy} disabled={busy || !/^\d{4}$/.test(pin)} onPress={() => void submit()} />
  </Shell>;

  if (step === 'processing') return <Shell title="Processing withdrawal" step="4 of 4"><View style={s.processing}><ActivityIndicator size="large" color={colors.gold} /><Text style={s.heading}>Checking backend status…</Text><Text style={s.body}>Keep this screen open. LAUPAY may return pending while the request is reviewed.</Text></View></Shell>;

  if (step === 'result' && request) return <Shell title="Withdrawal result" step="Complete"><AppCard><Text style={s.heading}>Withdrawal request</Text><View style={s.status}><Text style={s.label}>Backend status</Text><StatusBadge status={request.status} /></View><Summary label="Amount" value={money(request.amount)} /><Summary label="Reference" value={request.reference || request.id} /><Summary label="Bank account" value={`•••• ${request.accountNumber.slice(-4)}`} />{request.failureReason ? <InlineNotice title="Why it did not complete" body={request.failureReason} tone="error" /> : <Text style={s.note}>{FINAL.has(statusKey(request.status)) ? 'This result came from the LAUPAY backend.' : 'The backend has not returned a final state. Check history before retrying.'}</Text>}</AppCard><AppButton title="Share receipt" variant="secondary" onPress={() => void Share.share({ message: `LAUPAY withdrawal\nAmount: ${money(request.amount)}\nReference: ${request.reference || request.id}\nStatus: ${request.status}` })} /><AppButton title="Done" onPress={() => router.replace('/(tabs)')} /><AppButton title="Open wallet" variant="ghost" onPress={() => router.replace('/wallet')} /></Shell>;

  const orderedBanks = [...(banks.data || [])].sort((a, b) => popularRank(a.name) - popularRank(b.name));
  return <Shell title="Withdraw" step="1 of 4"><InlineNotice title="Eligibility and review" body="A bank list does not guarantee payout availability. The backend may reject test-credit funds or hold a request for review; payout is never assumed automatically." />
    <FormField label="Amount (₦100–₦500,000)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Enter amount" />
    <Text style={s.label}>Choose a backend-provided bank</Text><Text style={s.body}>Select a bank to continue. Popular banks appear first in the picker when returned by LAUPAY.</Text>
    {banks.isPending ? <Text style={s.body}>Loading verified banks…</Text> : null}
    {banks.isError ? <InlineNotice title="Bank list unavailable" body="No static bank directory is used." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void banks.refetch()} />} /> : null}
    {!banks.isPending && !banks.isError ? <><Pressable accessibilityRole="button" accessibilityLabel={bank ? `Selected bank ${bank.name}. Tap to change.` : 'Choose a bank'} onPress={() => { setBankSearch(''); setPickerOpen(true); }} style={s.bankField}><View style={s.bankFieldCopy}><Text style={bank ? s.bankValue : s.bankPlaceholder}>{bank?.name || 'Select a bank'}</Text>{bank ? <Text style={s.bankMeta}>Backend bank code: {bank.code}</Text> : null}</View><Text style={s.bankAction}>{bank ? 'Change' : 'Choose'}</Text></Pressable><BankPickerModal visible={pickerOpen} banks={orderedBanks} search={bankSearch} onSearch={setBankSearch} onClose={() => { setPickerOpen(false); setBankSearch(''); }} onSelect={(item) => { setBank(item); setPickerOpen(false); setBankSearch(''); }} /></> : null}
    <FormField label="Account name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Name on bank account" /><FormField label="10-digit account number" value={account} onChangeText={(v) => setAccount(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" maxLength={10} placeholder="0123456789" />
    {error ? <InlineNotice title="Something went wrong" body={error} tone="error" /> : null}<AppButton title="Review withdrawal" disabled={!valid} onPress={() => setStep('review')} />
  </Shell>;
}
function BankPickerModal({ visible, banks, search, onSearch, onClose, onSelect }: { visible: boolean; banks: Bank[]; search: string; onSearch: (value: string) => void; onClose: () => void; onSelect: (bank: Bank) => void }) {
  const filtered = banks.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()) || item.code.toLowerCase().includes(search.trim().toLowerCase()));
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={s.modalBackdrop}><View style={s.pickerSheet}><View style={s.pickerHeader}><View><Text style={s.pickerKicker}>LAUPAY WALLET</Text><Text style={s.pickerTitle}>Choose a bank</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close bank picker" onPress={onClose} style={s.closeButton}><Text style={s.closeText}>×</Text></Pressable></View><TextInput value={search} onChangeText={onSearch} autoFocus placeholder="Search banks" placeholderTextColor={colors.muted} style={s.searchInput} autoCapitalize="none" autoCorrect={false} /><FlatList data={filtered} keyExtractor={(item) => item.code} keyboardShouldPersistTaps="handled" contentContainerStyle={s.pickerList} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.name}`} onPress={() => onSelect(item)} style={({ pressed }) => [s.bankRow, pressed && s.bankRowPressed]}><View style={s.bankAvatar}><Text style={s.bankAvatarText}>{item.name.slice(0, 1).toUpperCase()}</Text></View><View style={s.bankRowCopy}><Text style={s.bankRowName}>{item.name}</Text><Text style={s.bankRowCode}>{item.code}</Text></View><Text style={s.chevron}>›</Text></Pressable>} ListEmptyComponent={<Text style={s.emptyBanks}>No backend-provided banks match that search.</Text>} /></View></View>
  </Modal>;
}
function popularRank(name: string) { const value = name.toLowerCase(); const index = ['opay', 'moniepoint', 'palmpay', 'kuda'].findIndex((item) => value.includes(item)); return index === -1 ? 100 : index; }
function Shell({ title, step, children, onBack }: { title: string; step: string; children: ReactNode; onBack?: () => void }) { return <Screen scroll><View style={s.header}>{onBack ? <Pressable onPress={onBack} accessibilityRole="button"><Text style={s.back}>‹ Back</Text></Pressable> : <Text style={s.back}>LAUPAY</Text>}<Text style={s.progress}>{step}</Text></View><Text style={s.kicker}>LAUPAY WALLET</Text><Text style={s.title}>{title}</Text>{children}</Screen>; }
function Summary({ label, value }: { label: string; value: string }) { return <View style={s.summary}><Text style={s.summaryLabel}>{label}</Text><Text style={s.summaryValue}>{value}</Text></View>; }
const s = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between' }, back: { color: colors.navy2, fontWeight: '800' }, progress: { color: colors.muted, fontSize: 12, fontWeight: '700' }, kicker: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: spacing.xl }, title: { fontSize: 28, fontWeight: '900', color: colors.midnight, marginTop: spacing.xs, marginBottom: spacing.md }, heading: { fontWeight: '900', color: colors.midnight, fontSize: 18, marginBottom: spacing.sm }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: spacing.md }, label: { color: colors.navy, fontWeight: '800', marginTop: spacing.sm }, bankField: { minHeight: 68, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }, bankFieldCopy: { flex: 1, gap: 3 }, bankPlaceholder: { color: colors.muted, fontSize: 16 }, bankValue: { color: colors.navy, fontSize: 16, fontWeight: '800' }, bankMeta: { color: colors.muted, fontSize: 11 }, bankAction: { color: colors.navy2, fontWeight: '900', marginLeft: spacing.md }, modalBackdrop: { flex: 1, backgroundColor: '#12142E66', justifyContent: 'flex-end' }, pickerSheet: { maxHeight: '86%', minHeight: '55%', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: spacing.xxxl }, pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }, pickerKicker: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, pickerTitle: { color: colors.midnight, fontSize: 24, fontWeight: '900', marginTop: 4 }, closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }, closeText: { color: colors.midnight, fontSize: 25, lineHeight: 28 }, searchInput: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: spacing.lg, color: colors.navy, fontSize: 16, marginBottom: spacing.md }, pickerList: { gap: 8, paddingBottom: spacing.xl }, bankRow: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md }, bankRowPressed: { backgroundColor: colors.softBlue, transform: [{ scale: .99 }] }, bankAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }, bankAvatarText: { color: colors.white, fontWeight: '900' }, bankRowCopy: { flex: 1, gap: 2 }, bankRowName: { color: colors.navy, fontSize: 14, fontWeight: '800' }, bankRowCode: { color: colors.muted, fontSize: 11 }, chevron: { color: colors.navy2, fontSize: 26 }, emptyBanks: { color: colors.muted, textAlign: 'center', padding: spacing.xl }, processing: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl }, status: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, summary: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm }, summaryLabel: { color: colors.muted, fontSize: 11 }, summaryValue: { color: colors.navy, fontSize: 15, fontWeight: '800', marginTop: 2 }, note: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.md } });
