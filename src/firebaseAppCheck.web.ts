import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getWebFirebaseApp } from './firebaseApi.web';

// Injected by webpack's DefinePlugin from RICHFIELD_APP_CHECK_SITE_KEY. A
// reCAPTCHA v3 site key is public by design, so baking it into the bundle is
// expected; enforcement happens server-side.
declare const __RICHFIELD_APP_CHECK_SITE_KEY__: string | undefined;

let initialized = false;

export async function initializeRichfieldAppCheck(): Promise<void> {
  if (initialized) return;

  const runtimeConfig = globalThis as typeof globalThis & { __RICHFIELD_APP_CHECK_WEB_SITE_KEY__?: string };
  const buildTimeKey = typeof __RICHFIELD_APP_CHECK_SITE_KEY__ !== 'undefined' ? __RICHFIELD_APP_CHECK_SITE_KEY__ : '';
  const siteKey = buildTimeKey || runtimeConfig.__RICHFIELD_APP_CHECK_WEB_SITE_KEY__ || '';

  // In local development / demo mode, skip App Check instead of crashing
  if (!siteKey) {
    console.warn(
      'App Check skipped: no reCAPTCHA v3 site key. Callables deployed with ' +
      'enforceAppCheck will reject this client. Set RICHFIELD_APP_CHECK_SITE_KEY ' +
      'at build time, or run against the emulators, which do not enforce App Check.',
    );
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