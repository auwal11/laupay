import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Notification, notificationsApi } from '../api/services';
import { useAuth } from '../features/auth/AuthProvider';
import { colors, spacing } from '../theme';

type ToastItem = { notification: Notification; tone: 'success' | 'debit' | 'reversal' | 'failure' };

function toneFor(notification: Notification): ToastItem['tone'] {
  const type = String(notification.metadata?.alertType ?? '').toUpperCase();
  if (type === 'REVERSAL' || type === 'REFUND') return 'reversal';
  if (type === 'PURCHASE_FAILED' || String(notification.metadata?.status ?? '').toUpperCase() === 'FAILED') return 'failure';
  if (type === 'PURCHASE_SUCCESS') return 'success';
  if (type === 'DEBIT') return 'debit';
  return 'success';
}

export default function NotificationMonitor() {
  const { state } = useAuth();
  const signedIn = state === 'signedIn';
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  const initialized = useRef(false);
  const seen = useRef(new Set<string>());
  const [toast, setToast] = useState<ToastItem | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: signedIn,
    refetchInterval: signedIn ? (isActive ? 20_000 : false) : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      setIsActive(active);
      if (active && signedIn) void refetch();
    });
    return () => sub.remove();
  }, [refetch, signedIn]);

  useEffect(() => {
    if (!signedIn) {
      initialized.current = false;
      seen.current.clear();
      const timer = setTimeout(() => setToast(null), 0);
      return () => clearTimeout(timer);
    }
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !data) return;
    if (!initialized.current) {
      data.forEach((item) => seen.current.add(item.id));
      initialized.current = true;
      return;
    }
    const fresh = data.find((item) => !seen.current.has(item.id));
    data.forEach((item) => seen.current.add(item.id));
    if (fresh && isActive) {
      setToast({ notification: fresh, tone: toneFor(fresh) });
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [data, isActive, signedIn]);

  if (!signedIn || !toast || !isActive) return null;
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open new notification" onPress={() => { setToast(null); router.push('/notifications'); }} style={[styles.toast, styles[toast.tone]]}>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{toast.notification.title}</Text>
          <Text numberOfLines={2} style={styles.body}>{toast.notification.body}</Text>
        </View>
        <Text accessibilityLabel="Dismiss notification" onPress={(event) => { event.stopPropagation(); setToast(null); }} style={styles.dismiss}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 54, left: spacing.md, right: spacing.md, zIndex: 1000, elevation: 20 },
  toast: { borderRadius: 16, borderLeftWidth: 5, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  success: { backgroundColor: '#EAF8F0', borderLeftColor: '#188A51' },
  debit: { backgroundColor: '#EEF3FF', borderLeftColor: '#315CCB' },
  reversal: { backgroundColor: '#F2EEFF', borderLeftColor: '#7250B8' },
  failure: { backgroundColor: '#FFF0EF', borderLeftColor: '#C43D3D' },
  copy: { flex: 1 },
  title: { color: colors.midnight, fontWeight: '800', fontSize: 14 },
  body: { color: colors.navy, fontSize: 12, marginTop: 3 },
  dismiss: { color: colors.muted, fontSize: 22, paddingHorizontal: 4 },
});
