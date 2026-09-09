import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth as auth, adminDb as db } from './firebaseAdmin';
import { APP_CHECK_ENFORCEMENT } from './appCheck';

const REGION = 'africa-south1';
const ROLES = new Set(['student', 'alumni', 'business', 'administrator']);
const OPPORTUNITY_TYPES = new Set(['internship', 'learnership', 'part-time', 'graduate', 'full-time']);
const STATUSES = new Set(['pending', 'approved', 'rejected', 'closed']);

function uidOf(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}
function roleOf(request: { auth?: { uid?: string | null; token?: Record<string, unknown> } | null }): string {
  const uid = uidOf(request);
  const role = String(request.auth?.token?.role ?? '');
  if (!ROLES.has(role)) throw new HttpsError('permission-denied', 'A valid platform role is required.');
  if (role === 'business' && request.auth?.token?.isApproved !== true) throw new HttpsError('permission-denied', 'Business approval is required.');
  return role;
}
function adminOnly(request: { auth?: { uid?: string | null; token?: Record<string, unknown> } | null }): string {
  const uid = uidOf(request);
  if (request.auth?.token?.role !== 'administrator') throw new HttpsError('permission-denied', 'Administrator role required.');
  return uid;
}
function text(value: unknown, field: string, max: number, required = true): string {
  const result = String(value ?? '').trim();
  if (required && !result) throw new HttpsError('invalid-argument', `${field} is required.`);
  if (result.length > max) throw new HttpsError('invalid-argument', `${field} is too long.`);
  return result;
}
function skills(value: unknown): string[] {
  if (!Array.isArray(value)) throw new HttpsError('invalid-argument', 'Required skills must be an array.');
  return Array.from(new Set(value.map((item) => text(item, 'Skill', 80)).filter(Boolean))).slice(0, 80);
}
function normalise(value: string): string { return value.toLowerCase().replace(/[^a-z0-9+#.\- ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function skillSimilarity(a: string[], b: string[]): number {
  const left = new Set(a.map(normalise).filter(Boolean));
  const right = new Set(b.map(normalise).filter(Boolean));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / Math.sqrt(left.size * right.size);
}
function programmeSimilarity(profile: Record<string, unknown>, opportunity: Record<string, unknown>): number {
  const programme = normalise(String(profile.programmeOfStudy ?? profile.programme ?? ''));
  const tags = Array.isArray(opportunity.programmeTags) ? opportunity.programmeTags.map((x) => normalise(String(x))) : [];
  return programme && tags.includes(programme) ? 1 : 0;
}

export const createOpportunity = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = uidOf(request);
    const role = roleOf(request);
    if (role !== 'business') throw new HttpsError('permission-denied', 'Only approved business users may post opportunities.');
    const data = (request.data ?? {}) as Record<string, unknown>;
    const type = String(data.type ?? '');
    if (!OPPORTUNITY_TYPES.has(type)) throw new HttpsError('invalid-argument', 'Invalid opportunity type.');
    const requiredSkills = skills(data.requiredSkills);
    if (!requiredSkills.length) throw new HttpsError('invalid-argument', 'At least one required skill is required.');
    const ref = db.collection('opportunities').doc();
    const now = Timestamp.now();
    const user = await db.collection('users').doc(uid).get();
    const profile = user.data() ?? {};
    await ref.set({
      ownerUid: uid,
      companyName: text(data.companyName ?? profile.companyName, 'Company name', 160),
      title: text(data.title, 'Title', 180),
      description: text(data.description, 'Description', 4000),
      type,
      location: text(data.location, 'Location', 200),
      remote: Boolean(data.remote),
      requiredSkills,
      programmeTags: Array.isArray(data.programmeTags) ? data.programmeTags.map((x) => text(x, 'Programme tag', 120)).slice(0, 20) : [],
      status: 'pending',
      applicantCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, opportunityId: ref.id, status: 'pending' };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('createOpportunity failed', error);
    throw new HttpsError('internal', 'Unable to create opportunity.');
  }
});

export const reviewOpportunity = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    adminOnly(request);
    const opportunityId = text(request.data?.opportunityId, 'Opportunity ID', 128);
    const status = String(request.data?.status ?? '');
    if (!['approved', 'rejected', 'closed'].includes(status)) throw new HttpsError('invalid-argument', 'Invalid review status.');
    const ref = db.collection('opportunities').doc(opportunityId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Opportunity not found.');
    const current = snap.data() ?? {};
    if (current.status === 'approved' && status === 'approved') return { ok: true, status };
    await ref.update({ status, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, status };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('reviewOpportunity failed', error);
    throw new HttpsError('internal', 'Unable to review opportunity.');
  }
});

export const applyToOpportunity = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = uidOf(request);
    const role = roleOf(request);
    if (role !== 'student') throw new HttpsError('permission-denied', 'Only students may apply to opportunities.');
    const opportunityId = text(request.data?.opportunityId, 'Opportunity ID', 128);
    const ref = db.collection('opportunities').doc(opportunityId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.status !== 'approved') throw new HttpsError('failed-precondition', 'This opportunity is not available for applications.');
    const opportunity = snap.data()!;
    if (opportunity.ownerUid === uid) throw new HttpsError('failed-precondition', 'You cannot apply to your own opportunity.');
    const applicationRef = ref.collection('applications').doc(uid);
    const existing = await applicationRef.get();
    if (existing.exists) return { ok: true, status: existing.data()?.status ?? 'submitted' };
    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (transaction) => {
      transaction.set(applicationRef, { studentUid: uid, status: 'submitted', createdAt: now, updatedAt: now });
      transaction.update(ref, { applicantCount: FieldValue.increment(1), updatedAt: now });
    });
    return { ok: true, status: 'submitted' };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('applyToOpportunity failed', error);
    throw new HttpsError('internal', 'Unable to submit application.');
  }
});

export const recordOpportunityView = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = uidOf(request);
    const role = roleOf(request);
    const opportunityId = text(request.data?.opportunityId, 'Opportunity ID', 128);
    const ref = db.collection('opportunities').doc(opportunityId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.status !== 'approved') throw new HttpsError('not-found', 'Opportunity not found.');
    const viewKey = `${uid}_${opportunityId}`;
    const marker = db.collection('opportunity_views').doc(viewKey);
    const markerSnap = await marker.get();
    if (!markerSnap.exists) {
      await db.runTransaction(async (transaction) => {
        transaction.create(marker, { uid, opportunityId, role, createdAt: FieldValue.serverTimestamp() });
        transaction.update(ref, { viewCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      });
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('recordOpportunityView failed', error);
    throw new HttpsError('internal', 'Unable to record opportunity view.');
  }
});

export const recordSkillSearch = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = uidOf(request);
    const role = roleOf(request);
    if (role !== 'business' && role !== 'administrator') throw new HttpsError('permission-denied', 'Only business users may record talent skill searches.');
    const skill = normalise(text(request.data?.skill, 'Skill', 80));
    const ref = db.collection('skill_demand').doc(skill);
    await ref.set({ skill, count: FieldValue.increment(1), lastSearchedAt: FieldValue.serverTimestamp(), lastSearchedBy: uid }, { merge: true });
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('recordSkillSearch failed', error);
    throw new HttpsError('internal', 'Unable to record skill demand.');
  }
});

export const recomputeOpportunityMatches = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const role = roleOf(request);
    if (role !== 'administrator') throw new HttpsError('permission-denied', 'Administrator role required.');
    const opportunityId = text(request.data?.opportunityId, 'Opportunity ID', 128);
    const matchedStudents = await matchApprovedOpportunity(opportunityId);
    return { ok: true, matchedStudents };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('recomputeOpportunityMatches failed', error);
    throw new HttpsError('internal', 'Unable to recompute opportunity matches.');
  }
});

export async function matchApprovedOpportunity(opportunityId: string): Promise<number> {
  const opportunitySnap = await db.collection('opportunities').doc(opportunityId).get();
  if (!opportunitySnap.exists) return 0;
  const opportunity = opportunitySnap.data()!;
  if (opportunity.status !== 'approved') return 0;
  const students = await db.collection('users').where('role', '==', 'student').where('isApproved', '==', true).limit(5000).get();
  let matched = 0;
  let batch = db.batch();
  let writes = 0;
  for (const studentDoc of students.docs) {
    const student = studentDoc.data();
    const cosine = skillSimilarity(Array.isArray(student.skills) ? student.skills : [], Array.isArray(opportunity.requiredSkills) ? opportunity.requiredSkills : []);
    const programme = programmeSimilarity(student, opportunity);
    const score = Math.min(1, cosine * 0.85 + programme * 0.15);
    if (score < 0.2) continue;
    const ref = db.collection('matches').doc(studentDoc.id).collection('opportunities').doc(opportunityId);
    batch.set(ref, { opportunityId, studentUid: studentDoc.id, score, matchedSkills: (Array.isArray(student.skills) ? student.skills : []).filter((skill) => (opportunity.requiredSkills ?? []).map(normalise).includes(normalise(String(skill)))), programmeMatch: programme === 1, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    matched += 1; writes += 1;
    if (writes >= 450) { await batch.commit(); batch = db.batch(); writes = 0; }
  }
  if (writes) await batch.commit();
  return matched;
}
