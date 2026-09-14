import { collection, doc, getDoc, getFirestore, onSnapshot, orderBy, query, where } from '@react-native-firebase/firestore';
import { callFunction } from '../firebaseApi';

export type EventType = 'career-fair' | 'workshop' | 'networking' | 'info-session' | 'other';
export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface InstitutionalEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  location: string;
  startsAt: string;
  endsAt?: string | null;
  capacity?: number | null;
  programmeTags: string[];
  interestTags: string[];
  status: EventStatus;
  attendeeCount: number;
  notifiedCount?: number;
}

export interface EventInput {
  eventId?: string;
  title: string;
  description: string;
  type: EventType;
  location: string;
  startsAt: string;
  endsAt?: string | null;
  capacity?: number | null;
  programmeTags: string[];
  interestTags: string[];
  status: EventStatus;
}

export const EVENT_TYPES: Array<{ value: EventType; label: string; icon: string }> = [
  { value: 'career-fair', label: 'Career fair', icon: 'domain' },
  { value: 'workshop', label: 'Workshop', icon: 'hammer-wrench' },
  { value: 'networking', label: 'Networking', icon: 'account-group' },
  { value: 'info-session', label: 'Info session', icon: 'information-outline' },
  { value: 'other', label: 'Other', icon: 'calendar' },
];

type Snapshot = { docs: Array<{ id: string; data(): unknown }> };

const db = getFirestore();

function mapEvents(snap: Snapshot): InstitutionalEvent[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InstitutionalEvent, 'id'>) }));
}

/** Everyone except administrators may only read published events. */
export function subscribePublishedEvents(onNext: (items: InstitutionalEvent[]) => void, onError: (error: Error) => void): () => void {
  const q = query(collection(db, 'events'), where('status', '==', 'published'), orderBy('startsAt', 'asc'));
  return onSnapshot(q, (snap: Snapshot) => onNext(mapEvents(snap)), onError);
}

/** Administrators only — Firestore rules reject this for any other role. */
export function subscribeAllEvents(onNext: (items: InstitutionalEvent[]) => void, onError: (error: Error) => void): () => void {
  const q = query(collection(db, 'events'), orderBy('startsAt', 'asc'));
  return onSnapshot(q, (snap: Snapshot) => onNext(mapEvents(snap)), onError);
}

export async function isAttending(eventId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'events', eventId, 'attendees', uid));
  return snap.exists();
}

export const upsertEvent = (input: EventInput) =>
  callFunction<EventInput, { ok: boolean; eventId: string; status: EventStatus }>('upsertEvent', input);

export const setEventStatus = (eventId: string, status: EventStatus) =>
  callFunction<{ eventId: string; status: EventStatus }, { ok: boolean; status: EventStatus }>('setEventStatus', { eventId, status });

export const toggleEventRsvp = (eventId: string) =>
  callFunction<{ eventId: string }, { ok: boolean; attending: boolean }>('toggleEventRsvp', { eventId });

export function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function eventTypeLabel(type: string): string {
  return EVENT_TYPES.find((item) => item.value === type)?.label ?? 'Event';
}
