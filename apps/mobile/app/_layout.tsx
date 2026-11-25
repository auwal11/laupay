import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/features/auth/AuthProvider';
import { colors } from '../src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000, refetchOnReconnect: true } } });

function AppStack() {
  const { state } = useAuth();
  useEffect(() => {
    if (state !== 'loading') void SplashScreen.hideAsync().catch(() => undefined);
  }, [state]);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade_from_bottom' }} />;
}

export default function RootLayout() {
  return <QueryClientProvider client={queryClient}><AuthProvider><AppStack /></AuthProvider></QueryClientProvider>;
}
