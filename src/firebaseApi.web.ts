import { initializeApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendEmailVerification,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getFirestore, onSnapshot } from 'firebase/firestore';
import { assertWebFirebaseConfig, WEB_FIREBASE_CONFIG } from './firebase';

assertWebFirebaseConfig();
const app = getApps().length ? getApps()[0] : initializeApp(WEB_FIREBASE_CONFIG);
const auth = getAuth(app);
const functions = getFunctions(app, 'africa-south1');
const db = getFirestore(app);

export function getWebFirebaseApp() {
  return app;
}

export function firebaseProjectId(): string {
  return WEB_FIREBASE_CONFIG.projectId;
}

export interface ClientUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  reload(): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string>;
  delete(): Promise<void>;
}

export function currentUser(): ClientUser | null {
  return auth.currentUser;
}

export function subscribeAuth(callback: (user: ClientUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function login(email: string, password: string): Promise<ClientUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function createPasswordUser(email: string, password: string): Promise<ClientUser> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function removeCurrentUser(): Promise<void> {
  const user = auth.currentUser;
  if (user) await deleteUser(user);
}

export async function sendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user is available.');
  await sendEmailVerification(user);
}

export async function refreshCurrentUser(): Promise<ClientUser | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  return auth.currentUser;
}

export async function getCurrentUserIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication is required.');
  return user.getIdToken(forceRefresh);
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
}

export async function sendEmailLink(email: string, settings: Parameters<typeof sendSignInLinkToEmail>[2]): Promise<void> {
  await sendSignInLinkToEmail(auth, email, settings);
}

export function isEmailLink(url: string): boolean {
  return isSignInWithEmailLink(auth, url);
}

export async function completeEmailLink(email: string, url: string): Promise<ClientUser> {
  const credential = await signInWithEmailLink(auth, email, url);
  return credential.user;
}

export async function callFunction<TRequest, TResponse>(name: string, data: TRequest): Promise<TResponse> {
  const callable = httpsCallable<TRequest, TResponse>(functions, name);
  const response = await callable(data);
  return response.data;
}

export async function readUserProfile<T>(uid: string): Promise<T | null> {
  const snapshot = await getDoc(doc(collection(db, 'users'), uid));
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

export function subscribeUserProfile<T>(uid: string, onNext: (profile: T | null) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(
    doc(collection(db, 'users'), uid),
    (snapshot) => onNext(snapshot.exists() ? (snapshot.data() as T) : null),
    onError,
  );
}

export async function createAnnouncement(input: { title: string; body: string; targetRole: string }): Promise<{ ok: boolean; announcementId: string }> { return callFunction<typeof input, { ok: boolean; announcementId: string }>('createAnnouncement', input); }
