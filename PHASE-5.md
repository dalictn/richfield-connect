# Phase 5 — Enterprise Administration, Moderation, Broadcast & Final Security Boundary

Phase 5 completes the authorized final-phase implementation. It adds administrator user lifecycle management, moderation queue actions, role-targeted broadcasts, privileged audit logging, hardened Firestore rules, production build/POPIA readiness evidence requirements, and the Phase 3 Transcoder input URI correction.

## Transcoder correction

The Phase 3 `functions/src/videoProcessing.ts` bug is patched from:

`gs://${bucket}/${sourcePath}`

to:

`gs://${bucket}/${name}`

The complete Cloud Storage object name must be passed to the Transcoder job.

## Important release gate

A source tree cannot by itself constitute legal POPIA sign-off. The checklist therefore distinguishes engineering readiness from formal compliance approval by Richfield's authorised Information Officer/legal/compliance function.
