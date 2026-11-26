import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMark } from './ui';
import { useAuth } from '../features/auth/AuthProvider';
import { colors, radius, spacing } from '../theme';

export function TopHeader() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const initials = (user?.fullName || 'L').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="LAUPAY home" onPress={() => router.replace('/(tabs)')} style={styles.brand}>
          <AppMark size={31} />
          <Text style={styles.wordmark}>LAUPAY</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color={colors.muted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')} style={styles.profileButton}>
            {user?.profilePhotoUrl ? <Image source={{ uri: user.profilePhotoUrl }} style={styles.profileImage} /> : <Text style={styles.initials}>{initials || 'L'}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { color: colors.midnight, fontSize: 16, fontWeight: '900', letterSpacing: 1.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  profileButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.midnight, overflow: 'hidden' },
  profileImage: { width: 34, height: 34 },
  initials: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
