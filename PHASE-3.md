# Richfield Connect — Phase 3

Phase 3 implements only the authorized roadmap scope:

1. Social networking graph: connection requests, acceptance/decline, symmetric connection membership.
2. Engagement: posts, reactions, comments, and server-side counters.
3. Role-ranked feed: fan-out feed items are scored using viewer role, author role, freshness, reactions, and comments.
4. Direct messaging: only connected users can message; conversations and messages are live Firestore listeners.
5. Video processing engine: source video is private, a Cloud Storage finalization trigger submits an asynchronous Google Cloud Transcoder job for H.264/AAC 720p output and a thumbnail sprite. Processed objects are the only client-readable media.

## Phase boundary

Phase 4 is deliberately not implemented. There is no FCM notification engine, smart opportunity matching pipeline, or analytics dashboard in this release.

## Backend architecture

- Client mutations call Firebase callable functions with App Check enforcement.
- Firestore client writes to social data are denied; privileged mutations occur server-side.
- Connection and message state is observed with Firestore `onSnapshot`, not polling.
- Video source objects are write-only for their owner and unreadable from the client.
- Transcoder jobs are asynchronous. Set `TRANSCODER_LOCATION` to a Google Cloud Transcoder-supported region; it defaults to `europe-west1` because the Firebase Function region `africa-south1` is not a Transcoder job location.

## Deployment

From the project root:

```powershell
npm install
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,storage,functions
```

Enable the Google Cloud Transcoder API and grant the Functions runtime service account permission to create Transcoder jobs and write the configured Cloud Storage bucket.

The Google Cloud Transcoder service is asynchronous and writes its processed outputs back to Cloud Storage. See the official Transcoder documentation for supported locations and IAM requirements.
