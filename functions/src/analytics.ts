import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { adminDb as db } from './firebaseAdmin';

const REGION = 'africa-south1';
function uidOf(request: { auth?: { uid?: string | null } | null }): string { if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.'); return request.auth.uid; }
function roleOf(request: { auth?: { uid?: string | null; token?: Record<string, unknown> } | null }): string { const uid = uidOf(request); const role = String(request.auth?.token?.role ?? ''); if (!['student','alumni','business','administrator'].includes(role)) throw new HttpsError('permission-denied', 'A valid platform role is required.'); if (role === 'business' && request.auth?.token?.isApproved !== true) throw new HttpsError('permission-denied', 'Business approval is required.'); return role; }
function adminOnly(request: { auth?: { uid?: string | null; token?: Record<string, unknown> } | null }): void { uidOf(request); if (request.auth?.token?.role !== 'administrator') throw new HttpsError('permission-denied', 'Administrator role required.'); }

export const recordUserActivity = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const uid = uidOf(request);
    await db.collection('users').doc(uid).set({ lastActiveAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('recordUserActivity failed', error);
    throw new HttpsError('internal', 'Unable to record activity.');
  }
});

export const recordProfileView = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const viewerUid = uidOf(request); roleOf(request); const profileUid = String(request.data?.profileUid ?? '').trim();
    if (!profileUid || profileUid === viewerUid) return { ok: true };
    const marker = db.collection('profile_views').doc(`${viewerUid}_${profileUid}`);
    const markerSnap = await marker.get();
    if (!markerSnap.exists) {
      await db.runTransaction(async (transaction) => {
        transaction.create(marker, { viewerUid, profileUid, createdAt: FieldValue.serverTimestamp() });
        transaction.set(db.collection('analytics').doc('users').collection('profiles').doc(profileUid), { profileViews: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      });
    }
    return { ok: true };
  } catch (error) { if (error instanceof HttpsError) throw error; console.error('recordProfileView failed', error); throw new HttpsError('internal', 'Unable to record profile view.'); }
});

export const getStudentAnalytics = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const uid = uidOf(request); const role = roleOf(request); if (role !== 'student') throw new HttpsError('permission-denied', 'Student analytics required.');
    const profileSnap = await db.collection('users').doc(uid).get();
    const profile = profileSnap.data() ?? {};
    const profileAnalytics = (await db.collection('analytics').doc('users').collection('profiles').doc(uid).get()).data() ?? {};
    const connections = await db.collection('connections').doc(uid).collection('members').count().get();
    const recentConnections = await db.collection('connections').doc(uid).collection('members').where('connectedAt', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).count().get();
    const applications = await db.collectionGroup('applications').where('studentUid', '==', uid).count().get();
    const posts = await db.collection('posts').where('uid', '==', uid).get();
    const videos = await db.collection('videos').where('uid', '==', uid).get();
    const engagement = posts.docs.reduce((sum, doc) => sum + Number(doc.data().reactionCount ?? 0) + Number(doc.data().commentCount ?? 0), 0) + videos.docs.reduce((sum, doc) => sum + Number(doc.data().viewCount ?? 0) + Number(doc.data().reactionCount ?? 0), 0);
    const matches = await db.collection('matches').doc(uid).collection('opportunities').orderBy('score', 'desc').limit(10).get();
    const demand = await db.collection('skill_demand').orderBy('count', 'desc').limit(10).get();
    const checklist = [Boolean(profile.headline), String(profile.summary ?? '').length >= 100, Boolean(profile.avatarUrl), Array.isArray(profile.skills) && profile.skills.length >= 3, Array.isArray(profile.qualifications) && profile.qualifications.length > 0, Array.isArray(profile.workExperience) && profile.workExperience.length > 0, Boolean(profile.gitHubUrl || profile.portfolioUrl), Boolean(profile.linkedInUrl), Boolean(profile.campusLocation)];
    const completeness = Math.round(checklist.filter(Boolean).length / checklist.length * 100);
    const peers = profile.programmeOfStudy ? await db.collection('users').where('role', '==', 'student').where('programmeOfStudy', '==', profile.programmeOfStudy).limit(500).get() : null;
    let peerAverage = completeness;
    if (peers && peers.size) {
      let total = 0;
      for (const peer of peers.docs) { const p = peer.data(); const checks = [Boolean(p.headline), String(p.summary ?? '').length >= 100, Boolean(p.avatarUrl), Array.isArray(p.skills) && p.skills.length >= 3, Array.isArray(p.qualifications) && p.qualifications.length > 0, Array.isArray(p.workExperience) && p.workExperience.length > 0, Boolean(p.gitHubUrl || p.portfolioUrl), Boolean(p.linkedInUrl), Boolean(p.campusLocation)]; total += checks.filter(Boolean).length / checks.length * 100; }
      peerAverage = Math.round(total / peers.size);
    }
    return { profileViews: Number(profileAnalytics.profileViews ?? 0), connectionCount: connections.data().count, connections30d: recentConnections.data().count, applications: applications.data().count, engagement, profileCompleteness: completeness, peerAverageCompleteness: peerAverage, topMatches: matches.docs.map((doc) => ({ opportunityId: doc.id, score: Number(doc.data().score ?? 0) })), skillDemand: demand.docs.map((doc) => ({ skill: doc.id, count: Number(doc.data().count ?? 0) })) };
  } catch (error) { if (error instanceof HttpsError) throw error; console.error('getStudentAnalytics failed', error); throw new HttpsError('internal', 'Unable to load student analytics.'); }
});

export const getBusinessAnalytics = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const uid = uidOf(request); const role = roleOf(request); if (role !== 'business') throw new HttpsError('permission-denied', 'Business analytics required.');
    const listings = await db.collection('opportunities').where('ownerUid', '==', uid).get();
    let applicants = 0; let views = 0; let approved = 0; let applications = 0;
    const programmeCounts: Record<string, number> = {}; const yearCounts: Record<string, number> = {};
    for (const doc of listings.docs) { const data = doc.data(); applicants += Number(data.applicantCount ?? 0); views += Number(data.viewCount ?? 0); if (data.status === 'approved') approved += 1; const appSnap = await doc.ref.collection('applications').get(); applications += appSnap.size; for (const app of appSnap.docs) { const student = await db.collection('users').doc(String(app.data().studentUid ?? app.id)).get(); const studentData = student.data() ?? {}; const programme = String(studentData.programmeOfStudy ?? 'Unknown'); const year = String(studentData.yearOfEnrolment ?? studentData.graduationYear ?? 'Unknown'); programmeCounts[programme] = (programmeCounts[programme] ?? 0) + 1; yearCounts[year] = (yearCounts[year] ?? 0) + 1; } }
    const conversion = views > 0 ? applications / views : 0;
    const skills = await db.collection('skill_demand').orderBy('count', 'desc').limit(12).get();
    return { listings: listings.size, approvedListings: approved, applicants, views, applications, conversionRate: conversion, reach: views + applicants, candidateSkillDemand: skills.docs.map((doc) => ({ skill: doc.id, count: Number(doc.data().count ?? 0) })), applicantsByProgramme: Object.entries(programmeCounts).map(([programme, count]) => ({ programme, count })), applicantsByYear: Object.entries(yearCounts).map(([year, count]) => ({ year, count })) };
  } catch (error) { if (error instanceof HttpsError) throw error; console.error('getBusinessAnalytics failed', error); throw new HttpsError('internal', 'Unable to load business analytics.'); }
});

export const getAdminAnalytics = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    adminOnly(request);
    const users = await db.collection('users').get();
    const roles = { student: 0, alumni: 0, business: 0, administrator: 0 };
    let pendingBusinesses = 0; let active7d = 0; let active30d = 0; const now = Date.now(); const registrationBuckets: Record<string, number> = {};
    for (const doc of users.docs) { const data = doc.data(); const role = data.role as keyof typeof roles; if (role in roles) roles[role] += 1; if (data.role === 'business' && data.isApproved !== true) pendingBusinesses += 1; const active = data.lastActiveAt?.toMillis?.() ?? 0; if (active >= now - 7 * 86400000) active7d += 1; if (active >= now - 30 * 86400000) active30d += 1; const created = data.createdAt?.toMillis?.() ?? 0; if (created) { const key = new Date(created).toISOString().slice(0, 7); registrationBuckets[key] = (registrationBuckets[key] ?? 0) + 1; } }
    const [posts, videos, opportunities, flagged, monthlyRegistrations] = await Promise.all([db.collection('posts').count().get(), db.collection('videos').count().get(), db.collection('opportunities').count().get(), db.collection('moderation_flags').where('status', '==', 'open').count().get(), db.collection('users').where('createdAt', '>=', new Date(now - 30 * 86400000)).count().get()]);
    return { totalUsers: users.size, roles, activeUsers7d: active7d, activeUsers30d: active30d, retention7d: users.size ? active7d / users.size : 0, retention30d: users.size ? active30d / users.size : 0, newRegistrations30d: monthlyRegistrations.data().count, registrationTrend: Object.entries(registrationBuckets).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })), content: { posts: posts.data().count, videos: videos.data().count, opportunities: opportunities.data().count }, flaggedContent: flagged.data().count, pendingBusinessApprovals: pendingBusinesses };
  } catch (error) { if (error instanceof HttpsError) throw error; console.error('getAdminAnalytics failed', error); throw new HttpsError('internal', 'Unable to load administrator analytics.'); }
});

export const updateRegistrationAnalytics = onDocumentCreated({ document: 'users/{uid}', region: REGION }, async (event) => {
  const data = event.data?.data(); if (!data) return;
  await db.collection('analytics').doc('platform').set({ registrationsByRole: { [String(data.role)]: FieldValue.increment(1) }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
});

export const updateOpportunityAnalytics = onDocumentUpdated({ document: 'opportunities/{opportunityId}', region: REGION }, async (event) => {
  const before = event.data?.before.data(); const after = event.data?.after.data(); if (!before || !after) return;
  if (before.status !== after.status) await db.collection('analytics').doc('platform').set({ [`opportunityStatus.${String(after.status)}`]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
});
