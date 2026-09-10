import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth as auth, adminDb as db } from './firebaseAdmin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
import { beforeUserCreated } from './authBlocking';
import { isStudentEmail, normalizeEmail } from './institutionalDomains';
import {
  finalizeAlumniRegistration,
  verifyAlumniCredentials,
} from './alumniVerification';
import { APP_CHECK_ENFORCEMENT } from './appCheck';

export { beforeUserCreated, verifyAlumniCredentials, finalizeAlumniRegistration };
export { upsertPortfolioProfile, endorseSkill, evaluateProfileCompleteness, completeOnboarding, getVisibleProfile, writeRecommendation, removeRecommendation } from './portfolio';
export { extractCvProfile } from './cvExtraction';
export { profileAssistant } from './profileAssistant';
export { searchDirectory } from './directory';

const REGISTRATION_INTENTS = 'registration_intents';
const INTENT_TTL_MS = 15 * 60 * 1000;

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireSignedIn(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  return request.auth.uid;
}

function requireAdministrator(request: {
  auth?: { token?: Record<string, unknown>; uid?: string | null } | null;
}): string {
  const uid = requireSignedIn(request);
  if (request.auth?.token?.role !== 'administrator') {
    throw new HttpsError('permission-denied', 'Administrator role required.');
  }
  return uid;
}

function emailHash(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

export const createBusinessRegistrationIntent = onCall(
  { ...APP_CHECK_ENFORCEMENT, region: 'africa-south1' },
  async (request) => {
    try {
      const email = normalizeEmail(String(request.data?.email ?? ''));
      if (!validEmail(email)) {
        throw new HttpsError('invalid-argument', 'A valid email address is required.');
      }
      if (isStudentEmail(email)) {
        throw new HttpsError('failed-precondition', 'Institutional accounts must use student registration.');
      }

      const expiresAt = Timestamp.fromMillis(Date.now() + INTENT_TTL_MS);
      await db.collection(REGISTRATION_INTENTS).doc(emailHash(email)).set({
        role: 'business',
        email,
        expiresAt,
        consumed: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('createBusinessRegistrationIntent failed', error);
      throw new HttpsError('internal', 'Unable to create registration session.');
    }
  },
);

export const finalizeStudentRegistration = onCall(
  { ...APP_CHECK_ENFORCEMENT, region: 'africa-south1' },
  async (request) => {
    try {
      const uid = requireSignedIn(request);
      const record = await auth.getUser(uid);
      const email = normalizeEmail(record.email ?? '');
      const displayName = String(request.data?.displayName ?? '').trim();

      if (!isStudentEmail(email)) {
        await auth.deleteUser(uid);
        throw new HttpsError('permission-denied', 'Only Richfield institutional domains may register as students.');
      }
      if (!displayName || displayName.length > 120) {
        throw new HttpsError('invalid-argument', 'A valid display name is required.');
      }

      await auth.setCustomUserClaims(uid, { role: 'student', isApproved: true, accountStatus: 'active' });
      await db.collection('users').doc(uid).set(
        {
          uid,
          role: 'student',
          email,
          displayName,
          isApproved: true,
          accountStatus: 'active',
          emailVerified: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('finalizeStudentRegistration failed', error);
      throw new HttpsError('internal', 'Unable to finalize student registration.');
    }
  },
);

export const finalizeBusinessRegistration = onCall(
  { ...APP_CHECK_ENFORCEMENT, region: 'africa-south1' },
  async (request) => {
    try {
      const uid = requireSignedIn(request);
      const record = await auth.getUser(uid);
      const email = normalizeEmail(record.email ?? '');
      const data = (request.data ?? {}) as Record<string, unknown>;

      if (!validEmail(email)) throw new HttpsError('failed-precondition', 'Authenticated email is invalid.');

      const required = ['companyName', 'industry', 'description', 'location', 'website', 'contactName', 'contactPhone'];
      for (const field of required) {
        const value = String(data[field] ?? '').trim();
        if (!value || value.length > 500) {
          throw new HttpsError('invalid-argument', `${field} is required and must be valid.`);
        }
      }

      const intentRef = db.collection(REGISTRATION_INTENTS).doc(emailHash(email));
      const intentSnap = await intentRef.get();
      const intent = intentSnap.data();
      const expiresAt = intent?.expiresAt as Timestamp | undefined;

      if (
        !intentSnap.exists ||
        intent?.role !== 'business' ||
        intent?.consumed === true ||
        !expiresAt ||
        expiresAt.toMillis() <= Date.now()
      ) {
        throw new HttpsError('permission-denied', 'The business registration session is invalid or expired.');
      }

      await auth.setCustomUserClaims(uid, { role: 'business', isApproved: false, accountStatus: 'active' });
      await db.runTransaction(async (transaction) => {
        transaction.set(
          db.collection('users').doc(uid),
          {
            uid,
            role: 'business',
            email,
            displayName: String(data.contactName).trim(),
            companyName: String(data.companyName).trim(),
            industry: String(data.industry).trim(),
            companyDescription: String(data.description).trim(),
            companyLocation: String(data.location).trim(),
            companyWebsite: String(data.website).trim(),
            contactName: String(data.contactName).trim(),
            contactPhone: String(data.contactPhone).trim(),
            isApproved: false,
            accountStatus: 'active',
            emailVerified: record.emailVerified,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        transaction.update(intentRef, { consumed: true, consumedAt: FieldValue.serverTimestamp() });
      });

      return { ok: true, isApproved: false };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('finalizeBusinessRegistration failed', error);
      throw new HttpsError('internal', 'Unable to finalize business registration.');
    }
  },
);

export const approveBusinessUser = onCall(
  { ...APP_CHECK_ENFORCEMENT, region: 'africa-south1' },
  async (request) => {
    try {
      requireAdministrator(request);
      const uid = String(request.data?.uid ?? '');
      if (!uid) throw new HttpsError('invalid-argument', 'Business user UID is required.');

      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Business user profile not found.');
      if (snap.data()?.role !== 'business') throw new HttpsError('failed-precondition', 'Target user is not a business user.');

      const accountStatus = String(snap.data()?.accountStatus ?? 'active');
      if (accountStatus !== 'active') {
        throw new HttpsError('failed-precondition', 'Reactivate the account before approving it.');
      }

      await userRef.update({ isApproved: true, accountStatus, updatedAt: FieldValue.serverTimestamp() });
      await auth.setCustomUserClaims(uid, { role: 'business', isApproved: true, accountStatus });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('approveBusinessUser failed', error);
      throw new HttpsError('internal', 'Unable to approve business user.');
    }
  },
);
export {
  createConnectionRequest,
  respondToConnectionRequest,
  createPost,
  reactToPost,
  commentOnPost,
  sendDirectMessage,
  recomputeFeedScore,
  deleteOwnPost,
} from './social';
export { processUploadedVideo } from './videoProcessing';

export { createOpportunity, reviewOpportunity, applyToOpportunity, recordOpportunityView, recordSkillSearch, recomputeOpportunityMatches } from './opportunities';
export { registerFcmToken, createAnnouncement, notifyConnectionRequest, notifyConnectionAccepted, notifyDirectMessage, notifyOpportunityMatches, notifyAnnouncement, matchOnOpportunityApproval } from './notifications';
export { recordUserActivity, recordProfileView, getStudentAnalytics, getBusinessAnalytics, getAdminAnalytics, updateRegistrationAnalytics, updateOpportunityAnalytics } from './analytics';
export { manageUserStatus, moderateContent, reportContent, broadcastAnnouncement, listAdminUsers, listModerationQueue } from './admin';
