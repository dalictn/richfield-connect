import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  callFunction,
  completeEmailLink,
  createPasswordUser,
  currentUser,
  getCurrentUserIdToken,
  firebaseProjectId,
  isEmailLink,
  login as firebaseLogin,
  readUserProfile,
  refreshCurrentUser,
  removeCurrentUser,
  sendEmailLink,
  sendVerificationEmail,
  signOutCurrentUser,
} from '../firebaseApi';
import { assertAllowedStudentEmail, isValidEmail, normalizeEmail } from './domainValidation';
import type { BusinessRegistration, UserProfile } from '../types/auth';

const PENDING_EMAIL_KEY = 'richfield.alumni.pendingEmail';
const PENDING_SESSION_KEY = 'richfield.alumni.pendingSession';

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function getEmailLinkActionSettings() {
  const projectId = firebaseProjectId();

  return {
    url: `https://${projectId}.firebaseapp.com/alumni-finish`,
    handleCodeInApp: true,
    android: {
      packageName: 'za.ac.richfield.connect',
      installApp: true,
      minimumVersion: '1',
    },
    iOS: {
      bundleId: 'za.ac.richfield.connect',
    },
  };
}

export async function login(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid email address.');
  if (!password) throw new Error('Password is required.');
  return firebaseLogin(normalizedEmail, password);
}

export async function registerStudent(email: string, password: string, displayName: string) {
  const normalizedEmail = normalizeEmail(email);
  assertAllowedStudentEmail(normalizedEmail);
  const name = requireNonEmpty(displayName, 'Full name');

  if (password.length < 8) throw new Error('Password must contain at least 8 characters.');

  const user = await createPasswordUser(normalizedEmail, password);
  try {
    await sendVerificationEmail();
    await AsyncStorage.setItem('richfield.student.pendingDisplayName', name);
    return user;
  } catch (error) {
    await removeCurrentUser().catch(() => undefined);
    throw error;
  }
}

export async function completeStudentRegistration(): Promise<void> {
  const displayName = await AsyncStorage.getItem('richfield.student.pendingDisplayName');
  if (!displayName) throw new Error('Student registration session has expired. Please register again.');

  const user = await refreshCurrentUser();
  if (!user) throw new Error('Sign in again to complete registration.');
  if (!user.emailVerified) throw new Error('Your institutional email is not verified yet.');

  await callFunction<{ displayName: string }, { ok: true }>('finalizeStudentRegistration', { displayName });
  await getCurrentUserIdToken(true);
  await AsyncStorage.removeItem('richfield.student.pendingDisplayName');
}

export async function registerBusiness(email: string, password: string, registration: BusinessRegistration) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid business email address.');
  if (password.length < 8) throw new Error('Password must contain at least 8 characters.');

  await callFunction<{ email: string }, { ok: true }>('createBusinessRegistrationIntent', { email: normalizedEmail });
  const user = await createPasswordUser(normalizedEmail, password);

  try {
    await sendVerificationEmail();
    await callFunction<BusinessRegistration, { ok: true; isApproved: false }>('finalizeBusinessRegistration', registration);
    await getCurrentUserIdToken(true);
    return user;
  } catch (error) {
    await removeCurrentUser().catch(() => undefined);
    throw error;
  }
}

export async function beginAlumniVerification(
  personalEmail: string,
  studentNumber: string,
  nationalId?: string,
  birthdate?: string,
) {
  const normalizedEmail = normalizeEmail(personalEmail);
  if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid personal email address.');
  const normalizedStudentNumber = requireNonEmpty(studentNumber, 'Former student number');

  const response = await callFunction<
    { personalEmail: string; studentNumber: string; nationalId?: string; birthdate?: string },
    { accepted: true; message: string; verificationSession?: string }
  >('verifyAlumniCredentials', {
    personalEmail: normalizedEmail,
    studentNumber: normalizedStudentNumber,
    nationalId: nationalId?.trim() || undefined,
    birthdate: birthdate?.trim() || undefined,
  });

  if (!response.verificationSession) return false;

  await AsyncStorage.multiSet([
    [PENDING_EMAIL_KEY, normalizedEmail],
    [PENDING_SESSION_KEY, response.verificationSession],
  ]);

  await sendEmailLink(normalizedEmail, getEmailLinkActionSettings());
  return true;
}

export async function handleIncomingAlumniEmailLink(url: string): Promise<UserProfile | null> {
  if (!isEmailLink(url)) return null;

  const pendingEmail = await AsyncStorage.getItem(PENDING_EMAIL_KEY);
  const verificationSession = await AsyncStorage.getItem(PENDING_SESSION_KEY);
  if (!pendingEmail || !verificationSession) {
    throw new Error('This verification link has no active registration session on this device.');
  }

  await completeEmailLink(pendingEmail, url);
  await callFunction<{ verificationSession: string }, { ok: true }>('finalizeAlumniRegistration', { verificationSession });
  await getCurrentUserIdToken(true);

  await AsyncStorage.multiRemove([PENDING_EMAIL_KEY, PENDING_SESSION_KEY]);
  return getCurrentUserProfile();
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = currentUser();
  if (!user) return null;
  return readUserProfile<UserProfile>(user.uid);
}

export async function logout(): Promise<void> {
  await signOutCurrentUser();
}
