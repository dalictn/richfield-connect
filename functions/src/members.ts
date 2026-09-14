import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb as db } from './firebaseAdmin';
import { APP_CHECK_ENFORCEMENT } from './appCheck';
import { canSeeSection, type ProfileRole } from './profileVisibility';

const REGION = 'africa-south1';
const ROLES = new Set(['student', 'alumni', 'business', 'administrator']);

interface CallableRequest {
  auth?: { uid?: string | null; token?: Record<string, unknown> | null } | null;
  data?: Record<string, unknown>;
}

function requireActiveMember(request: CallableRequest): { uid: string; role: ProfileRole } {
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
  return { uid, role: role as ProfileRole };
}

function top(counts: Map<string, number>, n = 5): Array<{ label: string; count: number }> {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

/**
 * Resolves display identity for a batch of uids so lists can show names rather
 * than raw ids. Returns only the identity fields every member already sees on a
 * directory card — never a visibility-controlled section.
 */
export const lookupMembers = onCall({ region: REGION, ...APP_CHECK_ENFORCEMENT }, async (request) => {
  requireActiveMember(request);
  try {
    const raw = Array.isArray(request.data?.uids) ? (request.data?.uids as unknown[]) : [];
    const uids = Array.from(new Set(raw.map((value) => String(value ?? '').trim()).filter((value) => value && value.length <= 128))).slice(0, 100);
    if (!uids.length) return { members: [] };
    const snaps = await db.getAll(...uids.map((uid) => db.collection('users').doc(uid)));
    return {
      members: snaps.filter((snap) => snap.exists).map((snap) => {
        const data = snap.data() ?? {};
        return {
          uid: snap.id,
          displayName: String(data.displayName ?? 'Richfield member'),
          role: String(data.role ?? ''),
          headline: String(data.headline ?? ''),
          companyName: String(data.companyName ?? ''),
          avatarUrl: String(data.avatarUrl ?? ''),
        };
      }),
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('lookupMembers failed', error);
    throw new HttpsError('internal', 'Unable to look up members.');
  }
});

/**
 * Career pathway explorer (brief §2.5): where graduates of a programme ended up
 * and the roles they held along the way.
 *
 * Work history is shown only when that alumnus has shared their experience
 * section with this viewer, so the explorer respects the same POPIA visibility
 * rules as the profile view. Aggregates are computed from shared history only.
 */
export const getCareerPathways = onCall({ region: REGION, ...APP_CHECK_ENFORCEMENT }, async (request) => {
  const viewer = requireActiveMember(request);
  try {
    const programme = String(request.data?.programme ?? '').trim();
    if (!programme || programme.length > 160) throw new HttpsError('invalid-argument', 'Choose a programme to explore.');
    const target = programme.toLowerCase();

    const [alumniSnap, connectionsSnap] = await Promise.all([
      db.collection('users').where('role', '==', 'alumni').limit(1000).get(),
      db.collection('connections').doc(viewer.uid).collection('members').limit(1000).get(),
    ]);
    const connected = new Set(connectionsSnap.docs.map((doc) => doc.id));

    const companies = new Map<string, number>();
    const roles = new Map<string, number>();
    const fields = new Map<string, number>();

    const pathways = alumniSnap.docs
      .filter((doc) => {
        const data = doc.data();
        if (data.accountStatus === 'suspended' || data.accountStatus === 'revoked') return false;
        const studied = String(data.programmeOfStudy ?? '').trim().toLowerCase();
        return Boolean(studied) && (studied === target || studied.includes(target) || target.includes(studied));
      })
      .map((doc) => {
        const data = doc.data();
        const visible = canSeeSection(data, 'experience', { role: viewer.role, connected: connected.has(doc.id) });
        const history = visible && Array.isArray(data.workExperience)
          ? (data.workExperience as Array<Record<string, unknown>>)
            .map((row) => ({
              company: String(row.company ?? ''),
              role: String(row.role ?? ''),
              startDate: String(row.startDate ?? ''),
              endDate: row.endDate ? String(row.endDate) : null,
            }))
            .filter((row) => row.company && row.role)
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
          : [];
        for (const row of history) {
          companies.set(row.company, (companies.get(row.company) ?? 0) + 1);
          roles.set(row.role, (roles.get(row.role) ?? 0) + 1);
        }
        const field = String(data.fieldOfWork ?? '').trim();
        if (field) fields.set(field, (fields.get(field) ?? 0) + 1);
        return {
          uid: doc.id,
          displayName: String(data.displayName ?? 'Richfield alumnus'),
          headline: String(data.headline ?? ''),
          graduationYear: data.graduationYear ? Number(data.graduationYear) : null,
          fieldOfWork: field,
          currentRole: history.find((row) => !row.endDate) ?? history[0] ?? null,
          history,
          experienceHidden: !visible,
        };
      })
      .sort((a, b) => Number(b.graduationYear ?? 0) - Number(a.graduationYear ?? 0));

    return {
      programme,
      alumniCount: pathways.length,
      topCompanies: top(companies),
      topRoles: top(roles),
      topFields: top(fields),
      pathways: pathways.slice(0, 50),
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('getCareerPathways failed', error);
    throw new HttpsError('internal', 'Unable to load career pathways.');
  }
});
