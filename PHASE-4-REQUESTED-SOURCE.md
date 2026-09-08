# Richfield Connect — Phase 4 Requested Source

Phase 4 builds on the Phase 3 baseline and is intentionally limited to:
- skills-driven opportunities and admin approval
- student applications
- cosine/overlap skill matching with programme bonus
- FCM notification registration and server triggers
- student, business, and administrator visual analytics dashboards

## New backend files

### functions/src/opportunities.ts
Implements `createOpportunity`, `reviewOpportunity`, `applyToOpportunity`, `recordOpportunityView`, `recordSkillSearch`, `recomputeOpportunityMatches`, and the internal `matchApprovedOpportunity` pipeline.

### functions/src/notifications.ts
Implements FCM device registration, administrator announcement creation, connection request/acceptance notifications, direct-message notifications, opportunity-match notifications, announcement broadcasts, and automatic matching after opportunity approval.

### functions/src/analytics.ts
Implements activity heartbeats, profile-view tracking, student/business/admin analytics callables, and platform analytics triggers.

## New mobile files

### src/types/opportunity.ts
Typed opportunity and match models.

### src/types/analytics.ts
Typed student, business, and administrator dashboard models.

### src/opportunities/opportunityService.ts
Realtime approved/pending opportunity and student-match listeners plus callable operations.

### src/analyticsService.ts
Callable analytics/profile-view client layer.

### src/notifications/notificationService.native.ts
Native FCM permission, token registration, foreground listener, and token-refresh handling.

### src/notifications/notificationService.web.ts
Web-safe notification fallback. Native FCM remains enabled for Android/iOS; web can be connected to Firebase Web Messaging once a project-specific VAPID/service-worker configuration is supplied.

### src/screens/opportunities/OpportunityBoardScreen.tsx
Business opportunity submission and student opportunity application UI.

### src/screens/analytics/MetricCard.tsx
Reusable metric and bar-chart UI primitives.

### src/screens/analytics/StudentAnalyticsScreen.tsx
Student profile views, connection growth, applications, engagement, completeness, peer comparison, skill demand, and opportunity matches.

### src/screens/analytics/BusinessAnalyticsScreen.tsx
Business listings, applicants, views, conversion, reach, talent demand, programme distribution, and year distribution.

### src/screens/analytics/AdminAnalyticsScreen.tsx
Role distribution, 7/30-day activity/retention, registrations, registration trend, content volume, flags, and pending business approvals.

## Modified files

- `functions/src/index.ts` — exports Phase 4 functions.
- `functions/package.json` — retains Firebase Admin/Functions and Node 22 baseline.
- `src/App.tsx` — initializes notification registration/token refresh after bootstrap.
- `src/auth/AuthProvider.tsx` — records authenticated activity heartbeat.
- `src/firebaseApi.native.ts` / `src/firebaseApi.web.ts` — announcement callable helper.
- `src/navigation/RootNavigator.tsx` — adds Opportunities navigation for applicable roles.
- Student/Business/Admin dashboard screens — now render visual analytics and relevant Phase 4 controls.
- `firestore/firestore.rules` — locks Phase 4 server-managed collections and exposes only role-authorized reads.
- `PHASE-4.md` — deployment and phase-boundary notes.

## Phase 4 data model

`opportunities/{opportunityId}`
- ownerUid
- companyName
- title
- description
- type
- location
- remote
- requiredSkills
- programmeTags
- status: pending | approved | rejected | closed
- applicantCount
- viewCount
- timestamps

`opportunities/{opportunityId}/applications/{studentUid}`
- studentUid
- status
- timestamps

`matches/{studentUid}/opportunities/{opportunityId}`
- opportunityId
- studentUid
- score
- matchedSkills
- programmeMatch
- timestamps

`users/{uid}/devices/{deviceId}`
- token
- platform
- timestamps

`announcements/{announcementId}`
- title
- body
- targetRole
- createdBy
- createdAt

`skill_demand/{skill}`
- skill
- count
- lastSearchedAt
- lastSearchedBy

`analytics/users/profiles/{uid}`
- profileViews
- updatedAt

`analytics/platform`
- registration and opportunity status counters

## Matching model

The matching score is deterministic and explainable:

`score = min(1, cosineSkillSimilarity * 0.85 + programmeMatch * 0.15)`

For the skills vector, each normalized skill is treated as a binary feature. This gives cosine similarity equal to set-overlap divided by the geometric mean of the two set sizes. Matches below 0.20 are not persisted.

## Security boundary

The client does not write opportunities, applications, match documents, FCM devices, skill-demand counters, profile-view markers, or analytics. Those mutations are performed by authenticated callable Functions or Firestore triggers. Firestore rules therefore expose the minimum required read surfaces while denying direct client writes.

## Phase boundary

Not implemented in Phase 4:
- full enterprise administrator panel
- complete moderation lifecycle
- final comprehensive security hardening
- production Android/iOS build verification

Those remain Phase 5 work.
