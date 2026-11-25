import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

export default function TabLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.midnight,
    tabBarInactiveTintColor: '#94A3B8',
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 5 },
    tabBarStyle: { height: 66, paddingTop: 8, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', elevation: 10 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={(color ?? colors.muted) as string} size={size} /> }} />
    <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={(color ?? colors.muted) as string} size={size} /> }} />
    <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" color={(color ?? colors.muted) as string} size={size} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={(color ?? colors.muted) as string} size={size} /> }} />
    <Tabs.Screen name="two" options={{ href: null }} />
  </Tabs>;
}
