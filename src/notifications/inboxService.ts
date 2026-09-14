import { collection, doc, getFirestore, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from '@react-native-firebase/firestore';

/**
 * In-app notifications, written server-side into users/{uid}/notifications.
 *
 * A Firestore listener delivers them in real time on every platform, including
 * web where device push is unavailable, so alerts are visible during a demo
 * without any polling.
 */

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt?: unknown;
}

type Snapshot = { docs: Array<{ id: string; data(): unknown }> };

const db = getFirestore();

export function subscribeInbox(uid: string, onNext: (items: InboxItem[]) => void, onError: (error: Error) => void): () => void {
  const q = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap: Snapshot) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InboxItem, 'id'>) }))),
    onError,
  );
}

export function markRead(uid: string, id: string): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true });
}

export async function markAllRead(uid: string, items: InboxItem[]): Promise<void> {
  const unread = items.filter((item) => !item.read);
  if (!unread.length) return;
  const batch = writeBatch(db);
  for (const item of unread) batch.update(doc(db, 'users', uid, 'notifications', item.id), { read: true });
  await batch.commit();
}

export function toMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const candidate = value as { toMillis?: () => number; seconds?: number };
  if (typeof candidate.toMillis === 'function') return candidate.toMillis();
  if (typeof candidate.seconds === 'number') return candidate.seconds * 1000;
  return 0;
}

export function timeAgo(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return '';
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
