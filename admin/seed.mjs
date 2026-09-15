/**
 * Seeds one account per role plus enough supporting data that every screen has
 * something to show.
 *
 * Two targets:
 *   npm run seed              -> the Firebase Emulator Suite (safe, in-memory)
 *   npm run seed:production   -> the live project, for a shared demo preview
 *
 * Production seeding is deliberately awkward to trigger by accident: it needs
 * the --production flag AND application-default or service-account credentials,
 * and it refuses to run if emulator host variables are set, so a stray shell
 * export cannot silently redirect it.
 *
 * Accounts are created with the Admin SDK rather than through the registration
 * callables, so seeding works without the Functions emulator and bypasses the
 * institutional-domain blocking trigger for the non-student demo accounts. The
 * real registration flow stays available to demo separately.
 */
import admin from 'firebase-admin';

const PRODUCTION = process.argv.includes('--production');
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const STORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'richfield-nexus';

if (PRODUCTION) {
  if (AUTH_HOST || STORE_HOST) {
    console.error('Refusing to run: --production was passed but emulator host variables are set.');
    console.error('Unset FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST first.');
    process.exit(1);
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error('Refusing to run: no admin credentials found.');
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON downloaded from');
    console.error('Firebase console -> Project settings -> Service accounts -> Generate new private key.');
    process.exit(1);
  }
  console.warn(`\n  ! Seeding the LIVE project "${PROJECT_ID}" with demo accounts.`);
  console.warn('  ! These credentials are shared and publicly usable. Remove them after the demo.\n');
} else if (!AUTH_HOST || !STORE_HOST) {
  console.error('Refusing to run: FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST must be set.');
  console.error('Use `npm run seed`, or pass --production to target the live project.');
  process.exit(1);
}

const PASSWORD = process.env.SEED_PASSWORD || 'Richfield#2026';

admin.initializeApp(PRODUCTION ? { projectId: PROJECT_ID } : { projectId: PROJECT_ID });
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
    // Re-seeding resets the guided tour so it shows again in the demo.
    tutorialCompleted: false,
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
  console.log(`Seeding ${PRODUCTION ? 'LIVE PROJECT' : 'emulators'} "${PROJECT_ID}"…\n`);

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

  // Alumni who share their work history, so the career pathway explorer has
  // real journeys to show for BSc Information Technology.
  const SHARED_EXPERIENCE = { ...DEFAULT_VISIBILITY, experience: { ...OPEN } };
  await db.collection('users').doc(alumniUid).set({ visibility: SHARED_EXPERIENCE }, { merge: true });

  const siphoUid = await upsertUser({
    email: 'sipho.alumni@gmail.com',
    displayName: 'Sipho Dube',
    role: 'alumni',
    profile: {
      headline: 'Solutions Architect at Amazon Web Services',
      summary: 'Richfield BSc IT graduate who moved from DevOps into cloud architecture.',
      campusLocation: 'Durban',
      programmeOfStudy: 'BSc Information Technology',
      fieldOfWork: 'Cloud engineering',
      graduationYear: 2019,
      yearOfEnrolment: 2016,
      skills: ['aws', 'terraform', 'kubernetes', 'python'],
      visibility: SHARED_EXPERIENCE,
      workExperience: [
        { company: 'Amazon Web Services', role: 'Solutions Architect', startDate: '2022-04', description: 'Designs cloud platforms for African enterprise customers.' },
        { company: 'Takealot', role: 'DevOps Engineer', startDate: '2019-02', endDate: '2022-03', description: 'CI/CD and infrastructure for the e-commerce platform.' },
      ],
    },
  });

  const zaneleUid = await upsertUser({
    email: 'zanele.alumni@gmail.com',
    displayName: 'Zanele Khumalo',
    role: 'alumni',
    profile: {
      headline: 'Product Manager at Yoco',
      summary: 'Started in data analytics after Richfield and moved into product.',
      campusLocation: 'Cape Town',
      programmeOfStudy: 'BSc Information Technology',
      fieldOfWork: 'Product and data',
      graduationYear: 2020,
      yearOfEnrolment: 2017,
      skills: ['sql', 'product management', 'analytics'],
      visibility: SHARED_EXPERIENCE,
      workExperience: [
        { company: 'Yoco', role: 'Product Manager', startDate: '2023-02', description: 'Owns the merchant payments experience.' },
        { company: 'Discovery', role: 'Data Analyst', startDate: '2020-03', endDate: '2023-01', description: 'Member engagement analytics.' },
      ],
    },
  });

  // Institutional events: one published and targeted, one draft for the admin demo.
  const inDays = (days, hour) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
  await db.collection('events').doc('seed-event-careers').set({
    title: 'Tech Careers Fair 2026',
    description: 'Meet employers hiring Richfield graduates across software, cloud and data. Bring your CV and your GitHub.',
    type: 'career-fair',
    location: 'Johannesburg campus, Main Hall',
    startsAt: inDays(3, 10),
    endsAt: inDays(3, 15),
    capacity: 250,
    programmeTags: ['bsc information technology'],
    interestTags: ['mobile engineering', 'fintech'],
    status: 'published',
    attendeeCount: 0,
    notifiedCount: 0,
    createdBy: adminUid,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('events').doc('seed-event-cv-clinic').set({
    title: 'CV Clinic with TechCorp',
    description: 'One-on-one CV reviews with TechCorp recruiters.',
    type: 'workshop',
    location: 'Online',
    startsAt: inDays(10, 14),
    endsAt: null,
    capacity: 40,
    programmeTags: [],
    interestTags: [],
    status: 'draft',
    attendeeCount: 0,
    notifiedCount: 0,
    createdBy: adminUid,
    createdAt: now,
    updatedAt: now,
  });

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

  // --- Social demo data --------------------------------------------------------
  // Written in the same shape the social Cloud Functions write, so every screen
  // reads it exactly as it would read live activity. Fixed ids keep re-seeding
  // idempotent. Thabo and Aisha are deliberately NOT connected: demo step 4
  // connects them live to show connections-only fields appearing.
  const ago = (hours) => admin.firestore.Timestamp.fromMillis(Date.now() - hours * 60 * 60 * 1000);
  const people = {
    thabo: { uid: studentUids[0], role: 'student', name: 'Thabo Nkosi' },
    aisha: { uid: studentUids[1], role: 'student', name: 'Aisha Patel' },
    lerato: { uid: alumniUid, role: 'alumni', name: 'Lerato Mokoena' },
    sipho: { uid: siphoUid, role: 'alumni', name: 'Sipho Dube' },
    zanele: { uid: zaneleUid, role: 'alumni', name: 'Zanele Khumalo' },
    naledi: { uid: businessUid, role: 'business', name: 'Naledi Dlamini' },
  };

  const connectionPairs = [
    ['thabo', 'lerato'], ['thabo', 'sipho'], ['thabo', 'zanele'], ['thabo', 'naledi'],
    ['lerato', 'sipho'], ['lerato', 'zanele'], ['sipho', 'zanele'], ['lerato', 'naledi'],
    ['aisha', 'zanele'], ['aisha', 'sipho'],
  ];
  const adjacency = new Map(Object.keys(people).map((key) => [key, new Set()]));
  for (const [index, [a, b]] of connectionPairs.entries()) {
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
    const connectedAt = ago(24 * (10 + index));
    await db.collection('connections').doc(people[a].uid).collection('members').doc(people[b].uid).set({ uid: people[b].uid, status: 'accepted', connectedAt });
    await db.collection('connections').doc(people[b].uid).collection('members').doc(people[a].uid).set({ uid: people[a].uid, status: 'accepted', connectedAt });
  }

  // Mirrors relevanceScore in functions/src/social.ts.
  const ROLE_AFFINITY = {
    student: { student: 1.0, alumni: 1.4, business: 1.5, administrator: 0.3 },
    alumni: { student: 1.2, alumni: 1.4, business: 1.5, administrator: 0.3 },
    business: { student: 1.5, alumni: 1.6, business: 1.0, administrator: 0.4 },
    administrator: { student: 1, alumni: 1, business: 1, administrator: 1 },
  };
  const feedScore = (viewerRole, authorRole, createdAt, reactions, comments) => {
    const ageHours = Math.max(0, (Date.now() - createdAt.toMillis()) / 3600000);
    return ROLE_AFFINITY[viewerRole][authorRole] * 100 + Math.exp(-ageHours / 72) * 40 + reactions * 2 + comments * 3;
  };

  const posts = [
    {
      id: 'seed-post-lerato-grad-programme', author: 'lerato', hours: 5,
      body: "Standard Bank's graduate developer programme opens next month. If you're a final-year BSc IT student, get your GitHub tidy now — we look at real projects before we look at marks. Happy to review portfolios for Richfield students.",
      reactions: [['thabo', 'like'], ['sipho', 'celebrate'], ['zanele', 'like']],
      comments: [['thabo', 'Would love a review of my offline-first timetable app — thank you for offering!'], ['zanele', 'Seconding this. A clear README made the difference for me.']],
    },
    {
      id: 'seed-post-thabo-hackathon', author: 'thabo', hours: 20,
      body: "Shipped an offline-first campus timetable app with React Native and Firebase this weekend. It syncs when you're back online and 300 students are already using it. Biggest lesson: design for bad connectivity first.",
      reactions: [['lerato', 'celebrate'], ['sipho', 'insightful'], ['naledi', 'like'], ['zanele', 'celebrate']],
      comments: [['lerato', 'This is exactly the kind of project that stands out. Well done, Thabo.'], ['naledi', 'Great work — our graduate mobile role would suit you. Have a look in Opportunities.']],
    },
    {
      id: 'seed-post-naledi-hiring', author: 'naledi', hours: 30,
      body: 'TechCorp South Africa is hiring graduate mobile engineers in Johannesburg. We care about shipped projects, clear communication and curiosity. The listing is live on Richfield Connect — apply through Opportunities.',
      reactions: [['thabo', 'like'], ['lerato', 'like']],
      comments: [['thabo', 'Just applied. Excited about this one!']],
    },
    {
      id: 'seed-post-sipho-study-group', author: 'sipho', hours: 44,
      body: 'Running a free AWS Cloud Practitioner study group for Richfield students on Thursday evenings, online. Six weeks, with a practice exam at the end. Comment if you want in.',
      reactions: [['aisha', 'like'], ['thabo', 'insightful'], ['zanele', 'like']],
      comments: [['aisha', 'Count me in — I sit the exam in November.'], ['thabo', 'In! Is there a sign-up link?'], ['sipho', "I'll message everyone who commented with the invite."]],
    },
    {
      id: 'seed-post-zanele-career-story', author: 'zanele', hours: 60,
      body: 'Career story: I graduated from Richfield in 2020, spent three years as a data analyst at Discovery, then moved into product at Yoco. The SQL I learnt in second year still pays my bills. Ask me anything about switching from data into product.',
      reactions: [['aisha', 'insightful'], ['lerato', 'celebrate'], ['sipho', 'like'], ['thabo', 'insightful']],
      comments: [['aisha', 'What helped most when you moved into product?'], ['zanele', 'Owning one small feature end to end, then showing the numbers before and after.']],
    },
    {
      id: 'seed-post-aisha-certificate', author: 'aisha', hours: 72,
      body: 'Earned my Google Data Analytics certificate today. Next up: AWS Cloud Practitioner. Thanks to everyone who shared study notes.',
      reactions: [['zanele', 'celebrate'], ['sipho', 'celebrate']],
      comments: [['zanele', 'Congratulations, Aisha! Well deserved.']],
    },
  ];

  for (const post of posts) {
    const author = people[post.author];
    const createdAt = ago(post.hours);
    const postRef = db.collection('posts').doc(post.id);
    await postRef.set({
      uid: author.uid, authorRole: author.role, authorDisplayName: author.name, body: post.body,
      reactionCount: post.reactions.length, commentCount: post.comments.length, createdAt, updatedAt: createdAt,
    });
    for (const [key, reaction] of post.reactions) {
      await postRef.collection('reactions').doc(people[key].uid).set({ uid: people[key].uid, reaction, createdAt });
    }
    for (const [index, [key, body]] of post.comments.entries()) {
      await postRef.collection('comments').doc(`seed-comment-${index + 1}`).set({ uid: people[key].uid, body, createdAt: ago(post.hours - (index + 1) * 0.5) });
    }
    // Fan out to the author and their connections, as createPost does.
    for (const viewer of [post.author, ...adjacency.get(post.author)]) {
      await db.collection('feeds').doc(people[viewer].uid).collection('items').doc(post.id).set({
        postId: post.id, authorUid: author.uid, authorRole: author.role, authorDisplayName: author.name,
        score: feedScore(people[viewer].role, author.role, createdAt, post.reactions.length, post.comments.length),
        createdAt, updatedAt: createdAt,
      });
    }
  }

  // A mentoring conversation, so Messages has a real thread to open.
  const thread = [
    ['lerato', 'Hi Thabo, saw your timetable app post. Want to do a quick portfolio review this week?', 19],
    ['thabo', 'Yes please! Would Thursday after 5 work?', 18.5],
    ['lerato', "Thursday works. Send me your GitHub link and the one project you're proudest of.", 18],
    ['thabo', 'Done — campus-timetable is the one. Thanks, Lerato!', 17.5],
  ];
  const conversationRef = db.collection('conversations').doc([people.thabo.uid, people.lerato.uid].sort().join('_'));
  for (const [index, [key, body, hours]] of thread.entries()) {
    await conversationRef.collection('messages').doc(`seed-message-${index + 1}`).set({ senderUid: people[key].uid, body, createdAt: ago(hours) });
  }
  const lastMessage = thread[thread.length - 1];
  await conversationRef.set({
    memberUids: [people.thabo.uid, people.lerato.uid],
    lastMessage: lastMessage[1].slice(0, 160), lastMessageAt: ago(lastMessage[2]), updatedAt: ago(lastMessage[2]),
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
  console.log('Social: 10 connections (Thabo and Aisha left unconnected for the demo), 6 posts with');
  console.log('reactions and comments, and a Thabo–Lerato conversation.');
  console.log('Career pathways: Lerato, Sipho and Zanele (BSc IT). Events: 1 published, 1 draft.');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('\nSeeding failed:', error?.message ?? error);
  process.exit(1);
});
