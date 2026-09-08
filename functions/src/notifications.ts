import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { adminDb as db } from './firebaseAdmin';
import { matchApprovedOpportunity } from './opportunities';

const REGION = 'africa-south1';
function uidOf(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}
function adminOnly(request: { auth?: { uid?: string | null; token?: Record<string, unknown> } | null }): string {
  const uid = uidOf(request);
  if (request.auth?.token?.role !== 'administrator') throw new HttpsError('permission-denied', 'Administrator role required.');
  return uid;
}
function text(value: unknown, field: string, max: number): string {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) throw new HttpsError('invalid-argument', `${field} is required.`);
  return result;
}

async function tokensForUsers(uids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(uids.filter(Boolean))).slice(0, 5000);
  const tokens: string[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const snaps = await Promise.all(unique.slice(i, i + 100).map((uid) => db.collection('users').doc(uid).collection('devices').get()));
    for (const snap of snaps) for (const doc of snap.docs) {
      const token = String(doc.data().token ?? '');
      if (token) tokens.push(token);
    }
  }
  return Array.from(new Set(tokens));
}
async function sendToUsers(uids: string[], notification: { title: string; body: string; data: Record<string, string> }): Promise<void> {
  const tokens = await tokensForUsers(uids);
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    if (!chunk.length) continue;
    const message: MulticastMessage = { tokens: chunk, notification: { title: notification.title, body: notification.body }, data: notification.data, android: { priority: 'high', notification: { channelId: 'richfield-connect' } }, apns: { payload: { aps: { sound: 'default' } } } };
    const result = await getMessaging().sendEachForMulticast(message);
  }
}

export const registerFcmToken = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const uid = uidOf(request);
    const token = text(request.data?.token, 'FCM token', 4096);
    const tokenId = createHash('sha256').update(token).digest('hex');
    const platform = text(request.data?.platform ?? 'unknown', 'Platform', 40);
    await db.collection('users').doc(uid).collection('devices').doc(tokenId).set({ token, platform, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('registerFcmToken failed', error);
    throw new HttpsError('internal', 'Unable to register notification device.');
  }
});

export const createAnnouncement = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const adminUid = adminOnly(request);
    const title = text(request.data?.title, 'Title', 120);
    const body = text(request.data?.body, 'Body', 1000);
    const targetRole = request.data?.targetRole ? text(request.data.targetRole, 'Target role', 40) : 'all';
    if (targetRole !== 'all' && !['student', 'alumni', 'business', 'administrator'].includes(targetRole)) throw new HttpsError('invalid-argument', 'Invalid target role.');
    const ref = db.collection('announcements').doc();
    await ref.set({ title, body, targetRole, createdBy: adminUid, createdAt: FieldValue.serverTimestamp() });
    return { ok: true, announcementId: ref.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('createAnnouncement failed', error);
    throw new HttpsError('internal', 'Unable to create announcement.');
  }
});

export const notifyConnectionRequest = onDocumentCreated({ document: 'connection_requests/{requestId}', region: REGION }, async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const fromUid = String(data.fromUid ?? ''); const toUid = String(data.toUid ?? '');
  const sender = await db.collection('users').doc(fromUid).get();
  const name = String(sender.data()?.displayName ?? 'A Richfield user');
  await sendToUsers([toUid], { title: 'New connection request', body: `${name} wants to connect with you.`, data: { type: 'connection_request', requestId: event.params.requestId } });
});

export const notifyConnectionAccepted = onDocumentUpdated({ document: 'connection_requests/{requestId}', region: REGION }, async (event) => {
  const before = event.data?.before.data(); const after = event.data?.after.data();
  if (!before || !after || before.status === after.status || after.status !== 'accepted') return;
  const receiver = await db.collection('users').doc(String(after.toUid ?? '')).get();
  const name = String(receiver.data()?.displayName ?? 'A Richfield user');
  await sendToUsers([String(after.fromUid ?? '')], { title: 'Connection accepted', body: `${name} accepted your connection request.`, data: { type: 'connection_accepted', requestId: event.params.requestId } });
});

export const notifyDirectMessage = onDocumentCreated({ document: 'conversations/{conversationId}/messages/{messageId}', region: REGION }, async (event) => {
  const data = event.data?.data(); if (!data) return;
  const conversation = await db.collection('conversations').doc(event.params.conversationId).get();
  const members = (conversation.data()?.memberUids ?? []) as string[];
  const senderUid = String(data.senderUid ?? '');
  const sender = await db.collection('users').doc(senderUid).get();
  const name = String(sender.data()?.displayName ?? 'New message');
  await sendToUsers(members.filter((uid) => uid !== senderUid), { title: name, body: String(data.body ?? '').slice(0, 140), data: { type: 'direct_message', conversationId: event.params.conversationId } });
});

export const notifyOpportunityMatches = onDocumentCreated({ document: 'matches/{uid}/opportunities/{opportunityId}', region: REGION }, async (event) => {
  const data = event.data?.data(); if (!data) return;
  const opportunityId = event.params.opportunityId;
  const opportunity = await db.collection('opportunities').doc(opportunityId).get();
  if (!opportunity.exists) return;
  await sendToUsers([event.params.uid], { title: 'New career match', body: `${String(opportunity.data()?.title ?? 'An opportunity')} matches your profile.`, data: { type: 'opportunity_match', opportunityId } });
});

export const notifyAnnouncement = onDocumentCreated({ document: 'announcements/{announcementId}', region: REGION }, async (event) => {
  const data = event.data?.data(); if (!data) return;
  const targetRole = String(data.targetRole ?? 'all');
  const query = targetRole === 'all' ? db.collection('users').where('isApproved', '==', true).limit(5000) : db.collection('users').where('role', '==', targetRole).where('isApproved', '==', true).limit(5000);
  const users = await query.get();
  await sendToUsers(users.docs.map((doc) => doc.id), { title: String(data.title ?? 'Richfield Connect'), body: String(data.body ?? ''), data: { type: 'announcement', announcementId: event.params.announcementId } });
});

export const matchOnOpportunityApproval = onDocumentUpdated({ document: 'opportunities/{opportunityId}', region: REGION }, async (event) => {
  const before = event.data?.before.data(); const after = event.data?.after.data();
  if (!before || !after || before.status === after.status || after.status !== 'approved') return;
  await matchApprovedOpportunity(event.params.opportunityId);
});
