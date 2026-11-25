import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppMark, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { colors, radius, spacing } from '../../src/theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const confirmLogout = () => Alert.alert('Sign out of LAUPAY?', 'You can sign in again at any time.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void signOut() }]);
  return <Screen scroll style={styles.content}>
    <Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.title}>Profile</Text>
    <View style={styles.profileCard}><View style={styles.avatar}><AppMark size={42} /></View><View style={styles.identity}><Text style={styles.name}>{user?.fullName || 'LAUPAY customer'}</Text><Text style={styles.email}>{user?.email || 'Account details unavailable'}</Text>{user?.phone ? <Text style={styles.email}>{user.phone}</Text> : null}</View></View>
    <View style={styles.menu}>
      <MenuRow icon="wallet-outline" title="Wallet & funding" onPress={() => router.push('/wallet')} />
      <MenuRow icon="shield-checkmark-outline" title="Security center" onPress={() => router.push('/security')} />
      <MenuRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
      <MenuRow icon="help-circle-outline" title="Help & support" onPress={() => router.push('/support')} />
      <MenuRow icon="person-outline" title="Edit profile" onPress={() => router.push('/profile/edit')} />
    </View>
    <Pressable accessibilityRole="button" onPress={confirmLogout} style={styles.logout}><Ionicons name="log-out-outline" size={19} color={colors.error} /><Text style={styles.logoutText}>Sign out securely</Text></Pressable>
    <Text style={styles.note}>Account information is retrieved from LAUPAY’s backend.</Text>
  </Screen>;
}

function MenuRow({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><Ionicons name={icon} size={21} color={colors.navy2} /><Text style={styles.rowTitle}>{title}</Text><Ionicons name="chevron-forward" size={18} color="#94A3B8" /></Pressable>;
}

const styles = StyleSheet.create({ content: { padding: spacing.xl, gap: spacing.lg }, eyebrow: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.midnight, fontSize: 26, fontWeight: '900' }, profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }, avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }, identity: { flex: 1, gap: 3 }, name: { color: colors.midnight, fontSize: 16, fontWeight: '900' }, email: { color: colors.muted, fontSize: 12 }, menu: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowTitle: { color: colors.navy, flex: 1, fontWeight: '700', fontSize: 14 }, logout: { minHeight: 54, backgroundColor: colors.white, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#FECACA' }, logoutText: { color: colors.error, fontWeight: '900' }, note: { color: colors.muted, fontSize: 11, textAlign: 'center' } });
