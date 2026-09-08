import { getApp } from '@react-native-firebase/app';
import {
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';

let initialized = false;

export async function initializeRichfieldAppCheck(): Promise<void> {
  if (initialized) return;

  const provider = new ReactNativeFirebaseAppCheckProvider();
  provider.configure({
    android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
    apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
  });

  await initializeAppCheck(getApp(), {
    provider,
    isTokenAutoRefreshEnabled: true,
  });

  initialized = true;
}
