import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { AppButton, AppMark, InlineNotice, Screen } from '../src/components/ui';
import { useAuth } from '../src/features/auth/AuthProvider';
import { securityApi } from '../src/api/services';
import { colors, spacing } from '../src/theme';

export default function IndexRoute() {
  const { state, retryRestore } = useAuth();
  const [routeError, setRouteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    if (state === 'loading') return;
    let active = true;
    async function decideRoute() {
      setBusy(true);
      setRouteError(null);
      try {
        if (state === 'offline') return;
        if (state === 'signedIn') {
          const pin = await securityApi.pinStatus();
          if (active) router.replace(pin.hasPin ? '/(tabs)' : '/(auth)/setup-pin');
          return;
        }
        const completed = await SecureStore.getItemAsync('laupay_onboarding_seen');
        if (active) router.replace(completed ? '/(auth)/login' : '/onboarding');
      } catch (error) {
        if (active) setRouteError(error instanceof Error ? error.message : 'Could not verify your account security.');
      } finally {
        if (active) setBusy(false);
      }
    }
    void decideRoute();
    return () => { active = false; };
  }, [state, checkAttempt]);

  if (state === 'offline') {
    return <Screen style={styles.center}><AppMark size={76} /><Text style={styles.title}>Let’s reconnect</Text><Text style={styles.body}>We couldn’t confirm your saved session. Your secure sign-in details are kept on this device.</Text><AppButton title="Try again" onPress={() => void retryRestore()} /></Screen>;
  }

  return <Screen style={styles.center}><AppMark size={76} />{busy || state === 'loading' ? <ActivityIndicator color={colors.gold} size="large" /> : null}<Text style={styles.title}>Your money. Your control.</Text>{routeError ? <InlineNotice title="Security check didn’t finish" body={routeError} tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => { setRouteError(null); setCheckAttempt((attempt) => attempt + 1); }} />} /> : <Text style={styles.body}>Preparing your secure LAUPAY experience…</Text>}</Screen>;
}

const styles = StyleSheet.create({ center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.lg }, title: { color: colors.midnight, fontSize: 21, fontWeight: '900', marginTop: spacing.sm }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320 } });
