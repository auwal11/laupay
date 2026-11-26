import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, FormField, InlineNotice, NumericPinPad, Screen, StatusBadge } from '../src/components/ui';
import { Bank, Withdrawal, walletApi, withdrawalsApi } from '../src/api/services';
import { colors, spacing } from '../src/theme';

type Step = 'recipient' | 'amount' | 'confirm' | 'pin' | 'processing' | 'result';
const FINAL = new Set(['success', 'successful', 'completed', 'failed', 'rejected', 'cancelled', 'paid', 'refunded', 'reversed', 'refund_failed']);
const statusKey = (value: string) => value.toLowerCase().replace(/[-\s]/g, '_');
const money = (value: string | number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(value));
const popularRank = (name: string) => {
  const value = name.toLowerCase();
  const index = ['opay', 'moniepoint', 'palmpay', 'kuda'].findIndex((item) => value.includes(item));
  return index === -1 ? 100 : index;
};

export default function Withdraw() {
  const banks = useQuery({ queryKey: ['withdrawal-banks'], queryFn: withdrawalsApi.banks });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.getWallet });
  const [step, setStep] = useState<Step>('recipient');
  const [bank, setBank] = useState<Bank | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [narration, setNarration] = useState('');
  const [pin, setPin] = useState('');
  const [request, setRequest] = useState<Withdrawal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const submitting = useRef(false);
  const orderedBanks = [...(banks.data || [])].sort((a, b) => popularRank(a.name) - popularRank(b.name));
  const numericAmount = Number(amount);
  const amountValid = Number.isFinite(numericAmount) && numericAmount >= 100 && numericAmount <= 500000;
  const recipientValid = Boolean(bank) && account.length === 10 && name.trim().length >= 2;

  useEffect(() => {
    if (!request || step !== 'processing') return;
    let active = true;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const current = await withdrawalsApi.detail(request.id);
        if (!active) return;
        setRequest(current);
        if (FINAL.has(statusKey(current.status)) || attempts >= 12) setStep('result');
      } catch (pollError) {
        if (attempts >= 12 && active) {
          setError(pollError instanceof Error ? pollError.message : 'Could not refresh withdrawal status.');
          setStep('result');
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [request, step]);

  const submit = async () => {
    if (submitting.current || !key.current || !bank) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await withdrawalsApi.create({
        amount: numericAmount,
        bankName: bank.name,
        bankCode: bank.code,
        accountName: name.trim(),
        accountNumber: account,
        pin,
        idempotencyKey: key.current,
      });
      setRequest(result);
      setPin('');
      setStep('processing');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The backend could not accept this withdrawal.');
      submitting.current = false;
      setBusy(false);
    }
  };

  const goToPin = () => {
    key.current ??= Crypto.randomUUID();
    setError(null);
    setStep('pin');
  };
  const closePicker = () => { setPickerOpen(false); setBankSearch(''); };
  const selectBank = (selected: Bank) => { setBank(selected); closePicker(); };

  if (step === 'amount') return <Shell title="Add amount" step="2 of 4" onBack={() => setStep('recipient')}>
    <RecipientSummary bank={bank} account={account} name={name} />
    <View style={s.amountBlock}><Text style={s.amountLabel}>How much do you want to send?</Text><View style={s.amountInputRow}><Text style={s.currency}>₦</Text><TextInput value={amount} onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#A5ADC0" style={s.amountInput} accessibilityLabel="Withdrawal amount" /></View><Text style={s.balanceText}>Available wallet balance: {wallet.isPending ? 'Loading…' : wallet.data ? money(wallet.data.balance) : 'Unavailable'}</Text>{amount.length > 0 && !amountValid ? <Text style={s.validation}>Enter an amount between ₦100 and ₦500,000.</Text> : null}</View>
    <AppButton title="Continue" disabled={!amountValid} onPress={() => setStep('confirm')} />
  </Shell>;

  if (step === 'confirm') return <Shell title="Confirm payment" step="3 of 4" onBack={() => setStep('amount')}>
    <Text style={s.body}>Review the details carefully before authorizing this withdrawal.</Text>
    <AppCard><Text style={s.heading}>Payment summary</Text><Summary label="Recipient name" value={name.trim()} /><Summary label="Bank" value={bank?.name || ''} /><Summary label="Account number" value={account} /><Summary label="Amount" value={money(numericAmount)} /><Summary label="Fee" value="Backend-calculated" /><Summary label="Total debit" value="Confirmed by backend" /><Summary label="Paying from" value={wallet.data ? `Wallet · ${money(wallet.data.balance)} available` : 'LAUPAY wallet'} /></AppCard>
    <Text style={s.label}>Narration / description (optional)</Text><FormField label="Add a note" value={narration} onChangeText={setNarration} placeholder="What is this payment for?" maxLength={80} /><View style={s.tagRow}>{['Gift', 'Food', 'Transport', 'Support'].map((tag) => <Pressable key={tag} accessibilityRole="button" onPress={() => setNarration(tag)} style={[s.tag, narration === tag && s.tagSelected]}><Text style={[s.tagText, narration === tag && s.tagTextSelected]}>{tag}</Text></Pressable>)}</View><Text style={s.note}>The current withdrawal API does not accept a narration field, so it is not included in the financial request payload.</Text>
    <AppButton title={`Pay ${money(numericAmount)}`} onPress={goToPin} />
  </Shell>;

  if (step === 'pin') return <Shell title="Authorize payment" step="4 of 4" onBack={() => setStep('confirm')}>
    <Text style={s.body}>Enter your 4-digit transaction PIN to authorize this payment. Your PIN is sent only to the LAUPAY backend.</Text><NumericPinPad value={pin} onChange={setPin} disabled={busy} />{error ? <InlineNotice title="Withdrawal not submitted" body={error} tone="error" /> : null}<AppButton title="Authorize and submit" loading={busy} disabled={busy || !/^\d{4}$/.test(pin)} onPress={() => void submit()} />
  </Shell>;

  if (step === 'processing') return <Shell title="Processing payment" step="Checking"><View style={s.processing}><ActivityIndicator size="large" color={colors.gold} /><Text style={s.heading}>Checking backend status…</Text><Text style={s.body}>Keep this screen open. LAUPAY may return pending while the request is reviewed.</Text></View></Shell>;

  if (step === 'result' && request) return <Shell title="Transfer receipt" step="Complete"><AppCard><View style={s.resultIcon}><Text style={s.resultCheck}>✓</Text></View><Text style={[s.heading, s.resultHeading]}>Withdrawal request</Text><View style={s.status}><Text style={s.label}>Backend status</Text><StatusBadge status={request.status} /></View><Summary label="Amount" value={money(request.amount)} /><Summary label="Recipient" value={request.accountName} /><Summary label="Reference" value={request.reference || request.id} />{request.failureReason ? <InlineNotice title="Why it did not complete" body={request.failureReason} tone="error" /> : <Text style={s.note}>{FINAL.has(statusKey(request.status)) ? 'This result came from the LAUPAY backend.' : 'The backend has not returned a final state. Check history before retrying.'}</Text>}</AppCard><AppButton title="Share receipt" variant="secondary" onPress={() => void Share.share({ message: `LAUPAY withdrawal\nAmount: ${money(request.amount)}\nRecipient: ${request.accountName}\nReference: ${request.reference || request.id}\nStatus: ${request.status}` })} /><AppButton title="Done" onPress={() => router.replace('/(tabs)')} /></Shell>;

  return <Shell title="Recipient details" step="1 of 4"><Text style={s.body}>Enter the bank account that should receive the withdrawal.</Text><Text style={s.label}>Bank</Text>{banks.isPending ? <Text style={s.body}>Loading verified banks…</Text> : null}{banks.isError ? <InlineNotice title="Bank list unavailable" body="No static bank directory is used." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void banks.refetch()} />} /> : null}{!banks.isPending && !banks.isError ? <><Pressable accessibilityRole="button" accessibilityLabel={bank ? `Selected bank ${bank.name}. Tap to change.` : 'Choose a bank'} onPress={() => { setBankSearch(''); setPickerOpen(true); }} style={s.bankField}><View style={s.bankFieldCopy}><Text style={bank ? s.bankValue : s.bankPlaceholder}>{bank?.name || 'Select a bank'}</Text>{bank ? <Text style={s.bankMeta}>Bank code: {bank.code}</Text> : null}</View><Text style={s.bankAction}>{bank ? 'Change' : 'Choose'}</Text></Pressable><BankPickerModal visible={pickerOpen} banks={orderedBanks} search={bankSearch} onSearch={setBankSearch} onClose={closePicker} onSelect={selectBank} /></> : null}<FormField label="10-digit account number" value={account} onChangeText={(value) => setAccount(value.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" maxLength={10} placeholder="0123456789" error={account.length > 0 && account.length !== 10 ? 'Enter exactly 10 digits.' : undefined} /><FormField label="Account name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Enter recipient account name" /><AppButton title="Continue" disabled={!recipientValid} onPress={() => setStep('amount')} /></Shell>;
}

function RecipientSummary({ bank, account, name }: { bank: Bank | null; account: string; name: string }) {
  return <AppCard style={s.recipientCard}><Text style={s.summaryKicker}>RECIPIENT</Text><Text style={s.recipientName}>{name.trim()}</Text><Text style={s.recipientMeta}>{bank?.name || 'Bank'} · {account}</Text></AppCard>;
}

function BankPickerModal({ visible, banks, search, onSearch, onClose, onSelect }: { visible: boolean; banks: Bank[]; search: string; onSearch: (value: string) => void; onClose: () => void; onSelect: (bank: Bank) => void }) {
  const filtered = banks.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()) || item.code.toLowerCase().includes(search.trim().toLowerCase()));
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={s.modalBackdrop}><View style={s.pickerSheet}><View style={s.pickerHeader}><View><Text style={s.pickerKicker}>LAUPAY WALLET</Text><Text style={s.pickerTitle}>Choose a bank</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close bank picker" onPress={onClose} style={s.closeButton}><Text style={s.closeText}>×</Text></Pressable></View><TextInput value={search} onChangeText={onSearch} autoFocus placeholder="Search banks" placeholderTextColor={colors.muted} style={s.searchInput} autoCapitalize="none" autoCorrect={false} /><FlatList data={filtered} keyExtractor={(item) => item.code} keyboardShouldPersistTaps="handled" contentContainerStyle={s.pickerList} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.name}`} onPress={() => onSelect(item)} style={({ pressed }) => [s.bankRow, pressed && s.bankRowPressed]}><View style={s.bankAvatar}><Text style={s.bankAvatarText}>{item.name.slice(0, 1).toUpperCase()}</Text></View><View style={s.bankRowCopy}><Text style={s.bankRowName}>{item.name}</Text><Text style={s.bankRowCode}>{item.code}</Text></View><Text style={s.chevron}>›</Text></Pressable>} ListEmptyComponent={<Text style={s.emptyBanks}>No backend-provided banks match that search.</Text>} /></View></View></Modal>;
}

function Shell({ title, step, children, onBack }: { title: string; step: string; children: ReactNode; onBack?: () => void }) {
  return <Screen scroll><View style={s.header}>{onBack ? <Pressable onPress={onBack} accessibilityRole="button"><Text style={s.back}>‹ Back</Text></Pressable> : <Text style={s.back}>LAUPAY</Text>}<Text style={s.progress}>{step}</Text></View><Text style={s.kicker}>LAUPAY WALLET</Text><Text style={s.title}>{title}</Text>{children}</Screen>;
}

function Summary({ label, value }: { label: string; value: string }) { return <View style={s.summary}><Text style={s.summaryLabel}>{label}</Text><Text style={s.summaryValue}>{value}</Text></View>; }

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: colors.navy2, fontWeight: '800' }, progress: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  kicker: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: spacing.xl },
  title: { fontSize: 28, fontWeight: '900', color: colors.midnight, marginTop: spacing.xs, marginBottom: spacing.md },
  heading: { fontWeight: '900', color: colors.midnight, fontSize: 18, marginBottom: spacing.sm }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: spacing.md }, label: { color: colors.navy, fontWeight: '800', marginTop: spacing.sm },
  bankField: { minHeight: 68, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }, bankFieldCopy: { flex: 1, gap: 3 }, bankPlaceholder: { color: colors.muted, fontSize: 16 }, bankValue: { color: colors.navy, fontSize: 16, fontWeight: '800' }, bankMeta: { color: colors.muted, fontSize: 11 }, bankAction: { color: colors.navy2, fontWeight: '900', marginLeft: spacing.md },
  recipientCard: { backgroundColor: colors.softBlue, borderColor: '#D9DDF9' }, summaryKicker: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, recipientName: { color: colors.midnight, fontSize: 18, fontWeight: '900', marginTop: 6 }, recipientMeta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  amountBlock: { alignItems: 'center', paddingVertical: spacing.xl }, amountLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' }, amountInputRow: { minWidth: 220, borderBottomWidth: 2, borderBottomColor: colors.navy2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg }, currency: { color: colors.midnight, fontSize: 34, fontWeight: '900' }, amountInput: { minWidth: 160, color: colors.midnight, fontSize: 42, fontWeight: '900', textAlign: 'center', paddingVertical: spacing.sm }, balanceText: { color: colors.muted, fontSize: 13, marginTop: spacing.md }, validation: { color: colors.error, fontSize: 12, marginTop: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }, tag: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, tagSelected: { backgroundColor: colors.softBlue, borderColor: colors.navy2 }, tagText: { color: colors.muted, fontWeight: '700', fontSize: 12 }, tagTextSelected: { color: colors.navy2 }, note: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.md },
  processing: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl }, status: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, resultIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.md }, resultCheck: { color: colors.success, fontSize: 34, fontWeight: '900' }, resultHeading: { textAlign: 'center' }, summary: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm }, summaryLabel: { color: colors.muted, fontSize: 11 }, summaryValue: { color: colors.navy, fontSize: 15, fontWeight: '800', marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: '#12142E66', justifyContent: 'flex-end' }, pickerSheet: { maxHeight: '86%', minHeight: '55%', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: spacing.xxxl }, pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }, pickerKicker: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, pickerTitle: { color: colors.midnight, fontSize: 24, fontWeight: '900', marginTop: 4 }, closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }, closeText: { color: colors.midnight, fontSize: 25, lineHeight: 28 }, searchInput: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: spacing.lg, color: colors.navy, fontSize: 16, marginBottom: spacing.md }, pickerList: { gap: 8, paddingBottom: spacing.xl }, bankRow: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md }, bankRowPressed: { backgroundColor: colors.softBlue, transform: [{ scale: .99 }] }, bankAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }, bankAvatarText: { color: colors.white, fontWeight: '900' }, bankRowCopy: { flex: 1, gap: 2 }, bankRowName: { color: colors.navy, fontSize: 14, fontWeight: '800' }, bankRowCode: { color: colors.muted, fontSize: 11 }, chevron: { color: colors.navy2, fontSize: 26 }, emptyBanks: { color: colors.muted, textAlign: 'center', padding: spacing.xl },
});
