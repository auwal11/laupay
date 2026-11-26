import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMark, ProfileAvatar } from './ui';
import { useAuth } from '../features/auth/AuthProvider';
import { notificationsApi } from '../api/services';
import { colors, radius, spacing } from '../theme';

export function TopHeader() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const initials = (user?.fullName || 'L').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const unread = useQuery({ queryKey: ['notification-count'], queryFn: notificationsApi.unreadCount });

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="LAUPAY home" onPress={() => router.replace('/(tabs)')} style={styles.brand}>
          <AppMark size={31} />
          <Text style={styles.wordmark}>LAUPAY</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={unread.data?.count ? `${unread.data.count} unread notifications` : 'Notifications'} onPress={() => router.push('/notifications')} style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color={colors.muted} />
            {typeof unread.data?.count === 'number' && unread.data.count > 0 ? <View style={styles.count}><Text style={styles.countText}>{unread.data.count > 9 ? '9+' : unread.data.count}</Text></View> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')} style={styles.profileButton}>
            <ProfileAvatar uri={user?.profilePhotoUrl} initials={initials} size={34} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.glassNavy, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { color: colors.glassText, fontSize: 16, fontWeight: '900', letterSpacing: 1.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassSurface, position: 'relative' },
  count: { position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.midnight, fontSize: 8, fontWeight: '900' },
  profileButton: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
});
