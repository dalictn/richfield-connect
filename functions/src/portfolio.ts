import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb as db } from './firebaseAdmin';
import {
  redactProfile,
  normaliseVisibility,
  defaultVisibility,
  canSeeSection,
  type ProfileRole,
  type Viewer,
} from './profileVisibility';
import { APP_CHECK_ENFORCEMENT } from './appCheck';
import * as schema from './portfolioSchema';

const REGION = 'africa-south1';
const ALLOWED_CAMPUS = new Set(['Durban', 'Johannesburg', 'Cape Town', 'Pretoria', 'Distance Learning']);
const RECOMMENDATION_MAX = 2000;
const RECOMMENDATION_LIMIT = 100;

function requireSignedIn(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}

function roleOf(request: { auth?: { token?: Record<string, unknown> } | null }): ProfileRole {
  const role = String(request.auth?.token?.role ?? '');
  return (['student', 'alumni', 'business', 'administrator'].includes(role) ? role : 'student') as ProfileRole;
}

async function areConnected(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const snap = await db.collection('connections').doc(a).collection('members').doc(b).get();
  return snap.exists;
}

async function readRecommendations(uid: string) {
  const snap = await db.collection('users').doc(uid).collection('recommendations')
    .orderBy('createdAt', 'desc').limit(RECOMMENDATION_LIMIT).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export const upsertPortfolioProfile = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = requireSignedIn(request);
    const snapshot = await db.collection('users').doc(uid).get();
    if (!snapshot.exists) throw new HttpsError('failed-precondition', 'User profile is not provisioned.');
    const existing = snapshot.data() ?? {};
    const data = (request.data ?? {}) as Record<string, unknown>;

    const campusLocation = String(data.campusLocation ?? existing.campusLocation ?? 'Distance Learning');
    if (!ALLOWED_CAMPUS.has(campusLocation)) throw new HttpsError('invalid-argument', 'Invalid campus location.');

    const patch = {
      displayName: schema.text(data.displayName, 'Display name', 120, true),
      headline: schema.text(data.headline, 'Headline', 180),
      summary: schema.text(data.summary, 'Summary', 2000),
      campusLocation,
      studentNumber: schema.text(data.studentNumber, 'Student number', 60),

      // Programme drives opportunity matching, the peer-comparison analytics and
      // the alumni pathway view, so it is a first-class field rather than free text.
      programmeOfStudy: schema.text(data.programmeOfStudy, 'Programme of study', 160),
      fieldOfWork: schema.text(data.fieldOfWork, 'Field of work', 160),
      yearOfEnrolment: schema.year(data.yearOfEnrolment, 'Year of enrolment', false) ?? null,
      graduationYear: schema.year(data.graduationYear, 'Graduation year', false) ?? null,

      skills: schema.stringList(data.skills, 'Skills'),
      qualifications: schema.qualifications(data.qualifications),
      certifications: schema.certifications(data.certifications),
      workExperience: schema.workExperience(data.workExperience),
      entrepreneurialExperience: schema.ventures(data.entrepreneurialExperience),
      gitHubProjects: schema.projects(data.gitHubProjects, 'GitHub project'),
      deployedProjects: schema.projects(data.deployedProjects, 'Deployed project'),
      digitalBadges: schema.badges(data.digitalBadges),
      achievements: schema.achievements(data.achievements),
      leadershipRoles: schema.leadershipRoles(data.leadershipRoles),
      activities: schema.activities(data.activities),
      careerInterests: schema.stringList(data.careerInterests, 'Career interests', 20, 80),
      careerAspirations: schema.text(data.careerAspirations, 'Career aspirations', 1000),

      gitHubUrl: schema.optionalUrl(data.gitHubUrl, 'GitHub URL'),
      linkedInUrl: schema.optionalUrl(data.linkedInUrl, 'LinkedIn URL'),
      portfolioUrl: schema.optionalUrl(data.portfolioUrl, 'Portfolio URL'),
      credlyUrl: schema.optionalUrl(data.credlyUrl, 'Credly URL'),
      avatarUrl: schema.text(data.avatarUrl, 'Avatar URL', 1000),
      resumeUrl: schema.text(data.resumeUrl, 'Resume URL', 1000),

      companyName: schema.text(data.companyName, 'Company name', 160),
      industry: schema.text(data.industry, 'Industry', 120),
      companyDescription: schema.text(data.companyDescription, 'Company description', 2000),
      companyLocation: schema.text(data.companyLocation, 'Company location', 200),
      companyWebsite: schema.optionalUrl(data.companyWebsite, 'Company website'),
      talentSought: schema.text(data.talentSought, 'Talent sought', 1000),

      visibility: data.visibility === undefined
        ? normaliseVisibility(existing.visibility ?? defaultVisibility())
        : normaliseVisibility(data.visibility),
    };

    await db.collection('users').doc(uid).set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('upsertPortfolioProfile failed', error);
    throw new HttpsError('internal', 'Unable to save portfolio profile.');
  }
});

export const completeOnboarding = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = requireSignedIn(request);
    const snap = await db.collection('users').doc(uid).get();
    const patch: Record<string, unknown> = { onboardingComplete: true, updatedAt: FieldValue.serverTimestamp() };
    // A profile that has never chosen visibility gets the safe default rather
    // than an empty map, which would read as fully private.
    if (!snap.data()?.visibility) patch.visibility = defaultVisibility();
    await db.collection('users').doc(uid).set(patch, { merge: true });
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('completeOnboarding failed', error);
    throw new HttpsError('internal', 'Unable to complete onboarding.');
  }
});

export const getVisibleProfile = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const viewerUid = requireSignedIn(request);
    const targetUid = schema.text(request.data?.targetUid, 'Target user', 128, true);
    const targetSnap = await db.collection('users').doc(targetUid).get();
    if (!targetSnap.exists) throw new HttpsError('not-found', 'Profile not found.');
    const target = targetSnap.data() ?? {};

    if (targetUid === viewerUid || roleOf(request) === 'administrator') {
      return { ...target, recommendations: await readRecommendations(targetUid), isSelf: targetUid === viewerUid };
    }

    const viewer: Viewer = { role: roleOf(request), connected: await areConnected(targetUid, viewerUid) };
    const visible = redactProfile(target, viewer);
    const recommendations = canSeeSection(target, 'recommendations', viewer)
      ? await readRecommendations(targetUid)
      : [];
    return { ...visible, recommendations, isSelf: false, connected: viewer.connected };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('getVisibleProfile failed', error);
    throw new HttpsError('internal', 'Unable to load visible profile.');
  }
});

/**
 * Written recommendations and testimonials.
 *
 * The document id is the author's uid, so one member leaves at most one
 * recommendation per person and re-submitting edits it rather than stacking
 * duplicates. Author identity is captured server-side from the author's own
 * profile, never from the request, so a recommendation cannot be attributed to
 * someone else.
 */
export const writeRecommendation = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const authorUid = requireSignedIn(request);
    const authorRole = roleOf(request);
    const targetUid = schema.text(request.data?.targetUid, 'Target user', 128, true);
    const relationship = schema.text(request.data?.relationship, 'Relationship', 60, true);
    const body = schema.text(request.data?.body, 'Recommendation', RECOMMENDATION_MAX, true);
    if (body.length < 40) throw new HttpsError('invalid-argument', 'A recommendation must be at least 40 characters.');
    if (targetUid === authorUid) throw new HttpsError('failed-precondition', 'You cannot recommend yourself.');

    const [targetSnap, authorSnap] = await Promise.all([
      db.collection('users').doc(targetUid).get(),
      db.collection('users').doc(authorUid).get(),
    ]);
    if (!targetSnap.exists || !authorSnap.exists) throw new HttpsError('not-found', 'Profile not found.');

    // Anyone who actually knows the person may vouch for them: a connection, or
    // one of the roles the brief names (alumni, employers, staff).
    const connected = await areConnected(targetUid, authorUid);
    const privilegedRole = authorRole === 'alumni' || authorRole === 'business' || authorRole === 'administrator';
    if (!connected && !privilegedRole) {
      throw new HttpsError('permission-denied', 'Connect with this member before recommending them.');
    }

    const author = authorSnap.data() ?? {};
    const ref = db.collection('users').doc(targetUid).collection('recommendations').doc(authorUid);
    const existing = await ref.get();
    const now = Date.now();

    await ref.set({
      authorUid,
      authorName: String(author.displayName ?? 'Richfield member'),
      authorHeadline: String(author.headline ?? ''),
      authorRole,
      relationship,
      body,
      createdAt: existing.exists ? (existing.data()?.createdAt ?? now) : now,
      updatedAt: now,
    });

    return { ok: true, updated: existing.exists };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('writeRecommendation failed', error);
    throw new HttpsError('internal', 'Unable to save this recommendation.');
  }
});

/** Either party can remove a recommendation: its author, or its subject. */
export const removeRecommendation = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = requireSignedIn(request);
    const targetUid = schema.text(request.data?.targetUid, 'Target user', 128, true);
    const authorUid = schema.text(request.data?.authorUid, 'Author', 128, true);
    if (uid !== targetUid && uid !== authorUid && roleOf(request) !== 'administrator') {
      throw new HttpsError('permission-denied', 'You cannot remove this recommendation.');
    }
    await db.collection('users').doc(targetUid).collection('recommendations').doc(authorUid).delete();
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('removeRecommendation failed', error);
    throw new HttpsError('internal', 'Unable to remove this recommendation.');
  }
});

export const endorseSkill = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = requireSignedIn(request);
    const targetUid = schema.text(request.data?.targetUid, 'Target user', 128, true);
    const skill = schema.text(request.data?.skill, 'Skill', 80, true).toLowerCase();
    if (targetUid === uid) throw new HttpsError('failed-precondition', 'You cannot endorse your own skill.');

    const targetRef = db.collection('users').doc(targetUid);
    const [targetSnap, actorSnap] = await Promise.all([targetRef.get(), db.collection('users').doc(uid).get()]);
    if (!targetSnap.exists || !actorSnap.exists) throw new HttpsError('not-found', 'Profile not found.');
    const target = targetSnap.data() ?? {};
    if (!Array.isArray(target.skills) || !target.skills.map(String).some((item) => item.toLowerCase() === skill)) {
      throw new HttpsError('failed-precondition', 'That skill is not displayed on the target profile.');
    }
    const endorsements = Array.isArray(target.endorsements) ? target.endorsements : [];
    if (endorsements.some((item) => item.endorsedBy === uid && String(item.skill).toLowerCase() === skill)) {
      return { ok: true, alreadyEndorsed: true };
    }
    if (endorsements.length >= 500) throw new HttpsError('resource-exhausted', 'This profile has reached its endorsement limit.');

    endorsements.push({ skill, endorsedBy: uid, timestamp: Date.now() });
    await targetRef.update({ endorsements, updatedAt: Timestamp.now() });
    return { ok: true, alreadyEndorsed: false };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('endorseSkill failed', error);
    throw new HttpsError('internal', 'Unable to record endorsement.');
  }
});

export const evaluateProfileCompleteness = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const callerUid = requireSignedIn(request);
    const requestedUid = String(request.data?.uid ?? callerUid);
    if (requestedUid !== callerUid && roleOf(request) !== 'administrator') {
      throw new HttpsError('permission-denied', 'You may only evaluate your own profile.');
    }
    const snapshot = await db.collection('users').doc(requestedUid).get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'Profile not found.');
    const profile = snapshot.data() ?? {};
    const list = (key: string) => (Array.isArray(profile[key]) ? (profile[key] as unknown[]) : []);

    const checks: Array<[string, boolean]> = [
      ['Professional headline', Boolean(String(profile.headline ?? '').trim())],
      ['Professional summary', String(profile.summary ?? '').trim().length >= 100],
      ['Profile photograph', Boolean(String(profile.avatarUrl ?? '').trim())],
      ['Programme or field of work', Boolean(String(profile.programmeOfStudy ?? profile.fieldOfWork ?? '').trim())],
      ['Campus information', Boolean(profile.campusLocation)],
      ['Skills', list('skills').length >= 3],
      ['Qualifications', list('qualifications').length > 0],
      ['Professional certifications', list('certifications').length > 0],
      ['Work experience', list('workExperience').length > 0],
      ['Entrepreneurial experience', list('entrepreneurialExperience').length > 0],
      ['GitHub project portfolio', list('gitHubProjects').length > 0],
      ['Deployed applications', list('deployedProjects').length > 0],
      ['Digital badges', list('digitalBadges').length > 0 || Boolean(profile.credlyUrl)],
      ['Achievements and awards', list('achievements').length > 0],
      ['Leadership roles', list('leadershipRoles').length > 0],
      ['Clubs and activities', list('activities').length > 0],
      ['Career interests', list('careerInterests').length > 0],
      ['GitHub or portfolio link', Boolean(profile.gitHubUrl || profile.portfolioUrl)],
      ['LinkedIn profile', Boolean(profile.linkedInUrl)],
    ];

    const completed = checks.filter(([, ok]) => ok).length;
    const score = Math.round((completed / checks.length) * 100);
    const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);
    const strengths = checks.filter(([, ok]) => ok).map(([label]) => label).slice(0, 6);
    const suggestions = missing.slice(0, 5).map((item) => `Add ${item.toLowerCase()} — profiles with it are far more discoverable to employers.`);
    return { score, missing, strengths, suggestions };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('evaluateProfileCompleteness failed', error);
    throw new HttpsError('internal', 'Unable to evaluate profile completeness.');
  }
});
