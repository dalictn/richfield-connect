import admin from 'firebase-admin';

function usage() {
  console.error('Usage: node admin/provision-admin.mjs <admin-email> <temporary-password> [display-name]');
  process.exit(1);
}

const [, , emailArg, password, displayNameArg] = process.argv;
if (!emailArg || !password) usage();

const email = emailArg.trim().toLowerCase();
const displayName = (displayNameArg ?? 'Richfield Administrator').trim();

if (password.length < 12) {
  throw new Error('Use a temporary administrator password of at least 12 characters.');
}

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

try {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    user = await auth.updateUser(user.uid, {
      displayName,
      disabled: false,
      password,
      emailVerified: true,
    });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(user.uid, {
    role: 'administrator',
    isApproved: true,
    accountStatus: 'active',
  });

  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    role: 'administrator',
    email,
    displayName,
    isApproved: true,
    accountStatus: 'active',
    emailVerified: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`Administrator provisioned: ${email} (${user.uid})`);
  console.log('Rotate the temporary password after first sign-in.');
} finally {
  // Do not keep a long-lived credential in the mobile app or source code.
}
