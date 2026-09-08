import { FieldValue, Timestamp, collectionGroup } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth as auth, adminDb as db } from './firebaseAdmin';

const REGION = 'africa-south1';
const MAX_TEXT = 4000;
const MAX_COMMENT = 1000;
const VALID_REACTIONS = new Set(['like', 'celebrate', 'insightful']);

type Role = 'student' | 'alumni' | 'business' | 'administrator';

function signedIn(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}

function approvedRole(request: { auth?: { uid?: string | null; token?: Record<string, unknown> } | null }): { uid: string; role: Role } {
  const uid = signedIn(request);
  const role = request.auth?.token?.role as Role | undefined;
  if (!role || !['student', 'alumni', 'business', 'administrator'].includes(role)) {
    throw new HttpsError('permission-denied', 'A valid platform role is required.');
  }
  if (role === 'business' && request.auth?.token?.isApproved !== true) {
    throw new HttpsError('permission-denied', 'Business account approval is required.');
  }
  return { uid, role };
}

function text(value: unknown, max: number, field: string): string {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) throw new HttpsError('invalid-argument', `${field} is required and is too long.`);
  return result;
}

function conversationId(a: string, b: string): string {
  return [a, b].sort().join('_');
}

async function refreshFeedScoresForPost(postId: string): Promise<void> {
  const postSnap = await db.collection('posts').doc(postId).get();
  if (!postSnap.exists) return;
  const post = postSnap.data()!;
  const createdAt = post.createdAt as Timestamp;
  const feedSnap = await db.collectionGroup('items').where('postId', '==', postId).limit(500).get();
  const batch = db.batch();
  for (const item of feedSnap.docs) {
    const pathParts = item.ref.path.split('/');
    const viewerUid = pathParts[1];
    const viewer = await db.collection('users').doc(viewerUid).get();
    const viewerRole = viewer.data()?.role as Role | undefined;
    if (!viewerRole) continue;
    const score = relevanceScore(viewerRole, post.authorRole as Role, createdAt.toMillis(), Number(post.reactionCount ?? 0), Number(post.commentCount ?? 0));
    batch.update(item.ref, { score, updatedAt: FieldValue.serverTimestamp() });
  }
  if (!feedSnap.empty) await batch.commit();
}

async function areConnected(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const snap = await db.collection('connections').doc(a).collection('members').doc(b).get();
  return snap.exists;
}

function relevanceScore(viewerRole: Role, authorRole: Role, createdAtMs: number, reactions: number, comments: number): number {
  const roleAffinity: Record<Role, Record<Role, number>> = {
    student: { student: 1.0, alumni: 1.4, business: 1.5, administrator: 0.3 },
    alumni: { student: 1.2, alumni: 1.4, business: 1.5, administrator: 0.3 },
    business: { student: 1.5, alumni: 1.6, business: 1.0, administrator: 0.4 },
    administrator: { student: 1, alumni: 1, business: 1, administrator: 1 },
  };
  const ageHours = Math.max(0, (Date.now() - createdAtMs) / 3600000);
  const freshness = Math.exp(-ageHours / 72);
  return roleAffinity[viewerRole][authorRole] * 100 + freshness * 40 + reactions * 2 + comments * 3;
}

export const createConnectionRequest = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const targetUid = text(request.data?.targetUid, 128, 'targetUid');
    if (targetUid === uid) throw new HttpsError('failed-precondition', 'You cannot connect with yourself.');
    const target = await db.collection('users').doc(targetUid).get();
    if (!target.exists) throw new HttpsError('not-found', 'Target profile not found.');
    if (await areConnected(uid, targetUid)) throw new HttpsError('already-exists', 'You are already connected.');

    const existing = await db.collection('connection_requests')
      .where('fromUid', '==', uid).where('toUid', '==', targetUid).where('status', '==', 'pending').limit(1).get();
    if (!existing.empty) return { ok: true, requestId: existing.docs[0].id };

    const reverse = await db.collection('connection_requests')
      .where('fromUid', '==', targetUid).where('toUid', '==', uid).where('status', '==', 'pending').limit(1).get();
    if (!reverse.empty) throw new HttpsError('failed-precondition', 'This user already sent you a pending request.');

    const ref = db.collection('connection_requests').doc();
    await ref.set({ fromUid: uid, toUid: targetUid, status: 'pending', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, requestId: ref.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('createConnectionRequest failed', error);
    throw new HttpsError('internal', 'Unable to create connection request.');
  }
});

export const respondToConnectionRequest = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const requestId = text(request.data?.requestId, 128, 'requestId');
    const decision = String(request.data?.decision ?? '');
    if (decision !== 'accept' && decision !== 'decline') throw new HttpsError('invalid-argument', 'Decision must be accept or decline.');

    const requestRef = db.collection('connection_requests').doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) throw new HttpsError('not-found', 'Connection request not found.');
    const data = requestSnap.data()!;
    if (data.toUid !== uid || data.status !== 'pending') throw new HttpsError('permission-denied', 'You cannot modify this request.');

    if (decision === 'decline') {
      await requestRef.update({ status: 'declined', updatedAt: FieldValue.serverTimestamp() });
      return { ok: true };
    }

    const fromUid = String(data.fromUid);
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    batch.set(db.collection('connections').doc(uid).collection('members').doc(fromUid), { uid: fromUid, connectedAt: now });
    batch.set(db.collection('connections').doc(fromUid).collection('members').doc(uid), { uid, connectedAt: now });
    batch.update(requestRef, { status: 'accepted', updatedAt: now });
    await batch.commit();
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('respondToConnectionRequest failed', error);
    throw new HttpsError('internal', 'Unable to update connection request.');
  }
});

export const createPost = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid, role } = approvedRole(request);
    const body = text(request.data?.body, MAX_TEXT, 'body');
    const postRef = db.collection('posts').doc();
    const createdAt = Timestamp.now();
    const author = await db.collection('users').doc(uid).get();
    const authorDisplayName = String(author.data()?.displayName ?? 'Richfield Connect user');
    await postRef.set({ uid, authorRole: role, authorDisplayName, body, reactionCount: 0, commentCount: 0, createdAt, updatedAt: createdAt });

    const members = await db.collection('connections').doc(uid).collection('members').limit(200).get();
    const batch = db.batch();
    const recipients = new Set<string>([uid, ...members.docs.map((d) => d.id)]);
    for (const recipientUid of recipients) {
      const recipient = await db.collection('users').doc(recipientUid).get();
      const recipientRole = recipient.data()?.role as Role | undefined;
      if (!recipientRole) continue;
      const score = relevanceScore(recipientRole, role, createdAt.toMillis(), 0, 0);
      const feedRef = db.collection('feeds').doc(recipientUid).collection('items').doc(postRef.id);
      batch.set(feedRef, { postId: postRef.id, authorUid: uid, authorRole: role, authorDisplayName, score, createdAt, updatedAt: createdAt }, { merge: true });
    }
    await batch.commit();
    return { ok: true, postId: postRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('createPost failed', error);
    throw new HttpsError('internal', 'Unable to create post.');
  }
});

export const reactToPost = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const postId = text(request.data?.postId, 128, 'postId');
    const reaction = String(request.data?.reaction ?? 'like');
    if (!VALID_REACTIONS.has(reaction)) throw new HttpsError('invalid-argument', 'Unsupported reaction.');
    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) throw new HttpsError('not-found', 'Post not found.');
    const reactionRef = postRef.collection('reactions').doc(uid);
    const existing = await reactionRef.get();
    if (existing.exists) {
      await reactionRef.delete();
      await postRef.update({ reactionCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      await refreshFeedScoresForPost(postId);
      return { ok: true, active: false };
    }
    await reactionRef.set({ uid, reaction, createdAt: FieldValue.serverTimestamp() });
    await postRef.update({ reactionCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    await refreshFeedScoresForPost(postId);
    return { ok: true, active: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('reactToPost failed', error);
    throw new HttpsError('internal', 'Unable to react to post.');
  }
});

export const commentOnPost = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const postId = text(request.data?.postId, 128, 'postId');
    const body = text(request.data?.body, MAX_COMMENT, 'body');
    const postRef = db.collection('posts').doc(postId);
    if (!(await postRef.get()).exists) throw new HttpsError('not-found', 'Post not found.');
    const ref = postRef.collection('comments').doc();
    await ref.set({ uid, body, createdAt: FieldValue.serverTimestamp() });
    await postRef.update({ commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    await refreshFeedScoresForPost(postId);
    return { ok: true, commentId: ref.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('commentOnPost failed', error);
    throw new HttpsError('internal', 'Unable to comment on post.');
  }
});

export const sendDirectMessage = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const targetUid = text(request.data?.targetUid, 128, 'targetUid');
    const body = text(request.data?.body, 4000, 'body');
    if (targetUid === uid || !(await areConnected(uid, targetUid))) throw new HttpsError('permission-denied', 'Direct messages are available only between connected users.');
    const conversation = conversationId(uid, targetUid);
    const conversationRef = db.collection('conversations').doc(conversation);
    const messageRef = conversationRef.collection('messages').doc();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(conversationRef, { memberUids: [uid, targetUid], lastMessage: body.slice(0, 160), lastMessageAt: now, updatedAt: now }, { merge: true });
    batch.set(messageRef, { senderUid: uid, body, createdAt: now });
    await batch.commit();
    return { ok: true, conversationId: conversation, messageId: messageRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('sendDirectMessage failed', error);
    throw new HttpsError('internal', 'Unable to send message.');
  }
});

export const recomputeFeedScore = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const postId = text(request.data?.postId, 128, 'postId');
    const post = await db.collection('posts').doc(postId).get();
    if (!post.exists) throw new HttpsError('not-found', 'Post not found.');
    const postData = post.data()!;
    const viewer = await db.collection('users').doc(uid).get();
    const score = relevanceScore(viewer.data()?.role as Role, postData.authorRole as Role, (postData.createdAt as Timestamp).toMillis(), postData.reactionCount ?? 0, postData.commentCount ?? 0);
    await db.collection('feeds').doc(uid).collection('items').doc(postId).update({ score, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, score };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('recomputeFeedScore failed', error);
    throw new HttpsError('internal', 'Unable to update feed score.');
  }
});

export const deleteOwnPost = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const postId = text(request.data?.postId, 128, 'postId');
    const ref = db.collection('posts').doc(postId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== uid) throw new HttpsError('permission-denied', 'You cannot delete this post.');
    await ref.delete();
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('deleteOwnPost failed', error);
    throw new HttpsError('internal', 'Unable to delete post.');
  }
});
