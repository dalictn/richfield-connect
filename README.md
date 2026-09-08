# Richfield Connect — Phase 2

Production-oriented React Native + Firebase authentication foundation for the Richfield Connect hackathon platform.

## Phase boundary

This delivery contains Phase 1 plus the approved Phase 2 portfolio/AI slice:

- React Native 0.81.4 runtime scaffolding
- React Native Web interoperability
- SVG transformer + `@/*` source alias
- Firebase Authentication identity boundary
- Firebase Authentication `beforeUserCreated` blocking trigger
- Alumni verification session + rate limiting
- Business registration intent + approval gate
- Real-time `users/{uid}` profile synchronization
- Role-aware navigation and role tab shells
- Live Pending Admin Approval state
- Administrator provisioning script retained from the original starter
- PortfolioProfile schema and granular profile visibility
- Server-side portfolio validation and profile completeness evaluation
- Four-step profile onboarding wizard
- Context-aware AI profile assistant using OpenAI or Anthropic secrets
- NLP CV extraction into structured profile data
- Skill endorsement validation
- Server-side visible-profile redaction boundary

Social graph, video processing, opportunity matching, dashboards, and the full admin panel remain intentionally outside Phase 2.

## Security model

### Student

The Phase 1 contract supplied for this project uses exactly:

- `@richfield.ac.za`
- `@aaa.ac.za`

The server-side `beforeUserCreated` trigger enforces this boundary. Client validation is only a UX optimisation.

### Alumni

The client never reads `alumni_registry`. `verifyAlumniCredentials` performs the registry lookup server-side, returns no registry fields or document IDs, uses a generic response, and applies rate limits by lookup key, email, and caller IP where available.

A successful match creates a short-lived, hashed verification session. The app then sends a Firebase email sign-in link. When the link is redeemed, the backend consumes the session and creates the alumni profile/claims.

### Business

A short-lived registration intent is created server-side before the Firebase Auth account is created. The business profile is created with:

```json
{
  "role": "business",
  "isApproved": false
}
```

Only the administrator callable can set `isApproved: true` and the matching Auth custom claims.

### Administrator

There is no administrator registration UI. Use `admin/provision-admin.mjs` with Firebase Admin SDK credentials.

## Firebase requirements

1. Enable Firebase Authentication with Identity Platform so blocking functions can be used.
2. Enable Email/Password and Email Link providers.
3. Register the Android package `za.ac.richfield.connect` and iOS bundle ID `za.ac.richfield.connect`.
4. Add `android/app/google-services.json` and `ios/GoogleService-Info.plist` after generating the native shells.
5. Enable Firebase Hosting/default project hosting domain for email-link authentication. The link is derived from the Firebase project ID as `https://<project-id>.firebaseapp.com/alumni-finish`; Firebase Dynamic Links are not used.
6. Configure App Check for the mobile apps. Development uses debug providers; production uses Play Integrity/App Attest.
7. For web, fill `src/firebase.ts` with the Firebase Web App configuration and provide the App Check reCAPTCHA v3 site key through `globalThis.__RICHFIELD_APP_CHECK_WEB_SITE_KEY__` before boot.

## Native shell generation

The original starter did not contain generated Gradle/Xcode directories. On Windows PowerShell:

```powershell
.\bootstrap-native.ps1
```

This creates a clean React Native 0.81.4 native shell and copies its `android` and `ios` directories into this project. Then install dependencies and add the Firebase native configuration files.

## Install

```powershell
npm install
cd functions
npm install
cd ..
```

## Typecheck

```powershell
npm run typecheck
cd functions
npm run build
```

## Firebase deployment

```powershell
firebase login
firebase use <your-project-id>
cd functions
npm run build
cd ..
firebase deploy --only functions,firestore:rules
```

## Native launch

```powershell
npx react-native start --reset-cache
npx react-native run-android
```

For iOS, use macOS/Xcode and run `pod install` before `npx react-native run-ios`.

## Admin provisioning

Set Google Application Default Credentials or point `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON outside the repository, then:

```powershell
node admin/provision-admin.mjs admin@richfield.ac.za "A-Temporary-Password-At-Least-12-Chars" "Richfield Administrator"
```

Rotate the temporary password after first sign-in.

## POPIA-oriented implementation notes

- Alumni source records are never exposed to clients.
- Identity attributes are used only inside the verification boundary.
- Verification sessions store a hash rather than the raw session token.
- Registration and approval state is server-controlled.
- Firebase Security Rules deny direct client writes to privileged collections.
- The app does not embed service-account credentials.
- Email-link authentication uses Firebase Hosting links rather than deprecated Firebase Dynamic Links.
