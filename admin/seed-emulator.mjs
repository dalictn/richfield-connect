/**
 * Seeds the Firebase Emulator Suite with one account per role, plus enough
 * supporting data that every screen has something to show.
 *
 * This talks to the emulators only — it refuses to run unless the emulator host
 * variables are set, so it can never touch a real project. Accounts are created
 * with the Admin SDK rather than through the registration callables, so seeding
 * works even when the Functions emulator is not running. The real registration
 * flow stays available to demo separately.
 *
 *   npm run seed
 */
import admin from 'firebase-admin';

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const STORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;

if (!AUTH_HOST || !STORE_HOST) {
  console.error('Refusing to run: FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST must be set.');
  console.error('Use `npm run seed`, which sets them for you.');
  process.exit(1);
}

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'richfield-nexus';
const PASSWORD = 'Richfield#2026';

admin.initializeApp({ projectId: PROJECT_ID });
const auth = admin.auth();
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const OPEN = { public: true, connections: true, students: true, alumni: true, business: true };
const CLOSED = { public: false, connections: false, students: false, alumni: false, business: false };
const CONNECTIONS = { ...CLOSED, connections: true };

const DEFAULT_VISIBILITY = {
  skills: { ...OPEN },
  projects: { ...OPEN },
  careerInterests: { ...OPEN },
  badges: { ...OPEN },
  recommendations: { ...OPEN },
  experience: { ...CONNECTIONS, business: true },
  entrepreneurship: { ...CONNECTIONS, business: true },
  academicRecords: { ...CONNECTIONS },
  activities: { ...CONNECTIONS },
  contactInfo: { ...CONNECTIONS },
};

async function upsertUser({ email, displayName, role, isApproved = true, profile = {} }) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: PASSWORD, displayName, emailVerified: true, disabled: false });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, password: PASSWORD, displayName, emailVerified: true });
  }

  await auth.setCustomUserClaims(user.uid, { role, isApproved, accountStatus: 'active' });
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    role,
    email,
    displayName,
    isApproved,
    accountStatus: 'active',
    emailVerified: true,
    onboardingComplete: true,
    visibility: DEFAULT_VISIBILITY,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
    ...profile,
  }, { merge: true });

  return user.uid;
}

const students = [
  {
    email: 'thabo@my.richfield.ac.za',
    displayName: 'Thabo Nkosi',
    profile: {
      headline: 'Final-year Software Engineering student | React Native',
      summary: 'Final-year software engineering student building cross-platform mobile products. Interested in fintech and developer tooling, and looking for a graduate role in 2026.',
      campusLocation: 'Johannesburg',
      programmeOfStudy: 'BSc Information Technology',
      yearOfEnrolment: 2023,
      skills: ['react native', 'typescript', 'firebase', 'node.js'],
      gitHubUrl: 'https://github.com/example-thabo',
      linkedInUrl: 'https://linkedin.com/in/example-thabo',
      credlyUrl: 'https://www.credly.com/users/example-thabo',
      careerInterests: ['mobile engineering', 'fintech', 'developer tooling'],
      careerAspirations: 'Join a product team building consumer fintech, and mentor first-year students along the way.',
      certifications: [
        { name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', year: 2025 },
      ],
      gitHubProjects: [
        { name: 'campus-timetable', url: 'https://github.com/example-thabo/campus-timetable', description: 'Offline-first timetable app used by 300 students.' },
        { name: 'stokvel-ledger', url: 'https://github.com/example-thabo/stokvel-ledger', description: 'Shared savings ledger with reconciliation.' },
      ],
      deployedProjects: [
        { name: 'Richfield Society Hub', url: 'https://example-society-hub.web.app', description: 'Event listing site for campus societies.' },
      ],
      digitalBadges: [
        { name: 'Firebase Fundamentals', issuer: 'Google', issuedYear: 2025, url: 'https://www.credly.com/badges/example' },
      ],
      achievements: [
        { title: 'Dean\u2019s Merit List', issuer: 'Richfield', year: 2025, description: 'Top 5% of the programme cohort.' },
      ],
      leadershipRoles: [
        { role: 'Class Representative', organisation: 'BSc IT, Johannesburg campus', startYear: 2025, description: 'Represents 120 students in faculty meetings.' },
      ],
      activities: [
        { name: 'Richfield Hackathon 2026', type: 'hackathon', year: 2026 },
        { name: 'Coding Society', type: 'society', year: 2024 },
        { name: 'Code for Community', type: 'volunteer', year: 2025, description: 'Weekend coding classes for local high schools.' },
      ],
      entrepreneurialExperience: [
        { name: 'Nkosi Digital', role: 'Founder', description: 'Freelance studio building websites for small Johannesburg businesses.', startYear: 2024, url: 'https://example-nkosi.digital' },
      ],
    },
  },
  {
    email: 'aisha@my.aaa.ac.za',
    displayName: 'Aisha Patel',
    profile: {
      headline: 'Data Science student | Python, SQL',
      summary: 'Data science student focused on applied machine learning and analytics for the South African public sector.',
      campusLocation: 'Durban',
      programmeOfStudy: 'BSc Data Science',
      yearOfEnrolment: 2024,
      skills: ['python', 'sql', 'pandas', 'machine learning'],
      // Deliberately private, so the directory demonstrates redaction.
      visibility: { skills: 'connections', experience: 'private', contactInfo: 'private', academicRecords: 'private' },
    },
  },
];

async function main() {
  console.log(`Seeding emulators for project "${PROJECT_ID}"…\n`);

  const studentUids = [];
  for (const student of students) {
    studentUids.push(await upsertUser({ email: student.email, displayName: student.displayName, role: 'student', profile: student.profile }));
  }

  const alumniUid = await upsertUser({
    email: 'lerato.alumni@gmail.com',
    displayName: 'Lerato Mokoena',
    role: 'alumni',
    profile: {
      headline: 'Software Engineer at Standard Bank | Richfield alumna',
      summary: 'Graduated in 2021 and now building payment systems. Happy to mentor current students.',
      campusLocation: 'Johannesburg',
      programmeOfStudy: 'BSc Information Technology',
      studentNumber: 'RF2018001',
      skills: ['java', 'spring boot', 'sql', 'react native'],
      workExperience: [
        { company: 'Standard Bank', role: 'Software Engineer', startDate: '2021-03', description: 'Payments platform engineering.' },
        { company: 'Dimension Data', role: 'Graduate Developer', startDate: '2019-02', endDate: '2021-02', description: 'Internal tooling and integrations.' },
      ],
      graduationYear: 2021,
      yearOfEnrolment: 2018,
      careerInterests: ['payments', 'platform engineering', 'mentorship'],
    },
  });

  const businessUid = await upsertUser({
    email: 'recruiter@tech-corp.co.za',
    displayName: 'Naledi Dlamini',
    role: 'business',
    profile: {
      companyName: 'TechCorp South Africa',
      industry: 'Software & Technology',
      companyDescription: 'A Johannesburg software house hiring graduate mobile and data engineers.',
      companyLocation: 'Johannesburg',
      companyWebsite: 'https://example.co.za',
      contactName: 'Naledi Dlamini',
      contactPhone: '+27 11 000 0000',
    },
  });

  const adminUid = await upsertUser({
    email: 'admin@richfield.ac.za',
    displayName: 'Richfield Administrator',
    role: 'administrator',
  });

  // Alumni registry row matching Lerato, so the real alumni verification flow
  // can be demonstrated end to end against the emulator.
  await db.collection('alumni_registry').doc('RF2018001').set({
    fullName: 'Lerato Mokoena',
    studentNumber: 'RF2018001',
    personalEmail: 'lerato.alumni@gmail.com',
    nationalId: '9501015800083',
    birthdate: '1995-01-01',
  });

  // One pending listing so the administrator approval queue is not empty, and
  // one already approved so students see something on the opportunity board.
  await db.collection('opportunities').doc('seed-pending').set({
    ownerUid: businessUid,
    companyName: 'TechCorp South Africa',
    title: 'Graduate Mobile Engineer',
    description: 'Twelve-month graduate programme building React Native products for South African banks.',
    type: 'graduate',
    location: 'Johannesburg',
    remote: false,
    requiredSkills: ['react native', 'typescript', 'firebase'],
    programmeTags: ['bsc information technology'],
    status: 'pending',
    applicantCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('opportunities').doc('seed-approved').set({
    ownerUid: businessUid,
    companyName: 'TechCorp South Africa',
    title: 'Data Analyst Internship',
    description: 'Six-month internship working with the analytics team on reporting pipelines.',
    type: 'internship',
    location: 'Durban',
    remote: true,
    requiredSkills: ['python', 'sql'],
    programmeTags: ['bsc data science'],
    status: 'approved',
    applicantCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Skill demand so the student analytics dashboard has bars to draw.
  for (const [skill, count] of [['react native', 14], ['python', 11], ['typescript', 9], ['sql', 7], ['firebase', 5]]) {
    await db.collection('skill_demand').doc(skill).set({ skill, count, lastSearchedAt: now, lastSearchedBy: businessUid });
  }

  // A recommendation from the alumna to the student, so the section renders.
  await db.collection('users').doc(studentUids[0]).collection('recommendations').doc(alumniUid).set({
    authorUid: alumniUid,
    authorName: 'Lerato Mokoena',
    authorHeadline: 'Software Engineer at Standard Bank | Richfield alumna',
    authorRole: 'alumni',
    relationship: 'Mentor',
    body: 'I mentored Thabo through the 2025 hackathon. He shipped a working offline-first app in a weekend and, more tellingly, was the person the rest of the team went to when they were stuck. He would do well on any graduate mobile team.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  console.log('Seeded accounts — every one uses the same password:\n');
  const rows = [
    ['Student', 'thabo@my.richfield.ac.za', studentUids[0]],
    ['Student', 'aisha@my.aaa.ac.za', studentUids[1]],
    ['Alumni', 'lerato.alumni@gmail.com', alumniUid],
    ['Business', 'recruiter@tech-corp.co.za', businessUid],
    ['Administrator', 'admin@richfield.ac.za', adminUid],
  ];
  for (const [role, email, uid] of rows) {
    console.log(`  ${role.padEnd(14)} ${email.padEnd(30)} ${uid}`);
  }
  console.log(`\n  Password: ${PASSWORD}`);
  console.log('\nAlso seeded: 1 alumni registry record (student number RF2018001),');
  console.log('2 opportunities (1 pending approval, 1 live), 5 skill-demand rows,');
  console.log('a full portfolio for Thabo (projects, certifications, badges, awards,');
  console.log('leadership, societies, venture) and 1 recommendation from Lerato.');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('\nSeeding failed:', error?.message ?? error);
  process.exit(1);
});
