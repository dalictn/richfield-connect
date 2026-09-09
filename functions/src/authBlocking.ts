import { HttpsError } from 'firebase-functions/v2/https';
import { beforeUserCreated as registerBeforeUserCreated } from 'firebase-functions/v2/identity';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb as db } from './firebaseAdmin';
import { createHash } from 'node:crypto';
import { isStudentEmail, normalizeEmail } from './institutionalDomains';

const INTENT_COLLECTION = 'registration_intents';

function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

/**
 * Firebase Authentication blocking trigger.
 *
 * The mobile UI is never trusted to classify a registration. Student accounts
 * are only permitted when the Auth email itself belongs to an approved
 * Richfield/AAA institutional domain. Non-institutional accounts can only be
 * created when a short-lived server-issued registration intent exists. This
 * allows the business/alumni flows to coexist with a hard server-side student
 * domain boundary.
 */
export const beforeUserCreated = beforeUserCreatedTrigger();

function beforeUserCreatedTrigger() {
  return registerBeforeUserCreated(async (event) => {
    try {
      const email = normalizeEmail(event.data?.email ?? '');

      if (!email) {
        throw new HttpsError('invalid-argument', 'A valid email address is required.');
      }

      if (isStudentEmail(email)) {
        return {
          customClaims: {},
        };
      }

      const intentRef = db.collection(INTENT_COLLECTION).doc(hashEmail(email));
      const intentSnap = await intentRef.get();

      if (!intentSnap.exists) {
        throw new HttpsError(
          'permission-denied',
          'This email is not eligible for self-service account creation.',
        );
      }

      const intent = intentSnap.data();
      const expiresAt = intent?.expiresAt as Timestamp | undefined;
      const consumed = intent?.consumed === true;
      const intentRole = intent?.role;

      if (
        consumed ||
        !expiresAt ||
        expiresAt.toMillis() <= Date.now() ||
        !['alumni', 'business'].includes(intentRole)
      ) {
        throw new HttpsError(
          'permission-denied',
          'This registration session is invalid or expired.',
        );
      }

      return {
        customClaims: {},
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('beforeUserCreated failed', error);
      throw new HttpsError('internal', 'Unable to validate account registration.');
    }
  });
}
