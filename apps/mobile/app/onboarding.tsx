import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { AppButton, AppMark, Screen } from '../src/components/ui';
import { colors, spacing } from '../src/theme';

const pages = [
  { eyebrow: 'EVERYDAY PAYMENTS', title: 'The essentials, in one place.', body: 'Buy airtime and data from services returned by LAUPAY’s live catalog.' },
  { eyebrow: 'WALLET FUNDING', title: 'Add money with clear status.', body: 'Use supported funding methods and wait for the backend to confirm every payment.' },
  { eyebrow: 'SECURE BY DESIGN', title: 'Your money stays yours.', body: 'Secure sign-in, transaction PIN checks and a wallet history backed by LAUPAY.' },
];

export default function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const finish = async () => {
    await SecureStore.setItemAsync('laupay_onboarding_seen', '1');
    router.replace('/(auth)/login');
  };
  const current = pages[page];
  return <Screen style={styles.screen}>
    <View style={styles.top}><AppMark size={56} /><Text style={styles.brand}>LAUPAY</Text><AppButton title="Skip" variant="ghost" onPress={() => void finish()} /></View>
    <View style={styles.art}><View style={styles.orbit}><View style={styles.inner}><AppMark size={104} /></View></View><View style={styles.goldDot} /></View>
    <View style={styles.copy}><Text style={styles.eyebrow}>{current.eyebrow}</Text><Text style={styles.title}>{current.title}</Text><Text style={styles.body}>{current.body}</Text></View>
    <View style={styles.bottom}><View style={styles.dots}>{pages.map((item, index) => <View key={item.eyebrow} style={[styles.dot, index === page && styles.dotActive]} />)}</View><AppButton title={page === pages.length - 1 ? 'Get started' : 'Continue'} onPress={() => page === pages.length - 1 ? void finish() : setPage(page + 1)} /></View>
  </Screen>;
}

const styles = StyleSheet.create({ screen: { flex: 1, padding: spacing.xl, justifyContent: 'space-between' }, top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, brand: { color: colors.midnight, fontWeight: '900', letterSpacing: 1.2, flex: 1 }, art: { alignItems: 'center', justifyContent: 'center', height: 280, position: 'relative' }, orbit: { width: 230, height: 230, borderRadius: 115, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }, inner: { width: 178, height: 178, borderRadius: 89, borderWidth: 1, borderColor: '#FFFFFF44', alignItems: 'center', justifyContent: 'center' }, goldDot: { position: 'absolute', width: 23, height: 23, borderRadius: 12, backgroundColor: colors.gold, right: '24%', top: 18 }, copy: { gap: spacing.md }, eyebrow: { fontSize: 11, letterSpacing: 1.4, color: colors.navy2, fontWeight: '900' }, title: { color: colors.midnight, fontSize: 29, lineHeight: 35, fontWeight: '900' }, body: { color: colors.muted, fontSize: 16, lineHeight: 24 }, bottom: { gap: spacing.lg }, dots: { flexDirection: 'row', justifyContent: 'center', gap: 7 }, dot: { width: 8, height: 8, borderRadius: 5, backgroundColor: '#CBD5E1' }, dotActive: { width: 25, backgroundColor: colors.gold } });
