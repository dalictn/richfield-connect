import { getMessaging, getToken, onMessage, onTokenRefresh, requestPermission } from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import { callFunction } from '../firebaseApi';

const messaging = getMessaging(getApp());

export async function registerForNotifications(): Promise<void> {
  const permission = await requestPermission(messaging);
  if (permission === 0) return;
  const token = await getToken(messaging);
  if (token) await callFunction<{ token: string; platform: string }, { ok: boolean }>('registerFcmToken', { token, platform: 'native' });
}
export function subscribeNotificationMessages(onNotification: (title: string, body: string) => void): () => void {
  return onMessage(messaging, async (message) => onNotification(message.notification?.title ?? 'Richfield Connect', message.notification?.body ?? ''));
}
export function subscribeTokenRefresh(): () => void {
  return onTokenRefresh(messaging, async (token) => { if (token) await callFunction<{ token: string; platform: string }, { ok: boolean }>('registerFcmToken', { token, platform: 'native' }); });
}
