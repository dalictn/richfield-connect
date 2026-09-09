import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb as db } from './firebaseAdmin';
import { redactDirectoryCard, type ProfileRole } from './profileVisibility';
import { APP_CHECK_ENFORCEMENT } from './appCheck';

const REGION = 'africa-south1';
const ROLES = new Set(['student', 'alumni', 'business', 'administrator']);
const SEARCHABLE_ROLES = new Set(['student', 'alumni', 'business']);

/** How many documents we are willing to scan to satisfy one search. */
const SCAN_LIMIT = 300;
/** How many cards we return. */
const PAGE_SIZE = 30;

type ConnectionState = 'self' | 'connected' | 'outgoing_pending' | 'incoming_pending' | 'none';

function requireActiveMember(request: {
  auth?: { uid?: string | null; token?: Record<string, unknown> } | null;
}): { uid: string; role: string } {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const token = request.auth?.token ?? {};
  const role = String(token.role ?? '');
  if (!ROLES.has(role)) throw new HttpsError('permission-denied', 'A valid platform role is required.');
  if (role === 'business' && token.isApproved !== true) {
    throw new HttpsError('permission-denied', 'Business account approval is required.');
  }
  if (token.accountStatus === 'suspended' || token.accountStatus === 'revoked') {
    throw new HttpsError('permission-denied', 'This account is not active.');
  }
  return { uid, role };
}

function text(value: unknown, max: number): string {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new HttpsError('invalid-argument', 'Search input is too long.');
  return result;
}

function normalise(value: unknown): string {
  return String(value ?? '').toLowerCase();
}

/**
 * Loads the caller's connection graph once so each result can be labelled in
 * constant time. Doing this per result would cost one read per row.
 */
async function connectionIndex(uid: string) {
  const [members, outgoing, incoming] = await Promise.all([
    db.collection('connections').doc(uid).collection('members').limit(1000).get(),
    db.collection('connection_requests').where('fromUid', '==', uid).where('status', '==', 'pending').limit(500).get(),
    db.collection('connection_requests').where('toUid', '==', uid).where('status', '==', 'pending').limit(500).get(),
  ]);
  return {
    connected: new Set(members.docs.map((doc) => doc.id)),
    outgoing: new Set(outgoing.docs.map((doc) => String(doc.data().toUid ?? ''))),
    incoming: new Map(incoming.docs.map((doc) => [String(doc.data().fromUid ?? ''), doc.id])),
  };
}

function isVisibleAccount(data: Record<string, unknown>, viewerRole: string): boolean {
  if (data.accountStatus === 'suspended' || data.accountStatus === 'revoked') return false;
  if (data.moderationRestricted === true) return false;
  const role = String(data.role ?? '');
  // Business accounts awaiting approval are not part of the network yet.
  if (role === 'business' && data.isApproved !== true) return false;
  // Staff accounts are not a networking target; administrators can still see
  // each other so the console remains usable.
  if (role === 'administrator' && viewerRole !== 'administrator') return false;
  return SEARCHABLE_ROLES.has(role) || viewerRole === 'administrator';
}

function matchesText(data: Record<string, unknown>, terms: string[]): boolean {
  if (!terms.length) return true;
  const haystack = [
    normalise(data.displayName),
    normalise(data.headline),
    normalise(data.companyName),
    normalise(data.industry),
    normalise(data.campusLocation),
    Array.isArray(data.skills) ? data.skills.map(normalise).join(' ') : '',
  ].join(' ');
  return terms.every((term) => haystack.includes(term));
}

/**
 * Member directory.
 *
 * Firestore rules deny reading other users' documents, so discovery has to be a
 * callable. This is also the only place that can apply per-field visibility
 * before data leaves the server.
 *
 * Text matching is done in memory over a bounded scan rather than in Firestore,
 * because Firestore has no case-insensitive substring index. Role and skill
 * filters are real indexed queries, so they narrow the scan before it happens.
 * At institutional scale this would need a dedicated search index; it is
 * deliberately simple and bounded here.
 */
export const searchDirectory = onCall(
  { region: REGION, ...APP_CHECK_ENFORCEMENT, },
  async (request) => {
    const { uid, role: viewerRole } = requireActiveMember(request);
    try {
      const term = text(request.data?.query, 100);
      const skill = normalise(text(request.data?.skill, 80));
      const roleFilter = text(request.data?.role, 20);
      if (roleFilter && !SEARCHABLE_ROLES.has(roleFilter)) {
        throw new HttpsError('invalid-argument', 'Unsupported role filter.');
      }

      let query = db.collection('users').limit(SCAN_LIMIT) as FirebaseFirestore.Query;
      if (skill) query = db.collection('users').where('skills', 'array-contains', skill).limit(SCAN_LIMIT);
      if (roleFilter) query = query.where('role', '==', roleFilter);

      const [snapshot, index] = await Promise.all([query.get(), connectionIndex(uid)]);
      const terms = term.toLowerCase().split(/\s+/).filter(Boolean);

      const results = [];
      for (const doc of snapshot.docs) {
        if (doc.id === uid) continue;
        const data = doc.data();
        if (!isVisibleAccount(data, viewerRole)) continue;
        if (!matchesText(data, terms)) continue;

        const connected = index.connected.has(doc.id);
        let connectionState: ConnectionState = 'none';
        let requestId: string | undefined;
        if (connected) connectionState = 'connected';
        else if (index.outgoing.has(doc.id)) connectionState = 'outgoing_pending';
        else if (index.incoming.has(doc.id)) {
          connectionState = 'incoming_pending';
          requestId = index.incoming.get(doc.id);
        }

        results.push({
          ...redactDirectoryCard({ ...data, uid: doc.id }, { role: viewerRole as ProfileRole, connected }),
          connectionState,
          requestId,
        });
        if (results.length >= PAGE_SIZE) break;
      }

      return { results, scanned: snapshot.size, truncated: snapshot.size >= SCAN_LIMIT };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('searchDirectory failed', error);
      throw new HttpsError('internal', 'The member directory is temporarily unavailable.');
    }
  },
);
