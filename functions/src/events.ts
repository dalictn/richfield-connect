import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { adminDb as db } from './firebaseAdmin';
import { APP_CHECK_ENFORCEMENT } from './appCheck';
import { sendToUsers } from './notifications';

/**
 * Institutional events: career fairs, workshops, networking and info sessions.
 *
 * Only administrators create, edit and publish events (brief §2.2). Every signed-in
 * member sees published events (§2.5), and publishing notifies the students whose
 * programme or career interests match the event's tags rather than broadcasting
 * to everyone. An event with no tags is treated as general and reaches all
 * students.
 */

const REGION = 'africa-south1';
const EVENT_TYPES = new Set(['career-fair', 'workshop', 'networking', 'info-session', 'other']);
const STATUSES = new Set(['draft', 'published', 'cancelled']);
const ROLES = new Set(['student', 'alumni', 'business', 'administrator']);

interface CallableRequest {
  auth?: { uid?: string | null; token?: Record<string, unknown> | null } | null;
  data?: Record<string, unknown>;
}

function requireAdmin(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const token = request.auth?.token ?? {};
  if (token.role !== 'administrator') throw new HttpsError('permission-denied', 'Administrator role required.');
  if (token.accountStatus === 'suspended' || token.accountStatus === 'revoked') {
    throw new HttpsError('permission-denied', 'Administrator account is not active.');
  }
  return uid;
}

function requireActiveMember(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const token = request.auth?.token ?? {};
  if (!ROLES.has(String(token.role ?? ''))) throw new HttpsError('permission-denied', 'A valid platform role is required.');
  if (token.role === 'business' && token.isApproved !== true) {
    throw new HttpsError('permission-denied', 'Business account approval is required.');
  }
  if (token.accountStatus === 'suspended' || token.accountStatus === 'revoked') {
    throw new HttpsError('permission-denied', 'This account is not active.');
  }
  return uid;
}

function text(value: unknown, field: string, max: number, required = false): string {
  const result = String(value ?? '').trim();
  if (required && !result) throw new HttpsError('invalid-argument', `${field} is required.`);
  if (result.length > max) throw new HttpsError('invalid-argument', `${field} is too long.`);
  return result;
}

function normalise(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function tagList(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpsError('invalid-argument', `${field} must be a list.`);
  const cleaned = value.map((item) => text(item, field, 80).toLowerCase()).filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 20);
}

function isoDate(value: unknown, field: string, required = true): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (required) throw new HttpsError('invalid-argument', `${field} is required.`);
    return null;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) throw new HttpsError('invalid-argument', `${field} must be a valid date and time.`);
  return new Date(ms).toISOString();
}

export const upsertEvent = onCall({ region: REGION, ...APP_CHECK_ENFORCEMENT }, async (request) => {
  const adminUid = requireAdmin(request);
  try {
    const data = (request.data ?? {}) as Record<string, unknown>;
    const eventId = data.eventId ? text(data.eventId, 'eventId', 128, true) : '';

    const type = String(data.type ?? 'other');
    if (!EVENT_TYPES.has(type)) throw new HttpsError('invalid-argument', 'Unsupported event type.');
    const status = String(data.status ?? 'draft');
    if (!STATUSES.has(status)) throw new HttpsError('invalid-argument', 'Unsupported event status.');

    const startsAt = isoDate(data.startsAt, 'Start time')!;
    const endsAt = isoDate(data.endsAt, 'End time', false);
    if (endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
      throw new HttpsError('invalid-argument', 'The event cannot end before it starts.');
    }

    let capacity: number | null = null;
    if (data.capacity !== undefined && data.capacity !== null && data.capacity !== '') {
      capacity = Number(data.capacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
        throw new HttpsError('invalid-argument', 'Capacity must be a whole number between 1 and 100,000.');
      }
    }

    const patch = {
      title: text(data.title, 'Title', 160, true),
      description: text(data.description, 'Description', 3000, true),
      type,
      location: text(data.location, 'Location', 200, true),
      startsAt,
      endsAt,
      capacity,
      programmeTags: tagList(data.programmeTags, 'Programme tags'),
      interestTags: tagList(data.interestTags, 'Interest tags'),
      status,
      updatedBy: adminUid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = eventId ? db.collection('events').doc(eventId) : db.collection('events').doc();
    if (eventId) {
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Event not found.');
      await ref.update(patch);
    } else {
      await ref.set({
        ...patch,
        attendeeCount: 0,
        notifiedCount: 0,
        createdBy: adminUid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await db.collection('admin_logs').add({
      adminUid,
      action: eventId ? 'update_event' : 'create_event',
      target: ref.id,
      details: { title: patch.title, status },
      createdAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, eventId: ref.id, status };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('upsertEvent failed', error);
    throw new HttpsError('internal', 'Unable to save this event.');
  }
});

export const setEventStatus = onCall({ region: REGION, ...APP_CHECK_ENFORCEMENT }, async (request) => {
  const adminUid = requireAdmin(request);
  try {
    const eventId = text(request.data?.eventId, 'eventId', 128, true);
    const status = String(request.data?.status ?? '');
    if (!STATUSES.has(status)) throw new HttpsError('invalid-argument', 'Unsupported event status.');

    const ref = db.collection('events').doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Event not found.');

    await ref.update({ status, updatedBy: adminUid, updatedAt: FieldValue.serverTimestamp() });
    await db.collection('admin_logs').add({
      adminUid,
      action: 'set_event_status',
      target: eventId,
      details: { status },
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, status };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('setEventStatus failed', error);
    throw new HttpsError('internal', 'Unable to change the event status.');
  }
});

export const toggleEventRsvp = onCall({ region: REGION, ...APP_CHECK_ENFORCEMENT }, async (request) => {
  const uid = requireActiveMember(request);
  try {
    const eventId = text(request.data?.eventId, 'eventId', 128, true);
    const ref = db.collection('events').doc(eventId);
    const attendee = ref.collection('attendees').doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const [eventSnap, attendeeSnap] = await Promise.all([tx.get(ref), tx.get(attendee)]);
      if (!eventSnap.exists || eventSnap.data()?.status !== 'published') {
        throw new HttpsError('failed-precondition', 'This event is not open for RSVPs.');
      }
      const event = eventSnap.data()!;
      if (attendeeSnap.exists) {
        tx.delete(attendee);
        tx.update(ref, { attendeeCount: FieldValue.increment(-1) });
        return { attending: false };
      }
      if (event.capacity && Number(event.attendeeCount ?? 0) >= Number(event.capacity)) {
        throw new HttpsError('resource-exhausted', 'This event is full.');
      }
      tx.set(attendee, { uid, createdAt: FieldValue.serverTimestamp() });
      tx.update(ref, { attendeeCount: FieldValue.increment(1) });
      return { attending: true };
    });

    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('toggleEventRsvp failed', error);
    throw new HttpsError('internal', 'Unable to update your RSVP.');
  }
});

/**
 * Notifies relevant students the first time an event becomes published.
 *
 * Relevance is a match on programme or career interests, so a data-science
 * workshop reaches data-science students rather than the whole campus. Writing
 * notifiedCount back re-triggers this function, but the before/after status
 * guard makes that second run a no-op.
 */
export const notifyEventPublished = onDocumentWritten({ document: 'events/{eventId}', region: REGION }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || after.status !== 'published' || before?.status === 'published') return;

  const programmeTags = (Array.isArray(after.programmeTags) ? after.programmeTags : []).map(normalise).filter(Boolean);
  const interestTags = (Array.isArray(after.interestTags) ? after.interestTags : []).map(normalise).filter(Boolean);
  const untargeted = !programmeTags.length && !interestTags.length;

  const students = await db.collection('users').where('role', '==', 'student').limit(5000).get();
  const recipients = students.docs
    .filter((doc) => {
      const data = doc.data();
      if (data.accountStatus === 'suspended' || data.accountStatus === 'revoked') return false;
      if (untargeted) return true;
      const programme = normalise(data.programmeOfStudy);
      const programmeMatch = Boolean(programme) && programmeTags.some((tag) => programme.includes(tag) || tag.includes(programme));
      const interests = (Array.isArray(data.careerInterests) ? data.careerInterests : []).map(normalise);
      const interestMatch = interests.some((interest) => interestTags.includes(interest));
      return programmeMatch || interestMatch;
    })
    .map((doc) => doc.id);

  const when = new Date(String(after.startsAt)).toLocaleString('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Johannesburg',
  });

  await sendToUsers(recipients, {
    title: `New event: ${String(after.title ?? 'Richfield event')}`,
    body: `${when} · ${String(after.location ?? '')}`,
    data: { type: 'event', eventId: event.params.eventId },
  });

  await event.data!.after.ref.update({ notifiedCount: recipients.length, notifiedAt: FieldValue.serverTimestamp() });
});
