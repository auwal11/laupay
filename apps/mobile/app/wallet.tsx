import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, InlineNotice, SectionHeading, StatusBadge } from '../src/components/ui';
import { LedgerEntry, walletApi, withdrawalsApi, Withdrawal } from '../src/api/services';
import { colors, radius, shadow, spacing } from '../src/theme';

const money = (v: string | number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(v));

export default function WalletScreen() {
  const [hidden, setHidden] = useState(false);
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.getWallet });
  const tx = useQuery({ queryKey: ['wallet-transactions'], queryFn: walletApi.getTransactions });
  const withdrawals = useQuery({ queryKey: ['withdrawals'], queryFn: withdrawalsApi.list });
  const refreshing = wallet.isRefetching || tx.isRefetching || withdrawals.isRefetching;
  const refresh = () => { void Promise.all([wallet.refetch(), tx.refetch(), withdrawals.refetch()]); };

  return <ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.midnight} />}>
    <Text style={s.eyebrow}>LAUPAY WALLET</Text><Text style={s.title}>Wallet</Text><Text style={s.subtitle}>Manage your balance, funding and withdrawals.</Text>
    <View style={s.balance}><View style={s.balanceHeader}><Text style={s.balanceLabel}>AVAILABLE BALANCE</Text><Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'} onPress={() => setHidden(!hidden)}><Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color="#FFFFFFCC" /></Pressable></View>{wallet.isPending ? <ActivityIndicator color={colors.gold} /> : <Text style={s.amount}>{wallet.data ? hidden ? '₦ ••••••' : money(wallet.data.balance) : 'Unavailable'}</Text>}<Text style={s.status}>{wallet.data?.status?.toLowerCase() || 'Check connection'}</Text></View>
    {wallet.isError ? <InlineNotice title="Balance unavailable" body="The backend did not return wallet data. No balance is assumed." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void wallet.refetch()} />} /> : null}
    <View style={s.actions}><AppButton title="Fund wallet" onPress={() => router.push('/fund')} /><AppButton title="Withdraw funds" variant="secondary" onPress={() => router.push('/withdraw')} /></View>

    <View><SectionHeading title="Transaction history" action="View all" onAction={() => router.push('/(tabs)/history')} />{tx.isPending ? <ActivityIndicator color={colors.navy2} /> : tx.isError ? <InlineNotice title="Activity unavailable" body="Could not load ledger records." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void tx.refetch()} />} /> : tx.data?.length ? tx.data.slice(0, 5).map((item) => <Entry key={item.id} item={item} />) : <AppCard><Text style={s.body}>No wallet activity yet.</Text></AppCard>}</View>

    <View><SectionHeading title="Withdrawal history" />{withdrawals.isPending ? <ActivityIndicator color={colors.navy2} /> : withdrawals.isError ? <InlineNotice title="Withdrawal history unavailable" body="Could not load your withdrawal requests." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void withdrawals.refetch()} />} /> : withdrawals.data?.length ? withdrawals.data.slice(0, 5).map((item) => <WithdrawalRow key={item.id} item={item} />) : <AppCard><Text style={s.body}>No withdrawal requests yet.</Text></AppCard>}</View>
  </ScrollView>;
}

function Entry({ item }: { item: LedgerEntry }) { const credit = item.direction.toLowerCase() === 'credit'; return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })} style={s.entry}><View style={s.entryIcon}><Ionicons name={credit ? 'arrow-down-outline' : 'arrow-up-outline'} size={18} color={credit ? colors.success : colors.navy2} /></View><View style={s.entryText}><Text style={s.entryTitle} numberOfLines={1}>{item.description}</Text><Text style={s.body}>{new Date(item.createdAt).toLocaleDateString('en-NG')}</Text></View><View style={s.entryRight}><Text style={[s.entryAmount, { color: credit ? colors.success : colors.midnight }]}>{credit ? '+' : '−'}{money(item.amount)}</Text><StatusBadge status={item.status} /></View></Pressable>; }
function WithdrawalRow({ item }: { item: Withdrawal }) { return <Pressable accessibilityRole="button" onPress={() => router.push('/withdraw')} style={s.withdrawal}><View style={s.entryText}><Text style={s.entryTitle}>{item.bankName} · •••• {item.accountNumber.slice(-4)}</Text><Text style={s.body}>{item.reference || item.id} · {new Date(item.createdAt).toLocaleDateString('en-NG')}</Text></View><View style={s.entryRight}><Text style={s.entryAmount}>{money(item.amount)}</Text><StatusBadge status={item.status} /></View></Pressable>; }

const s = StyleSheet.create({ scroll: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg }, eyebrow: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, title: { color: colors.midnight, fontSize: 28, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -spacing.sm }, balance: { backgroundColor: colors.midnight, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, ...shadow.card }, balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, balanceLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 }, amount: { color: colors.white, fontSize: 30, fontWeight: '900' }, status: { color: '#CBD5E1', fontSize: 12, textTransform: 'capitalize' }, actions: { gap: spacing.sm }, entry: { minHeight: 70, marginTop: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, entryIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' }, entryText: { flex: 1, gap: 3 }, entryTitle: { color: colors.navy, fontWeight: '800', fontSize: 13 }, body: { color: colors.muted, fontSize: 12, lineHeight: 18 }, entryRight: { alignItems: 'flex-end', gap: 4 }, entryAmount: { color: colors.midnight, fontWeight: '900', fontSize: 12 }, withdrawal: { minHeight: 66, marginTop: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md } });
