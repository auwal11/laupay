import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppCard, InlineNotice, StatusBadge } from '../../src/components/ui';
import { walletApi, LedgerEntry } from '../../src/api/services';
import { colors, radius, spacing } from '../../src/theme';

const money = (value: string | number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value));
const dateTime = (value: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const filters = ['All', 'Credit', 'Debit'] as const;

type Filter = typeof filters[number];

export default function HistoryScreen() {
  const [filter, setFilter] = useState<Filter>('All');
  const query = useQuery({ queryKey: ['wallet-transactions'], queryFn: walletApi.getTransactions });
  const rows = useMemo(() => (query.data ?? []).filter((entry) => filter === 'All' || entry.direction.toLowerCase() === filter.toLowerCase()), [filter, query.data]);
  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.navy2} />}>
    <Text style={styles.eyebrow}>YOUR WALLET</Text><Text style={styles.title}>Transaction history</Text><Text style={styles.subtitle}>Records returned by LAUPAY’s wallet ledger.</Text>
    <View style={styles.filters}>{filters.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</View>
    {query.isPending ? <AppCard style={styles.state}><ActivityIndicator color={colors.navy2} /><Text style={styles.subtitle}>Loading ledger activity…</Text></AppCard> : query.isError ? <InlineNotice title="History unavailable" body="We couldn’t load ledger records. No transaction state has been inferred by the app." tone="error" /> : rows.length ? rows.map((entry) => <TransactionRow key={entry.id} entry={entry} />) : <AppCard><Text style={styles.emptyTitle}>{query.data?.length ? 'No matching activity' : 'No wallet activity yet'}</Text><Text style={styles.subtitle}>{query.data?.length ? 'Try another filter.' : 'Transactions will appear here when recorded by the backend.'}</Text></AppCard>}
  </ScrollView>;
}

function TransactionRow({ entry }: { entry: LedgerEntry }) {
  const credit = entry.direction.toLowerCase() === 'credit';
  return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/history/[id]', params: { id: entry.id } })} style={styles.row}>
    <View style={[styles.icon, { backgroundColor: credit ? colors.softGreen : colors.softBlue }]}><Text style={[styles.arrow, { color: credit ? colors.success : colors.navy2 }]}>{credit ? '↓' : '↑'}</Text></View>
    <View style={styles.main}><Text style={styles.rowTitle} numberOfLines={1}>{entry.description}</Text><Text style={styles.date}>{dateTime(entry.createdAt)}</Text><Text style={styles.reference} numberOfLines={1}>Ref: {entry.referenceId || entry.id}</Text></View>
    <View style={styles.right}><Text style={[styles.amount, { color: credit ? colors.success : colors.midnight }]}>{credit ? '+' : '−'}{money(entry.amount)}</Text><StatusBadge status={entry.status} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({ scroll: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md }, eyebrow: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.midnight, fontSize: 26, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20 }, filters: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm }, filter: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }, filterActive: { backgroundColor: colors.midnight, borderColor: colors.midnight }, filterText: { color: colors.muted, fontWeight: '700', fontSize: 12 }, filterTextActive: { color: colors.white }, state: { alignItems: 'center', gap: spacing.md }, emptyTitle: { color: colors.midnight, fontWeight: '800', fontSize: 15 }, row: { backgroundColor: colors.white, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 85 }, icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, arrow: { fontSize: 22, fontWeight: '900' }, main: { flex: 1, gap: 3 }, rowTitle: { color: colors.navy, fontSize: 13, fontWeight: '800' }, date: { color: colors.muted, fontSize: 11 }, reference: { color: '#94A3B8', fontSize: 9 }, right: { alignItems: 'flex-end', gap: 4 }, amount: { color: colors.midnight, fontWeight: '900', fontSize: 12 } });
