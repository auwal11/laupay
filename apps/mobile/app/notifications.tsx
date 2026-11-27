import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppButton, InlineNotice, Screen } from '../src/components/ui';
import { notificationsApi, Notification } from '../src/api/services';
import { registerPushNotifications } from '../src/api/push-notifications';
import { colors, radius, shadow, spacing } from '../src/theme';

type Filter = 'all' | 'unread';
const iconFor = (category: string): keyof typeof Ionicons.glyphMap => {
  const value = category.toLowerCase();
  if (value.includes('wallet') || value.includes('fund')) return 'wallet-outline';
  if (value.includes('security') || value.includes('login')) return 'shield-checkmark-outline';
  if (value.includes('transaction') || value.includes('order') || value.includes('payment')) return 'receipt-outline';
  if (value.includes('support')) return 'chatbubble-ellipses-outline';
  return 'notifications-outline';
};
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
function valueLabel(value: unknown) { return value === undefined || value === null || value === '' ? null : String(value); }
function transactionPath(item: Notification) {
  const id = item.metadata?.transactionId || item.metadata?.orderId;
  return id ? { pathname: '/history/[id]' as const, params: { id } } : null;
}

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [pushState, setPushState] = useState('Push alerts are optional. Transaction details remain available in this inbox.');
  const [pushBusy, setPushBusy] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list });
  const read = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['notifications'] }); void queryClient.invalidateQueries({ queryKey: ['notification-count'] }); } });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['notifications'] }); void queryClient.invalidateQueries({ queryKey: ['notification-count'] }); } });
  const notifications = useMemo(() => query.data ?? [], [query.data]);
  const unread = notifications.filter((item) => !item.readAt).length;
  const visible = useMemo(() => filter === 'unread' ? notifications.filter((item) => !item.readAt) : notifications, [filter, notifications]);

  async function enablePush() {
    setPushBusy(true);
    try {
      const result = await registerPushNotifications(true);
      if (result === 'registered') setPushState('Push alerts are enabled on this device. Full transaction details stay in your secure inbox.');
      else if (result === 'permission-denied') setPushState('Notification permission was not granted. You can still review all updates in this inbox.');
      else if (result === 'setup-required') setPushState('Push setup is incomplete for this build. The Expo project ID and platform push credentials must be configured.');
      else setPushState('Push alerts are supported only in the iOS and Android app.');
    } catch {
      setPushState('Push registration is temporarily unavailable. Your in-app inbox remains available.');
    } finally {
      setPushBusy(false);
    }
  }

  return <Screen scroll>
    <View style={s.header}><View><Text style={s.eyebrow}>LAUPAY INBOX</Text><Text style={s.title}>Notifications</Text><Text style={s.subtitle}>{unread ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'You are all caught up'}</Text></View><View style={s.headerIcon}><Ionicons name="notifications" size={22} color={colors.midnight} /><View style={s.headerDot} /></View></View>
    <View style={s.pushCard}><View style={s.pushHeading}><Ionicons name="phone-portrait-outline" size={20} color={colors.navy2} /><Text style={s.pushTitle}>Transaction push alerts</Text></View><Text style={s.pushBody}>{pushState}</Text><AppButton title={pushBusy ? 'Enabling…' : 'Enable push alerts'} variant="secondary" loading={pushBusy} onPress={() => void enablePush()} /></View>
    <View style={s.toolbar}><View style={s.filters}><FilterButton label="All" active={filter === 'all'} onPress={() => setFilter('all')} /><FilterButton label={`Unread${unread ? ` ${unread}` : ''}`} active={filter === 'unread'} onPress={() => setFilter('unread')} /></View>{unread > 0 ? <Pressable accessibilityRole="button" onPress={() => markAll.mutate()} disabled={markAll.isPending}><Text style={s.markAll}>{markAll.isPending ? 'Updating…' : 'Mark all read'}</Text></Pressable> : null}</View>
    {query.isError ? <InlineNotice title="Notifications unavailable" body="The backend inbox could not be loaded." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void query.refetch()} />} /> : null}
    {query.isPending ? <View style={s.loading}><ActivityIndicator color={colors.midnight} /><Text style={s.loadingText}>Loading your updates…</Text></View> : visible.length ? <View style={s.list}>{visible.map((item) => <NotificationCard key={item.id} item={item} onRead={() => read.mutate(item.id)} reading={read.isPending && read.variables === item.id} />)}</View> : !query.isError ? <EmptyState filtered={filter === 'unread'} /> : null}
    <Text style={s.footer}>Push alerts contain no financial details. Sign in to see the full, authoritative transaction record.</Text>
  </Screen>;
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[s.filter, active && s.filterActive]}><Text style={[s.filterText, active && s.filterTextActive]}>{label}</Text></Pressable>; }
function NotificationCard({ item, onRead, reading }: { item: Notification; onRead: () => void; reading: boolean }) {
  const unread = !item.readAt;
  const metadata = item.metadata ?? {};
  const path = transactionPath(item);
  const fields: [string, unknown][] = [
    ['Alert type', metadata.alertType], ['Reference', metadata.transactionReference],
    ['Amount', metadata.amount === undefined ? undefined : `${metadata.currency || ''} ${metadata.amount}`.trim()],
    ['Narrative', metadata.narrative], ['Status', metadata.status], ['Transaction date', metadata.date],
    ['Available balance', metadata.availableBalance === undefined ? undefined : `${metadata.currency || ''} ${metadata.availableBalance}`.trim()],
    ['Original transaction ID', metadata.originalTransactionId], ['Original reference', metadata.originalReference],
    ['Recipient', metadata.recipient], ['Service', metadata.service],
  ];
  return <View style={[s.card, unread && s.cardUnread]}>
    <View style={s.cardTop}><View style={[s.categoryIcon, unread && s.categoryIconUnread]}><Ionicons name={iconFor(item.category)} size={20} color={unread ? colors.midnight : colors.navy2} /></View><View style={s.cardHeading}><View style={s.titleLine}><Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>{unread ? <View style={s.unreadDot} /> : null}</View><Text style={s.category}>{item.category.replaceAll('_', ' ').toLowerCase()}</Text></View></View>
    <Text style={s.message}>{item.body}</Text>
    {fields.map(([label, raw]) => { const value = valueLabel(raw); return value ? <Text key={label} style={s.detail}><Text style={s.detailLabel}>{label}: </Text>{value}</Text> : null; })}
    <View style={s.cardFooter}><Text style={s.date}>{dateLabel(item.createdAt)}</Text>{path ? <Pressable accessibilityRole="button" onPress={() => router.push(path)}><Text style={s.readAction}>View transaction</Text></Pressable> : null}{unread ? <Pressable accessibilityRole="button" onPress={onRead} disabled={reading}><Text style={s.readAction}>{reading ? 'Updating…' : 'Mark as read'}</Text></Pressable> : <Text style={s.readLabel}>Read</Text>}</View>
  </View>;
}
function EmptyState({ filtered }: { filtered: boolean }) { return <View style={s.empty}><View style={s.emptyIcon}><Ionicons name={filtered ? 'checkmark-done-outline' : 'notifications-off-outline'} size={28} color={colors.navy2} /></View><Text style={s.emptyTitle}>{filtered ? 'No unread notifications' : 'No notifications yet'}</Text><Text style={s.emptyBody}>{filtered ? 'You have reviewed all your LAUPAY updates.' : 'Account, wallet and transaction updates will appear here.'}</Text></View>; }
const s = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.midnight, fontSize: 28, fontWeight: '900', marginTop: 3 }, subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 }, headerIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card }, headerDot: { position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold }, pushCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card }, pushHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, pushTitle: { color: colors.midnight, fontSize: 14, fontWeight: '900' }, pushBody: { color: colors.muted, fontSize: 12, lineHeight: 18 }, toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm }, filters: { flexDirection: 'row', gap: spacing.sm }, filter: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: 8 }, filterActive: { backgroundColor: colors.midnight, borderColor: colors.midnight }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, filterTextActive: { color: colors.white }, markAll: { color: colors.navy2, fontSize: 12, fontWeight: '800' }, list: { gap: spacing.md }, card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadow.card }, cardUnread: { borderColor: '#F4D48B', backgroundColor: '#FFFDF7' }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, categoryIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' }, categoryIconUnread: { backgroundColor: colors.softGold }, cardHeading: { flex: 1, gap: 3 }, titleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, cardTitle: { color: colors.midnight, fontSize: 14, lineHeight: 19, fontWeight: '900', flex: 1 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 5 }, category: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: .7, textTransform: 'uppercase' }, message: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: spacing.md }, detail: { color: colors.navy, fontSize: 12, lineHeight: 18, marginTop: 5 }, detailLabel: { fontWeight: '800' }, cardFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.sm }, date: { color: colors.muted, fontSize: 10, flex: 1 }, readAction: { color: colors.navy2, fontSize: 11, fontWeight: '900' }, readLabel: { color: colors.success, fontSize: 11, fontWeight: '800' }, loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl }, loadingText: { color: colors.muted, fontSize: 13 }, empty: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl }, emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, emptyTitle: { color: colors.midnight, fontSize: 17, fontWeight: '900' }, emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm }, footer: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: spacing.sm } });
