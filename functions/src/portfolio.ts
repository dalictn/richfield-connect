import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth as auth, adminDb as db } from './firebaseAdmin';
import { redactProfile, type ProfileRole } from './profileVisibility';
import { APP_CHECK_ENFORCEMENT } from './appCheck';

const REGION = 'africa-south1';
const ALLOWED_CAMPUS = new Set(['Durban', 'Johannesburg', 'Cape Town', 'Pretoria', 'Distance Learning']);
const VISIBILITY = new Set(['public', 'connections', 'private']);

function requireSignedIn(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}

function text(value: unknown, field: string, max: number, required = false): string {
  const result = String(value ?? '').trim();
  if (required && !result) throw new HttpsError('invalid-argument', `${field} is required.`);
  if (result.length > max) throw new HttpsError('invalid-argument', `${field} is too long.`);
  return result;
}

function normaliseSkills(value: unknown): string[] {
  if (!Array.isArray(value)) throw new HttpsError('invalid-argument', 'Skills must be an array.');
  const skills = Array.from(new Set(value.map((item) => text(item, 'Skill', 80)).filter(Boolean))).slice(0, 50);
  return skills;
}

function validateVisibility(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') throw new HttpsError('invalid-argument', 'Visibility settings are required.');
  const input = value as Record<string, unknown>;
  const output: Record<string, string> = {};
  for (const field of ['skills', 'experience', 'contactInfo', 'academicRecords']) {
    const level = String(input[field] ?? 'private');
    if (!VISIBILITY.has(level)) throw new HttpsError('invalid-argument', `Invalid visibility for ${field}.`);
    output[field] = level;
  }
  return output;
}

function validateQualifications(value: unknown): Array<{ title: string; institution: string; yearCompleted: number }> {
  if (!Array.isArray(value) || value.length > 20) throw new HttpsError('invalid-argument', 'Qualifications must contain at most 20 entries.');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new HttpsError('invalid-argument', 'Invalid qualification.');
    const row = item as Record<string, unknown>;
    const year = Number(row.yearCompleted);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 5) throw new HttpsError('invalid-argument', 'Invalid qualification year.');
    return {
      title: text(row.title, 'Qualification title', 160, true),
      institution: text(row.institution, 'Qualification institution', 160, true),
      yearCompleted: year,
    };
  });
}

function validateExperience(value: unknown): Array<{ company: string; role: string; startDate: string; endDate?: string; description: string }> {
  if (!Array.isArray(value) || value.length > 20) throw new HttpsError('invalid-argument', 'Work experience must contain at most 20 entries.');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new HttpsError('invalid-argument', 'Invalid work experience entry.');
    const row = item as Record<string, unknown>;
    return {
      company: text(row.company, 'Experience company', 160, true),
      role: text(row.role, 'Experience role', 160, true),
      startDate: text(row.startDate, 'Experience start date', 30, true),
      endDate: row.endDate ? text(row.endDate, 'Experience end date', 30) : undefined,
      description: text(row.description, 'Experience description', 1000, true),
    };
  });
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
      displayName: text(data.displayName, 'Display name', 120, true),
      headline: text(data.headline, 'Headline', 180),
      summary: text(data.summary, 'Summary', 2000),
      campusLocation,
      studentNumber: text(data.studentNumber, 'Student number', 60),
      companyName: text(data.companyName, 'Company name', 160),
      industry: text(data.industry, 'Industry', 120),
      skills: normaliseSkills(data.skills),
      qualifications: validateQualifications(data.qualifications),
      workExperience: validateExperience(data.workExperience),
      gitHubUrl: text(data.gitHubUrl, 'GitHub URL', 500),
      linkedInUrl: text(data.linkedInUrl, 'LinkedIn URL', 500),
      portfolioUrl: text(data.portfolioUrl, 'Portfolio URL', 500),
      avatarUrl: text(data.avatarUrl, 'Avatar URL', 1000),
      resumeUrl: text(data.resumeUrl, 'Resume URL', 1000),
      visibility: validateVisibility(data.visibility),
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
    await db.collection('users').doc(uid).set({ onboardingComplete: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
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
    const targetUid = text(request.data?.targetUid, 'Target user', 128, true);
    const targetSnap = await db.collection('users').doc(targetUid).get();
    if (!targetSnap.exists) throw new HttpsError('not-found', 'Profile not found.');
    const target = targetSnap.data() ?? {};
    if (targetUid === viewerUid || request.auth?.token?.role === 'administrator') return target;

    // A connections/{uid}/members/{viewerUid} document is only ever written when a
    // connection request is accepted, so its existence is the connection. Do not
    // additionally require a status field here: membership documents created
    // before that field existed would silently fail the check.
    const connectionSnap = await db.collection('connections').doc(targetUid).collection('members').doc(viewerUid).get();
    const viewerRole = String(request.auth?.token?.role ?? 'student') as ProfileRole;
    return redactProfile(target, { role: viewerRole, connected: connectionSnap.exists });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('getVisibleProfile failed', error);
    throw new HttpsError('internal', 'Unable to load visible profile.');
  }
});

export const endorseSkill = onCall({ ...APP_CHECK_ENFORCEMENT, region: REGION }, async (request) => {
  try {
    const uid = requireSignedIn(request);
    const targetUid = text(request.data?.targetUid, 'Target user', 128, true);
    const skill = text(request.data?.skill, 'Skill', 80, true).toLowerCase();
    if (targetUid === uid) throw new HttpsError('failed-precondition', 'You cannot endorse your own skill.');

    const targetRef = db.collection('users').doc(targetUid);
    const [targetSnap, actorSnap] = await Promise.all([targetRef.get(), db.collection('users').doc(uid).get()]);
    if (!targetSnap.exists || !actorSnap.exists) throw new HttpsError('not-found', 'Profile not found.');
    const target = targetSnap.data() ?? {};
    const actor = actorSnap.data() ?? {};
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
    console.info('Skill endorsed', { actorUid: uid, targetUid, actorRole: actor.role, skill });
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
    if (requestedUid !== callerUid && request.auth?.token?.role !== 'administrator') {
      throw new HttpsError('permission-denied', 'You may only evaluate your own profile.');
    }
    const snapshot = await db.collection('users').doc(requestedUid).get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'Profile not found.');
    const profile = snapshot.data() ?? {};
    const checks: Array<[string, boolean]> = [
      ['Professional headline', Boolean(String(profile.headline ?? '').trim())],
      ['Professional summary', String(profile.summary ?? '').trim().length >= 100],
      ['Profile photograph', Boolean(String(profile.avatarUrl ?? '').trim())],
      ['Skills', Array.isArray(profile.skills) && profile.skills.length >= 3],
      ['Qualifications', Array.isArray(profile.qualifications) && profile.qualifications.length > 0],
      ['Work experience', Array.isArray(profile.workExperience) && profile.workExperience.length > 0],
      ['GitHub or portfolio', Boolean(profile.gitHubUrl || profile.portfolioUrl)],
      ['LinkedIn profile', Boolean(profile.linkedInUrl)],
      ['Career direction', String(profile.headline ?? '').trim().length >= 12],
      ['Campus information', Boolean(profile.campusLocation)],
    ];
    const completed = checks.filter(([, ok]) => ok).length;
    const score = Math.round((completed / checks.length) * 100);
    const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);
    const strengths = checks.filter(([, ok]) => ok).map(([label]) => label).slice(0, 5);
    const suggestions = missing.slice(0, 5).map((item) => `Add ${item.toLowerCase()} to improve employer discoverability.`);
    return { score, missing, strengths, suggestions };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('evaluateProfileCompleteness failed', error);
    throw new HttpsError('internal', 'Unable to evaluate profile completeness.');
  }
});
