import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getWebFirebaseApp } from './firebaseApi.web';

let initialized = false;

export async function initializeRichfieldAppCheck(): Promise<void> {
  if (initialized) return;

  const runtimeConfig = globalThis as typeof globalThis & { __RICHFIELD_APP_CHECK_WEB_SITE_KEY__?: string };
  const siteKey = runtimeConfig.__RICHFIELD_APP_CHECK_WEB_SITE_KEY__ ?? '';

  // In local development / demo mode, skip App Check instead of crashing
  if (!siteKey) {
    console.warn('App Check skipped: No reCAPTCHA site key configured for local web environment.');
    initialized = true;
    return;
  }

  try {
    initializeAppCheck(getWebFirebaseApp(), {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    initialized = true;
  } catch (error) {
    console.warn('Failed to initialize App Check:', error);
  }
}