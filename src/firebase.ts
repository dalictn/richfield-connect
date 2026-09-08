/**
 * Firebase configuration shared by the web fallback and native bootstrap.
 * Native Android/iOS builds use google-services.json / GoogleService-Info.plist.
 * Web builds must provide the Firebase Web SDK configuration below from the
 * Firebase Console. No service-account credentials belong in this file.
 */
export const WEB_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyATlnPhIOHQys_G1QxGM1lkEO7uR30HgmE',
  authDomain: 'richfield-nexus.firebaseapp.com',
  projectId: 'richfield-nexus',
  storageBucket: 'richfield-nexus.firebasestorage.app',
  messagingSenderId: '28078702367',
  appId: '1:28078702367:web:652716e02ec43359797a2a',
} as const;

export function assertWebFirebaseConfig(): void {
  const missing = Object.entries(WEB_FIREBASE_CONFIG)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Web Firebase configuration is incomplete. Configure: ${missing.join(', ')} in src/firebase.ts.`,
    );
  }
}