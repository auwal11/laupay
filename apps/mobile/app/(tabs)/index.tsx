import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, InlineNotice, StatusBadge } from '../../src/components/ui';
import { walletApi, notificationsApi, LedgerEntry } from '../../src/api/services';
import { colors, radius, spacing } from '../../src/theme';
import { useAuth } from '../../src/features/auth/AuthProvider';

const money = (value: string | number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value));
const shortDate = (value: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date(value));

export default function DashboardScreen() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.getWallet });
  const transactions = useQuery({ queryKey: ['wallet-transactions'], queryFn: walletApi.getTransactions });
  const unread = useQuery({ queryKey: ['notification-count'], queryFn: notificationsApi.unreadCount });
  const refreshing = wallet.isRefetching || transactions.isRefetching;
  const refresh = () => { void Promise.all([wallet.refetch(), transactions.refetch(), unread.refetch()]); };
  const initials = (user?.fullName || 'L').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.midnight} />}>
    <View style={styles.greetingRow}>
      {user?.profilePhotoUrl ? <Image source={{ uri: user.profilePhotoUrl }} style={styles.profileImage} /> : <View style={styles.profileFallback}><Text style={styles.profileInitials}>{initials || 'L'}</Text></View>}
      <View style={styles.greetingCopy}><Text style={styles.eyebrow}>BUILT FOR EVERYDAY PAYMENTS</Text><Text style={styles.greeting}>Hi {user?.fullName?.split(' ')[0] || 'there'}</Text><Text style={styles.subGreeting}>Here is what is happening with your account.</Text></View>
    </View>

    <View style={styles.balanceCard}>
      <View style={styles.balanceHeader}><Text style={styles.balanceLabel}>WALLET BALANCE</Text><Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'} onPress={() => setHidden(!hidden)}><Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color="#FFFFFFCC" /></Pressable></View>
      {wallet.isPending ? <View style={styles.balanceLoading}><ActivityIndicator color={colors.gold} /><Text style={styles.loadingText}>Loading balance…</Text></View> : wallet.data ? <Text style={styles.balance}>{hidden ? '₦ ••••••' : money(wallet.data.balance)}</Text> : <Text style={styles.balanceError}>Balance unavailable</Text>}
      <View style={styles.cardFooter}><View style={styles.walletState}><View style={[styles.stateDot, { backgroundColor: wallet.data?.status === 'ACTIVE' ? '#4ADE80' : colors.gold }]} /><Text style={styles.walletStateText}>{wallet.data?.status ? wallet.data.status.toLowerCase() : wallet.isError ? 'check connection' : 'wallet status'}</Text></View><View style={styles.cardActions}><AppButton title="Add funds" onPress={() => router.push('/fund')} style={styles.addMoney} icon={<Ionicons name="add" size={16} color={colors.midnight} />} /><AppButton title="Withdraw" variant="ghost" onPress={() => router.push('/withdraw')} style={styles.withdrawButton} icon={<Ionicons name="arrow-up-outline" size={16} color={colors.white} />} /></View></View>
      {wallet.isError ? <Pressable onPress={() => void wallet.refetch()}><Text style={styles.retry}>Tap to retry wallet</Text></Pressable> : null}
    </View>

    <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/history')} style={styles.historyCard}>
      <View style={styles.historyIcon}><Ionicons name="card-outline" size={21} color={colors.white} /></View>
      <View style={styles.historyCopy}><Text style={styles.historyTitle}>Transaction History</Text><Text style={styles.historyBody}>View all payments, transfers and withdrawals</Text></View>
      <Ionicons name="chevron-forward" size={20} color={colors.midnight} />
    </Pressable>

    <View><Text style={styles.sectionTitle}>Quick actions</Text><View style={styles.quickGrid}>
      <QuickAction icon="phone-portrait-outline" title="Airtime" onPress={() => router.push('/services/airtime')} />
      <QuickAction icon="wifi-outline" title="Data" onPress={() => router.push('/services/data')} />
      <QuickAction icon="wallet-outline" title="Wallet" onPress={() => router.push('/wallet')} />
      <QuickAction icon="receipt-outline" title="Payments" onPress={() => router.push('/(tabs)/history')} />
      <QuickAction icon="document-text-outline" title="Bills" disabled />
    </View></View>

    <View><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Recent activity</Text><Pressable onPress={() => router.push('/(tabs)/history')}><Text style={styles.sectionLink}>View all</Text></Pressable></View>
      {transactions.isPending ? <AppCard style={styles.activityState}><ActivityIndicator color={colors.glassTeal} /><Text style={styles.dim}>Loading wallet activity…</Text></AppCard> : transactions.isError ? <InlineNotice title="Activity unavailable" body="We couldn’t load the latest ledger records. Your balance has not been changed by this screen." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void transactions.refetch()} />} /> : transactions.data?.length ? transactions.data.slice(0, 4).map((item) => <TransactionLine key={item.id} item={item} />) : <AppCard style={styles.activityState}><Text style={styles.emptyTitle}>No wallet activity yet</Text><Text style={styles.dim}>When the backend records a wallet transaction, it will appear here.</Text></AppCard>}
    </View>
    <Text style={styles.footerNote}>Wallet and transaction information is loaded from LAUPAY’s backend.</Text>
  </ScrollView>;
}

function QuickAction({ icon, title, onPress, disabled = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress?: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.quickAction, disabled && styles.quickActionDisabled]}><View style={[styles.quickIcon, disabled && styles.quickIconDisabled]}><Ionicons name={icon} size={18} color={disabled ? colors.muted : colors.white} /></View><Text style={[styles.quickTitle, disabled && styles.disabledTitle]}>{title}</Text>{disabled ? <Text style={styles.comingSoon}>COMING SOON</Text> : null}</Pressable>;
}

function TransactionLine({ item }: { item: LedgerEntry }) {
  const credit = item.direction.toLowerCase() === 'credit';
  return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })} style={styles.transaction}>
    <View style={[styles.transactionIcon, { backgroundColor: credit ? colors.softGreen : colors.softBlue }]}><Ionicons name={credit ? 'arrow-down-outline' : 'arrow-up-outline'} size={19} color={credit ? colors.success : colors.navy2} /></View>
    <View style={styles.transactionInfo}><Text style={styles.transactionTitle} numberOfLines={1}>{item.description}</Text><Text style={styles.transactionMeta}>{shortDate(item.createdAt)}{item.network ? ` · ${item.network}` : ''}</Text></View>
    <View style={styles.transactionRight}><Text style={[styles.amount, { color: credit ? colors.success : colors.midnight }]}>{credit ? '+' : '−'}{money(item.amount)}</Text><StatusBadge status={item.status} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.glassNavy }, content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, profileImage: { width: 48, height: 48, borderRadius: 24 }, profileFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.gold }, profileInitials: { color: colors.white, fontSize: 15, fontWeight: '900' }, greetingCopy: { flex: 1 }, eyebrow: { color: colors.glassMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, greeting: { color: colors.glassText, fontSize: 23, fontWeight: '900', marginTop: 3 }, subGreeting: { color: colors.glassMuted, fontSize: 12, marginTop: 2 },
  balanceCard: { backgroundColor: colors.glassBalance, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF33' }, balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, balanceLabel: { color: colors.glassMuted, fontWeight: '800', fontSize: 11, letterSpacing: 1.2 }, balance: { color: colors.white, fontSize: 31, fontWeight: '900', letterSpacing: -0.6, marginVertical: 5 }, balanceLoading: { height: 48, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }, loadingText: { color: colors.glassMuted, fontSize: 13 }, balanceError: { color: '#FCA5A5', fontSize: 16, fontWeight: '800', paddingVertical: 12 }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#FFFFFF24', paddingTop: spacing.md, gap: spacing.sm }, walletState: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }, stateDot: { width: 7, height: 7, borderRadius: 5 }, walletStateText: { color: colors.glassMuted, fontSize: 12, textTransform: 'capitalize' }, cardActions: { flexDirection: 'row', gap: spacing.sm, flexShrink: 1 }, addMoney: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.pill }, withdrawButton: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: '#FFFFFF55' }, retry: { color: '#FDE68A', fontSize: 12, fontWeight: '700' },
  historyCard: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.glassSurface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: spacing.lg }, historyIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy2 }, historyCopy: { flex: 1 }, historyTitle: { color: colors.glassText, fontSize: 14, fontWeight: '900' }, historyBody: { color: colors.glassMuted, fontSize: 11, marginTop: 3 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }, sectionTitle: { color: colors.glassText, fontSize: 18, fontWeight: '800' }, sectionLink: { color: colors.glassTeal, fontSize: 13, fontWeight: '800' }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm }, quickAction: { width: '30.8%', minHeight: 103, alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.glassSurface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: spacing.xs }, quickActionDisabled: { backgroundColor: '#FFFFFF0D', borderStyle: 'dashed' }, quickIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy2 }, quickIconDisabled: { backgroundColor: '#FFFFFF18' }, quickTitle: { color: colors.glassText, fontSize: 11, fontWeight: '800' }, disabledTitle: { color: colors.glassMuted }, comingSoon: { color: colors.gold, fontSize: 7, fontWeight: '900', letterSpacing: .4 },
  transaction: { minHeight: 75, marginTop: spacing.sm, backgroundColor: colors.glassSurface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.glassBorder, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, transactionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, transactionInfo: { flex: 1, gap: 4 }, transactionTitle: { color: colors.glassText, fontWeight: '800', fontSize: 13 }, transactionMeta: { color: colors.glassMuted, fontSize: 11 }, transactionRight: { alignItems: 'flex-end', gap: 4 }, amount: { fontSize: 12, fontWeight: '900' }, activityState: { alignItems: 'center', gap: spacing.md, backgroundColor: colors.glassSurface, borderColor: colors.glassBorder }, emptyTitle: { color: colors.glassText, fontSize: 15, fontWeight: '800' }, dim: { color: colors.glassMuted, fontSize: 13, lineHeight: 20 }, footerNote: { color: colors.glassMuted, textAlign: 'center', fontSize: 10, marginTop: spacing.sm }
});
