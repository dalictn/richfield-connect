# Richfield Connect — Phase 1

Phase 1 contains only runtime scaffolding, the hardened identity/authentication layer, role-aware navigation, and real-time profile state synchronization.

## Security boundary

- Student self-registration is restricted server-side to `@richfield.ac.za` and `@aaa.ac.za`.
- Business and alumni non-institutional Auth creation requires a short-lived server-side registration intent.
- New-user custom claims are server-controlled; clients cannot establish roles or approval state.
- `alumni_registry` is never readable by the mobile client.
- Alumni verification responses are deliberately generic and rate-limited.
- Business approval is performed by an administrator callable and updates both the Firestore profile and Auth custom claims.
- The client listens to the user's profile with Firestore `onSnapshot` and forces a token refresh after role/approval state changes.
- Administrator accounts are provisioned outside the client registration flow.

## Important Firebase setup

1. Upgrade Firebase Authentication to Identity Platform so blocking functions can be deployed.
2. Enable Email/Password and Email Link authentication.
3. Register the Android package `za.ac.richfield.connect` and iOS bundle ID `za.ac.richfield.connect` in Firebase.
4. Add `android/app/google-services.json` and `ios/GoogleService-Info.plist` after generating the native shells.
5. Configure Firebase Hosting/default project domain for email-link authentication. The code derives `https://<project-id>.firebaseapp.com/alumni-finish`; it does not use Firebase Dynamic Links.
6. Configure App Check for Android/iOS. Development builds use the debug provider; production uses Play Integrity/App Attest.
7. Web requires the Firebase Web configuration in `src/firebase.ts` and an App Check reCAPTCHA v3 site key injected as `globalThis.__RICHFIELD_APP_CHECK_WEB_SITE_KEY__`.

## Native shell

The supplied repository intentionally keeps the React Native application source independent from generated Gradle/Xcode machine files. Run `./bootstrap-native.ps1` on Windows PowerShell to generate the React Native 0.81.4 Android/iOS shells, then install dependencies.

## Backend deployment

```text
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions,firestore:rules
```

The blocking trigger requires Firebase Authentication with Identity Platform. Firebase documents blocking triggers as pre-creation hooks that can reject registration before the account is stored. The project uses that boundary rather than relying on client validation.
