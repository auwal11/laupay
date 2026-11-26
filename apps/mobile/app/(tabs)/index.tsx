import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, AppMark, InlineNotice, SectionHeading, StatusBadge } from '../../src/components/ui';
import { walletApi, notificationsApi, LedgerEntry } from '../../src/api/services';
import { colors, radius, shadow, spacing } from '../../src/theme';
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

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.navy2} />}>
    <View style={styles.topBar}><View style={styles.identity}>{user?.profilePhotoUrl ? <Image source={{ uri: user.profilePhotoUrl }} style={styles.profileImage} accessibilityLabel="Profile photo" /> : <AppMark size={40} />}<View><Text style={styles.wordmark}>LAUPAY</Text><Text style={styles.tagline}>Your money. Your control.</Text></View></View><Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.bell}><Ionicons name="notifications-outline" size={22} color={colors.navy} />{(unread.data?.count ?? 0) > 0 ? <View style={styles.bellDot} /> : null}</Pressable></View>
    <Text style={styles.greeting}>Good day, {user?.fullName?.split(' ')[0] || 'there'}</Text>
    <View style={styles.balanceCard}>
      <View style={styles.balanceHeader}><Text style={styles.balanceLabel}>WALLET BALANCE</Text><Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'} onPress={() => setHidden(!hidden)}><Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color="#FFFFFFCC" /></Pressable></View>
      {wallet.isPending ? <View style={styles.balanceLoading}><ActivityIndicator color={colors.gold} /><Text style={styles.loadingText}>Loading balance…</Text></View> : wallet.data ? <Text style={styles.balance}>{hidden ? '₦ ••••••' : money(wallet.data.balance)}</Text> : <Text style={styles.balanceError}>Balance unavailable</Text>}
      <View style={styles.cardFooter}><View style={styles.walletState}><View style={[styles.stateDot, { backgroundColor: wallet.data?.status === 'ACTIVE' ? '#4ADE80' : '#FBBF24' }]} /><Text style={styles.walletStateText}>{wallet.data?.status ? wallet.data.status.toLowerCase() : wallet.isError ? 'check connection' : 'wallet status'}</Text></View><AppButton title="Add money" onPress={() => router.push('/fund')} style={styles.addMoney} /></View>
      {wallet.isError ? <Pressable onPress={() => void wallet.refetch()}><Text style={styles.retry}>Tap to retry wallet</Text></Pressable> : null}
    </View>
    <View style={styles.serviceHeader}><SectionHeading title="Quick services" /></View>
    <View style={styles.services}>
      <Service icon="phone-portrait-outline" title="Airtime" enabled onPress={() => router.push('/services/airtime')} />
      <Service icon="wifi-outline" title="Data" enabled onPress={() => router.push('/services/data')} />
      <Service icon="flash-outline" title="Electricity" />
      <Service icon="tv-outline" title="Cable TV" />
    </View>
    <View style={styles.activityHeader}><SectionHeading title="Recent activity" action="View all" onAction={() => router.push('/(tabs)/history')} /></View>
    {transactions.isPending ? <AppCard style={styles.activityState}><ActivityIndicator color={colors.navy2} /><Text style={styles.dim}>Loading wallet activity…</Text></AppCard> : transactions.isError ? <InlineNotice title="Activity unavailable" body="We couldn’t load the latest ledger records. Your balance has not been changed by this screen." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void transactions.refetch()} />} /> : transactions.data?.length ? transactions.data.slice(0, 4).map((item) => <TransactionLine key={item.id} item={item} />) : <AppCard><Text style={styles.emptyTitle}>No wallet activity yet</Text><Text style={styles.dim}>When the backend records a wallet transaction, it will appear here.</Text></AppCard>}
    <Text style={styles.footerNote}>Wallet and transaction information is loaded from LAUPAY’s backend.</Text>
  </ScrollView>;
}

function Service({ icon, title, enabled = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; enabled?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !enabled }} disabled={!enabled} onPress={onPress} style={[styles.service, !enabled && styles.serviceDisabled]}><View style={[styles.serviceIcon, !enabled && styles.serviceIconOff]}><Ionicons name={icon} size={23} color={enabled ? colors.navy2 : colors.muted} /></View><Text style={[styles.serviceTitle, !enabled && styles.disabledTitle]}>{title}</Text><Text style={styles.serviceMeta}>{enabled ? 'Available' : 'Not enabled'}</Text></Pressable>;
}

function TransactionLine({ item }: { item: LedgerEntry }) {
  const credit = item.direction.toLowerCase() === 'credit';
  return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })} style={styles.transaction}>
    <View style={[styles.transactionIcon, { backgroundColor: credit ? colors.softGreen : colors.softBlue }]}><Ionicons name={credit ? 'arrow-down-outline' : 'arrow-up-outline'} size={19} color={credit ? colors.success : colors.navy2} /></View>
    <View style={styles.transactionInfo}><Text style={styles.transactionTitle} numberOfLines={1}>{item.description}</Text><Text style={styles.transactionMeta}>{shortDate(item.createdAt)}{item.network ? ` · ${item.network}` : ''}</Text></View>
    <View style={styles.transactionRight}><Text style={[styles.amount, { color: credit ? colors.success : colors.midnight }]}>{credit ? '+' : '−'}{money(item.amount)}</Text><StatusBadge status={item.status} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({ scroll: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg }, topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }, identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, profileImage: { width: 40, height: 40, borderRadius: 20 }, wordmark: { color: colors.midnight, fontWeight: '900', letterSpacing: 1.5, fontSize: 15 }, tagline: { color: colors.muted, fontSize: 10, marginTop: 2 }, bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card }, bellDot: { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error }, greeting: { color: colors.midnight, fontSize: 22, fontWeight: '900' }, balanceCard: { backgroundColor: colors.midnight, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, overflow: 'hidden' }, balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, balanceLabel: { color: '#CBD5E1', fontWeight: '800', fontSize: 11, letterSpacing: 1.2 }, balance: { color: colors.white, fontSize: 31, fontWeight: '900', letterSpacing: -0.6, marginVertical: 5 }, balanceLoading: { height: 48, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }, loadingText: { color: '#CBD5E1', fontSize: 13 }, balanceError: { color: '#FCA5A5', fontSize: 16, fontWeight: '800', paddingVertical: 12 }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#FFFFFF24', paddingTop: spacing.md }, walletState: { flexDirection: 'row', alignItems: 'center', gap: 7 }, stateDot: { width: 7, height: 7, borderRadius: 5 }, walletStateText: { color: '#CBD5E1', fontSize: 12, textTransform: 'capitalize' }, addMoney: { minHeight: 42, paddingHorizontal: spacing.lg, borderRadius: radius.pill }, retry: { color: '#FDE68A', fontSize: 12, fontWeight: '700' }, serviceHeader: { marginTop: 0 }, services: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md }, service: { width: '47.5%', minHeight: 112, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 }, serviceDisabled: { opacity: 0.72 }, serviceIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, serviceIconOff: { backgroundColor: '#E2E8F0' }, serviceTitle: { color: colors.midnight, fontWeight: '800', fontSize: 14 }, disabledTitle: { color: colors.muted }, serviceMeta: { color: colors.muted, fontSize: 10 }, activityHeader: { marginTop: 0 }, transaction: { minHeight: 75, backgroundColor: colors.white, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, transactionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, transactionInfo: { flex: 1, gap: 4 }, transactionTitle: { color: colors.navy, fontWeight: '800', fontSize: 13 }, transactionMeta: { color: colors.muted, fontSize: 11 }, transactionRight: { alignItems: 'flex-end', gap: 4 }, amount: { fontSize: 12, fontWeight: '900' }, activityState: { alignItems: 'center', gap: spacing.md }, emptyTitle: { color: colors.midnight, fontSize: 15, fontWeight: '800' }, dim: { color: colors.muted, fontSize: 13, lineHeight: 20 }, footerNote: { color: colors.muted, textAlign: 'center', fontSize: 10, marginTop: spacing.sm } });
