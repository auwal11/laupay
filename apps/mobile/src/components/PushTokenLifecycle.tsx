import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '../features/auth/AuthProvider';
import { registerPushNotifications } from '../api/push-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export default function PushTokenLifecycle() {
  const { state } = useAuth();

  useEffect(() => {
    if (state !== 'signedIn' || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
    const sync = () => { void registerPushNotifications(false).catch(() => undefined); };
    sync();
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });
    const tokenChanges = Notifications.addPushTokenListener(sync);
    const openInbox = () => {
      router.push('/notifications');
      Notifications.clearLastNotificationResponse();
    };
    const initial = Notifications.getLastNotificationResponse();
    if (initial?.notification.request.content.data?.notificationId && state === 'signedIn') openInbox();
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      if (event.notification.request.content.data?.notificationId) openInbox();
    });
    return () => {
      appState.remove();
      tokenChanges.remove();
      response.remove();
    };
  }, [state]);

  return null;
}
