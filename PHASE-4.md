# Richfield Connect — Phase 4

Phase 4 implements the authorized roadmap scope:

1. Skills-driven opportunity listings and administrator approval.
2. Student applications and deterministic skill matching using cosine similarity over normalized skill sets, plus a programme-match bonus.
3. Firestore-triggered FCM notifications for connection requests/acceptance, direct messages, opportunity matches, and administrator announcements.
4. Three role-specific visual analytics dashboards.
5. Server-only analytics mutations and callable reads.

## Deployment

From `functions/`:

```powershell
npm install
npm run build
```

From the repository root:

```powershell
npm install
firebase deploy --only functions,firestore:rules
```

For native push notifications, configure Firebase Cloud Messaging for Android/iOS and ensure the Firebase app is linked to the native projects.

## Phase boundary

Phase 5 remains intentionally untouched: full enterprise admin panel, comprehensive final Firestore security hardening, moderation lifecycle, and production build verification.
