import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { notificationsApi } from './services';

const PUSH_TOKEN_KEY = 'laupay_expo_push_token';
export type PushRegistrationResult = 'registered' | 'permission-denied' | 'unsupported' | 'setup-required';

export async function registerPushNotifications(requestPermission: boolean): Promise<PushRegistrationResult> {
  const platform = Platform.OS;
  if (platform !== 'android' && platform !== 'ios') return 'unsupported';

  if (platform === 'android') {
    await Notifications.setNotificationChannelAsync('transaction_updates', {
      name: 'Transaction updates',
      description: 'Secure alerts about wallet and purchase activity.',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: '#071735',
      showBadge: true,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let finalStatus = current.status;
  if (finalStatus !== 'granted' && requestPermission) {
    finalStatus = (await Notifications.requestPermissionsAsync()).status;
  }
  if (finalStatus !== 'granted') return 'permission-denied';

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'setup-required';

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await notificationsApi.registerPushToken(token, platform);
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return 'registered';
  } catch {
    // No push token or backend error may block sign-in, purchases, or the inbox.
    throw new Error('Push registration is unavailable. Use a development build with Expo push credentials and a reachable LAUPAY API.');
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) return;
  await notificationsApi.unregisterPushToken(token);
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => undefined);
}
