import { Stack } from 'expo-router';
import { colors } from '../../src/theme';
import { TopHeader } from '../../src/components/TopHeader';

export default function TabLayout() {
  return <Stack screenOptions={{ headerShown: true, header: () => <TopHeader />, headerShadowVisible: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade_from_bottom' }}>
    <Stack.Screen name="index" options={{ title: 'Home' }} />
    <Stack.Screen name="history" options={{ title: 'History' }} />
    <Stack.Screen name="rewards" options={{ title: 'Rewards' }} />
    <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    <Stack.Screen name="two" options={{ title: 'LAUPAY' }} />
  </Stack>;
}
