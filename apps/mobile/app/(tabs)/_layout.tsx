import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';
import { TopHeader } from '../../src/components/TopHeader';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <TopHeader />,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.glassNavy },
        tabBarActiveTintColor: colors.glassTeal,
        tabBarInactiveTintColor: colors.glassMuted,
        tabBarStyle: {
          backgroundColor: colors.glassNavyRaised,
          borderTopColor: colors.glassBorder,
          height: 66,
          paddingTop: 8,
          paddingBottom: 9,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: focused ? 'home' : 'home-outline',
            history: focused ? 'receipt' : 'receipt-outline',
            wallet: focused ? 'wallet' : 'wallet-outline',
            profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={typeof color === 'string' ? color : colors.muted} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="rewards" options={{ href: null }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
