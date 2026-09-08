import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth as auth, adminDb as db } from './firebaseAdmin';
import { createHash, randomBytes } from 'node:crypto';

const REGISTRY = 'alumni_registry';
const SESSIONS = 'alumni_verification_sessions';
const INTENTS = 'registration_intents';
const RATE_LIMITS = 'auth_rate_limits';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_KEY = 5;
const SESSION_TTL_MS = 15 * 60 * 1000;

interface AlumniInput {
  personalEmail: string;
  studentNumber: string;
  nationalId?: string;
  birthdate?: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStudentNumber(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function normalizeNationalId(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

function normalizeBirthdate(value: string): string {
  return value.trim();
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requestKey(input: AlumniInput): string {
  return digest(
    [
      normalizeEmail(input.personalEmail),
      normalizeStudentNumber(input.studentNumber),
      normalizeNationalId(input.nationalId ?? ''),
      normalizeBirthdate(input.birthdate ?? ''),
    ].join('|'),
  );
}

function genericResponse() {
  return {
    accepted: true,
    message:
      'If the supplied details match an eligible alumni record, a verification email will be sent shortly.',
  };
}

async function consumeRateLimit(key: string): Promise<void> {
  const ref = db.collection(RATE_LIMITS).doc(`alumni-${key}`);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists ? snap.data() : undefined;
    const windowStartedAt = Number(current?.windowStartedAt ?? now);
    const attempts = Number(current?.attempts ?? 0);

    if (now - windowStartedAt >= WINDOW_MS) {
      transaction.set(ref, { windowStartedAt: now, attempts: 1 }, { merge: true });
      return;
    }

    if (attempts >= MAX_ATTEMPTS_PER_KEY) {
      throw new HttpsError(
        'resource-exhausted',
        'Too many verification attempts. Please wait and try again.',
      );
    }

    transaction.set(ref, { windowStartedAt, attempts: attempts + 1 }, { merge: true });
  });
}

function assertInput(data: unknown): AlumniInput {
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Verification details are required.');
  }

  const value = data as Record<string, unknown>;
  const personalEmail = String(value.personalEmail ?? '');
  const studentNumber = String(value.studentNumber ?? '');
  const nationalId = value.nationalId == null ? undefined : String(value.nationalId);
  const birthdate = value.birthdate == null ? undefined : String(value.birthdate);

  if (!personalEmail || !studentNumber) {
    throw new HttpsError('invalid-argument', 'Personal email and student number are required.');
  }

  if (!/^\S+@\S+\.\S+$/.test(personalEmail)) {
    throw new HttpsError('invalid-argument', 'Enter a valid personal email address.');
  }

  if (!nationalId && !birthdate) {
    throw new HttpsError('invalid-argument', 'National ID or birthdate is required.');
  }

  return { personalEmail, studentNumber, nationalId, birthdate };
}

/**
 * Secure alumni verification endpoint.
 *
 * It never returns registry data, never exposes the registry document ID, and
 * uses the same public response for matched and unmatched records. Matching is
 * performed server-side against the private alumni registry.
 */
export const verifyAlumniCredentials = onCall(
  {
    enforceAppCheck: true,
    consumeAppCheckToken: true,
    region: 'africa-south1',
  },
  async (request) => {
    try {
      const input = assertInput(request.data);
      const email = normalizeEmail(input.personalEmail);
      const studentNumber = normalizeStudentNumber(input.studentNumber);
      const nationalId = normalizeNationalId(input.nationalId ?? '');
      const birthdate = normalizeBirthdate(input.birthdate ?? '');

      await consumeRateLimit(requestKey(input));
      await consumeRateLimit(`email-${digest(email)}`);
      const rawRequest = request.rawRequest as { ip?: string; headers?: Record<string, string | string[] | undefined> } | undefined;
      const forwarded = rawRequest?.headers?.['x-forwarded-for'];
      const ip = rawRequest?.ip ?? (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim());
      if (ip) await consumeRateLimit(`ip-${digest(ip)}`);

      let match = null as FirebaseFirestore.QueryDocumentSnapshot | null;

      const candidateSnapshot = await db
        .collection(REGISTRY)
        .where('studentNumber', '==', studentNumber)
        .limit(5)
        .get();

      for (const candidate of candidateSnapshot.docs) {
        const data = candidate.data();
        const registryEmail = normalizeEmail(String(data.personalEmail ?? ''));
        const registryNationalId = normalizeNationalId(String(data.nationalId ?? ''));
        const registryBirthdate = normalizeBirthdate(String(data.birthdate ?? ''));

        const identityMatch =
          registryEmail === email &&
          ((nationalId && registryNationalId === nationalId) ||
            (birthdate && registryBirthdate === birthdate));

        if (identityMatch) {
          match = candidate;
          break;
        }
      }

      if (!match) {
        // Intentionally indistinguishable from a successful lookup.
        return genericResponse();
      }

      const sessionId = randomBytes(32).toString('base64url');
      const sessionHash = digest(sessionId);
      const expiresAt = Timestamp.fromMillis(Date.now() + SESSION_TTL_MS);

      await db.runTransaction(async (transaction) => {
        const sessionRef = db.collection(SESSIONS).doc(sessionHash);
        const intentRef = db.collection(INTENTS).doc(digest(email));

        transaction.set(sessionRef, {
          sessionHash,
          personalEmail: email,
          registryId: match!.id,
          expiresAt,
          consumed: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        transaction.set(
          intentRef,
          {
            role: 'alumni',
            email,
            expiresAt,
            consumed: false,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });

      return {
        ...genericResponse(),
        verificationSession: sessionId,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('verifyAlumniCredentials failed', error);
      throw new HttpsError('internal', 'Unable to process alumni verification.');
    }
  },
);

export const finalizeAlumniRegistration = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: true, region: 'africa-south1' },
  async (request) => {
    try {
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Authentication is required.');
      }

      const sessionId = String(request.data?.verificationSession ?? '');
      if (!sessionId) {
        throw new HttpsError('invalid-argument', 'Verification session is required.');
      }

      const sessionHash = digest(sessionId);
      const sessionRef = db.collection(SESSIONS).doc(sessionHash);
      const authRecord = await auth.getUser(request.auth.uid);
      const authEmail = normalizeEmail(authRecord.email ?? '');

      await db.runTransaction(async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists) {
          throw new HttpsError('not-found', 'Verification session is invalid or expired.');
        }

        const session = sessionSnap.data()!;
        const expiresAt = session.expiresAt as Timestamp;

        if (
          session.consumed === true ||
          !expiresAt ||
          expiresAt.toMillis() <= Date.now() ||
          session.personalEmail !== authEmail
        ) {
          throw new HttpsError('permission-denied', 'Verification session is invalid or expired.');
        }

        const registryRef = db.collection(REGISTRY).doc(String(session.registryId));
        const registrySnap = await transaction.get(registryRef);
        if (!registrySnap.exists) {
          throw new HttpsError('failed-precondition', 'Alumni record is no longer available.');
        }

        const registry = registrySnap.data()!;
        const userRef = db.collection('users').doc(request.auth!.uid);
        const intentRef = db.collection(INTENTS).doc(digest(authEmail));

        transaction.set(
          userRef,
          {
            uid: request.auth!.uid,
            role: 'alumni',
            email: authEmail,
            displayName: String(registry.fullName ?? ''),
            studentNumber: String(registry.studentNumber ?? ''),
            isApproved: true,
            emailVerified: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        transaction.update(sessionRef, {
          consumed: true,
          consumedByUid: request.auth!.uid,
          consumedAt: FieldValue.serverTimestamp(),
        });

        transaction.set(intentRef, { consumed: true }, { merge: true });
      });

      await auth.setCustomUserClaims(request.auth.uid, {
        role: 'alumni',
        isApproved: true,
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('finalizeAlumniRegistration failed', error);
      throw new HttpsError('internal', 'Unable to finalize alumni registration.');
    }
  },
);
