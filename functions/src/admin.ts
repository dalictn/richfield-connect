import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { adminAuth, adminDb } from './firebaseAdmin';
import { APP_CHECK_ENFORCEMENT } from './appCheck';

const REGION = 'africa-south1';
const ROLES = new Set(['student', 'alumni', 'business', 'administrator']);
const STATUSES = new Set(['active', 'suspended', 'revoked']);
const MODERATION_TYPES = new Set(['post', 'comment', 'profile']);
const MODERATION_ACTIONS = new Set(['dismiss', 'delete']);
const BROADCAST_ROLES = new Set(['all', 'student', 'alumni', 'business']);

interface AdminRequest {
  auth?: { uid?: string | null; token?: Record<string, unknown> | null } | null;
  data?: Record<string, unknown>;
}

function requireAdmin(request: AdminRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  if (request.auth?.token?.role !== 'administrator') {
    throw new HttpsError('permission-denied', 'Administrator role required.');
  }
  if (request.auth?.token?.accountStatus === 'suspended' || request.auth?.token?.accountStatus === 'revoked') {
    throw new HttpsError('permission-denied', 'Administrator account is not active.');
  }
  return uid;
}

function requiredString(value: unknown, field: string, max: number): string {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) throw new HttpsError('invalid-argument', `${field} is required.`);
  return result;
}

async function audit(adminUid: string, action: string, target: string, details: Record<string, unknown>): Promise<void> {
  await adminDb.collection('admin_logs').add({
    adminUid,
    action,
    target,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function updateClaims(uid: string, updates: Record<string, unknown>): Promise<void> {
  const current = await adminAuth.getUser(uid);
  const existing = current.customClaims ?? {};
  await adminAuth.setCustomUserClaims(uid, { ...existing, ...updates });
}

export const manageUserStatus = onCall(
  { region: REGION, ...APP_CHECK_ENFORCEMENT, },
  async (request) => {
    const adminUid = requireAdmin(request);
    try {
      const targetUid = requiredString(request.data?.uid, 'uid', 128);
      const status = requiredString(request.data?.status, 'status', 32);
      if (!STATUSES.has(status)) throw new HttpsError('invalid-argument', 'Unsupported account status.');
      if (targetUid === adminUid) throw new HttpsError('failed-precondition', 'An administrator cannot suspend or revoke their own account.');

      const userRef = adminDb.collection('users').doc(targetUid);
      const snap = await userRef.get();
      if (!snap.exists) throw new HttpsError('not-found', 'User profile not found.');
      const profile = snap.data() ?? {};
      const role = String(profile.role ?? '');
      if (!ROLES.has(role)) throw new HttpsError('failed-precondition', 'Target user has an invalid role.');
      if (role === 'administrator') throw new HttpsError('permission-denied', 'Administrator accounts require out-of-band governance.');

      const isApproved = status === 'active';
      const now = FieldValue.serverTimestamp();
      await userRef.update({ accountStatus: status, isApproved, updatedAt: now });
      await updateClaims(targetUid, {
        role,
        isApproved,
        accountStatus: status,
      });
      await adminAuth.updateUser(targetUid, { disabled: status !== 'active' });
      await audit(adminUid, 'manage_user_status', targetUid, { role, status, isApproved });
      return { ok: true, uid: targetUid, role, status, isApproved };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('manageUserStatus failed', error);
      throw new HttpsError('internal', 'Unable to change user status.');
    }
  },
);

export const moderateContent = onCall(
  { region: REGION, ...APP_CHECK_ENFORCEMENT, },
  async (request) => {
    const adminUid = requireAdmin(request);
    try {
      const flagId = requiredString(request.data?.flagId, 'flagId', 128);
      const action = requiredString(request.data?.action, 'action', 32);
      if (!MODERATION_ACTIONS.has(action)) throw new HttpsError('invalid-argument', 'Unsupported moderation action.');

      const flagRef = adminDb.collection('moderation_flags').doc(flagId);
      const flagSnap = await flagRef.get();
      if (!flagSnap.exists) throw new HttpsError('not-found', 'Moderation item not found.');
      const flag = flagSnap.data() ?? {};
      const contentType = String(flag.contentType ?? '');
      if (!MODERATION_TYPES.has(contentType)) throw new HttpsError('failed-precondition', 'Unsupported moderation content type.');
      const contentId = requiredString(flag.contentId, 'contentId', 256);

      const batch = adminDb.batch();
      if (action === 'delete') {
        if (contentType === 'post') {
          const postRef = adminDb.collection('posts').doc(contentId);
          await adminDb.recursiveDelete(postRef);
          const feedItems = await adminDb.collectionGroup('items').where('postId', '==', contentId).limit(500).get();
          for (const item of feedItems.docs) batch.delete(item.ref);
        } else if (contentType === 'comment') {
          const postId = requiredString(flag.parentId, 'parentId', 128);
          batch.delete(adminDb.collection('posts').doc(postId).collection('comments').doc(contentId));
        } else {
          batch.update(adminDb.collection('users').doc(contentId), {
            profileVisibility: 'private',
            moderationRestricted: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      batch.update(flagRef, {
        status: action === 'delete' ? 'resolved_deleted' : 'dismissed',
        reviewedBy: adminUid,
        reviewedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      await audit(adminUid, 'moderate_content', contentId, { flagId, contentType, action });
      return { ok: true, status: action === 'delete' ? 'resolved_deleted' : 'dismissed' };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('moderateContent failed', error);
      throw new HttpsError('internal', 'Unable to complete moderation action.');
    }
  },
);

/**
 * Accounts are active unless an administrator has explicitly suspended or revoked
 * them. Querying for `accountStatus == 'active'` silently excluded every account
 * registered before that field was written, which meant broadcasts reached nobody.
 * Filter on the exclusions instead so a missing field reads as active, matching
 * the Firestore rules (`activeUser()`).
 */
function isActiveAccount(data: FirebaseFirestore.DocumentData): boolean {
  const status = data.accountStatus;
  return status !== 'suspended' && status !== 'revoked';
}

async function targetUserIds(targetRole: string): Promise<string[]> {
  const base = adminDb.collection('users');
  const query = targetRole === 'all' ? base.limit(10000) : base.where('role', '==', targetRole).limit(10000);
  const snapshot = await query.get();
  return snapshot.docs.filter((doc) => isActiveAccount(doc.data())).map((doc) => doc.id);
}

async function sendBroadcast(uids: string[], title: string, body: string, announcementId: string): Promise<{ sent: number; failed: number }> {
  const tokens: string[] = [];
  for (let i = 0; i < uids.length; i += 100) {
    const group = uids.slice(i, i + 100);
    const snapshots = await Promise.all(group.map((uid) => adminDb.collection('users').doc(uid).collection('devices').get()));
    for (const snapshot of snapshots) {
      for (const device of snapshot.docs) {
        const token = String(device.data().token ?? '');
        if (token) tokens.push(token);
      }
    }
  }
  const uniqueTokens = Array.from(new Set(tokens));
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const chunk = uniqueTokens.slice(i, i + 500);
    if (!chunk.length) continue;
    const message: MulticastMessage = {
      tokens: chunk,
      notification: { title, body },
      data: { type: 'admin_broadcast', announcementId },
      android: { priority: 'high', notification: { channelId: 'richfield-connect' } },
      apns: { payload: { aps: { sound: 'default' } } },
    };
    const result = await getMessaging().sendEachForMulticast(message);
    sent += result.successCount;
    failed += result.failureCount;
  }
  return { sent, failed };
}

export const broadcastAnnouncement = onCall(
  { region: REGION, ...APP_CHECK_ENFORCEMENT, },
  async (request) => {
    const adminUid = requireAdmin(request);
    try {
      const title = requiredString(request.data?.title, 'title', 120);
      const body = requiredString(request.data?.body, 'body', 2000);
      const targetRole = String(request.data?.targetRole ?? 'all').trim();
      if (!BROADCAST_ROLES.has(targetRole)) throw new HttpsError('invalid-argument', 'Invalid target role.');

      const ref = adminDb.collection('announcements').doc();
      await ref.set({
        title,
        body,
        targetRole,
        createdBy: adminUid,
        createdAt: FieldValue.serverTimestamp(),
        status: 'sent',
        // This callable delivers its own push so it can report per-device results
        // to the administrator. Marking the document stops notifyAnnouncement
        // from delivering the same announcement a second time.
        pushDeliveredBy: 'broadcastAnnouncement',
      });

      const uids = await targetUserIds(targetRole);
      const delivery = await sendBroadcast(uids, title, body, ref.id);
      await ref.update({ recipientCount: uids.length, sentCount: delivery.sent, failedCount: delivery.failed, deliveredAt: Timestamp.now() });
      await audit(adminUid, 'broadcast_announcement', ref.id, { targetRole, recipientCount: uids.length, ...delivery });
      return { ok: true, announcementId: ref.id, recipientCount: uids.length, ...delivery };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('broadcastAnnouncement failed', error);
      throw new HttpsError('internal', 'Unable to broadcast announcement.');
    }
  },
);

const REPORTABLE_CONTENT = new Set(['post', 'comment', 'profile']);

function requireActiveMember(request: AdminRequest): string {
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
  return uid;
}

/**
 * Resolves the reported content and returns the uid that authored it, or null
 * when the content does not exist.
 */
async function resolveReportTarget(
  contentType: string,
  contentId: string,
  parentId: string | undefined,
): Promise<string | null> {
  if (contentType === 'post') {
    const snap = await adminDb.collection('posts').doc(contentId).get();
    return snap.exists ? String(snap.data()?.uid ?? '') : null;
  }
  if (contentType === 'comment') {
    if (!parentId) throw new HttpsError('invalid-argument', 'parentId is required when reporting a comment.');
    const snap = await adminDb.collection('posts').doc(parentId).collection('comments').doc(contentId).get();
    return snap.exists ? String(snap.data()?.uid ?? '') : null;
  }
  const snap = await adminDb.collection('users').doc(contentId).get();
  return snap.exists ? contentId : null;
}

/**
 * The producer for the administrator moderation queue.
 *
 * Clients cannot write moderation_flags directly (Firestore rules deny it), so
 * without this callable the queue could never receive an item and the
 * administrator's flagged-content metrics were permanently zero.
 *
 * The document id is derived from reporter + content so a user re-reporting the
 * same item updates their existing report rather than flooding the queue. A
 * report filed after an earlier one was resolved deliberately reopens it.
 */
export const reportContent = onCall(
  { region: REGION, ...APP_CHECK_ENFORCEMENT, },
  async (request) => {
    const reporterUid = requireActiveMember(request);
    try {
      const contentType = requiredString(request.data?.contentType, 'contentType', 32);
      if (!REPORTABLE_CONTENT.has(contentType)) throw new HttpsError('invalid-argument', 'Unsupported content type.');
      const contentId = requiredString(request.data?.contentId, 'contentId', 256);
      const reason = requiredString(request.data?.reason, 'reason', 500);
      const rawParentId = request.data?.parentId;
      const parentId = rawParentId ? requiredString(rawParentId, 'parentId', 128) : undefined;

      const authorUid = await resolveReportTarget(contentType, contentId, parentId);
      if (authorUid === null) throw new HttpsError('not-found', 'The reported content no longer exists.');
      if (authorUid === reporterUid) throw new HttpsError('failed-precondition', 'You cannot report your own content.');

      const flagId = createHash('sha256').update(`${reporterUid}|${contentType}|${contentId}`).digest('hex');
      const flagRef = adminDb.collection('moderation_flags').doc(flagId);
      const existing = await flagRef.get();
      if (existing.exists && existing.data()?.status === 'open') {
        return { ok: true, flagId, alreadyReported: true };
      }

      await flagRef.set({
        contentType,
        contentId,
        parentId: parentId ?? null,
        authorUid,
        reason,
        reportedBy: reporterUid,
        status: 'open',
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, flagId, alreadyReported: false };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('reportContent failed', error);
      throw new HttpsError('internal', 'Unable to submit this report.');
    }
  },
);

export const listAdminUsers = onCall(
  { region: REGION, ...APP_CHECK_ENFORCEMENT, },
  async (request) => {
    requireAdmin(request);
    try {
      const role = String(request.data?.role ?? 'all');
      const status = String(request.data?.status ?? 'all');
      if (role !== 'all' && !ROLES.has(role)) throw new HttpsError('invalid-argument', 'Invalid role filter.');
      if (status !== 'all' && !STATUSES.has(status)) throw new HttpsError('invalid-argument', 'Invalid status filter.');
      let query = adminDb.collection('users').orderBy('createdAt', 'desc').limit(200);
      if (role !== 'all') query = query.where('role', '==', role);
      if (status !== 'all') query = query.where('accountStatus', '==', status);
      const snapshot = await query.get();
      return { users: snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })) };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('listAdminUsers failed', error);
      throw new HttpsError('internal', 'Unable to list users.');
    }
  },
);

export const listModerationQueue = onCall(
  { region: REGION, ...APP_CHECK_ENFORCEMENT, },
  async (request) => {
    requireAdmin(request);
    try {
      const snapshot = await adminDb.collection('moderation_flags').where('status', '==', 'open').orderBy('createdAt', 'desc').limit(200).get();
      return { flags: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('listModerationQueue failed', error);
      throw new HttpsError('internal', 'Unable to load moderation queue.');
    }
  },
);
