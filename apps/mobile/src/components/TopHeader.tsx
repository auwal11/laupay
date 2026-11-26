import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMark } from './ui';
import { colors, radius, spacing } from '../theme';

const items = [
  { label: 'Home', icon: 'home-outline' as const, path: '/(tabs)' },
  { label: 'Airtime', icon: 'phone-portrait-outline' as const, path: '/services/airtime' },
  { label: 'Data', icon: 'wifi-outline' as const, path: '/services/data' },
  { label: 'Wallet', icon: 'wallet-outline' as const, path: '/wallet' },
  { label: 'History', icon: 'receipt-outline' as const, path: '/(tabs)/history' },
  { label: 'Profile', icon: 'person-outline' as const, path: '/(tabs)/profile' },
];

export function TopHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  return <View style={[styles.header, { paddingTop: insets.top }]}><View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="LAUPAY home" onPress={() => router.replace('/(tabs)')} style={styles.brand}><AppMark size={34} /><Text style={styles.wordmark}>LAUPAY</Text></Pressable><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menu} keyboardShouldPersistTaps="handled">{items.map((item) => { const active = pathname === item.path || (item.path === '/wallet' && pathname.startsWith('/wallet')) || (item.path.includes('history') && pathname.startsWith('/history')); return <Pressable key={item.label} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => router.push(item.path)} style={[styles.item, active && styles.itemActive]}><Ionicons name={item.icon} size={16} color={active ? colors.midnight : colors.muted} /><Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView><Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.notification}><Ionicons name="notifications-outline" size={20} color={colors.navy} /></Pressable></View></View>;
}

const styles = StyleSheet.create({ header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.sm }, brand: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2 }, wordmark: { color: colors.midnight, fontSize: 13, fontWeight: '900', letterSpacing: 1 }, menu: { alignItems: 'center', gap: 5, paddingHorizontal: 2 }, item: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, borderRadius: radius.pill }, itemActive: { backgroundColor: colors.softGold }, itemText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, itemTextActive: { color: colors.midnight, fontWeight: '900' }, notification: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
