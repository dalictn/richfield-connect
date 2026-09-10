export type UserRole = 'student' | 'alumni' | 'business' | 'administrator';

/**
 * Per-section audience control.
 *
 * `public` means any authenticated member. The remaining flags grant one
 * specific audience, so a student can expose skills to employers while keeping
 * work history to connections. Everything defaults to closed.
 *
 * Mirrors functions/src/profileVisibility.ts — the server is the boundary, this
 * is only the shape the editor manipulates.
 */
export interface SectionAudience {
  public: boolean;
  connections: boolean;
  students: boolean;
  alumni: boolean;
  business: boolean;
}

export const PROFILE_SECTIONS = [
  'skills',
  'experience',
  'academicRecords',
  'contactInfo',
  'projects',
  'entrepreneurship',
  'activities',
  'careerInterests',
  'badges',
  'recommendations',
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];
export type ProfileVisibility = Record<ProfileSection, SectionAudience>;

/** Human labels for the visibility editor. */
export const SECTION_LABELS: Record<ProfileSection, string> = {
  skills: 'Skills and endorsements',
  experience: 'Work experience',
  academicRecords: 'Qualifications, certifications and awards',
  contactInfo: 'Contact details and CV',
  projects: 'Projects and repositories',
  entrepreneurship: 'Entrepreneurial experience',
  activities: 'Leadership and activities',
  careerInterests: 'Career interests',
  badges: 'Digital badges',
  recommendations: 'Recommendations',
};

export interface Qualification {
  title: string;
  institution: string;
  yearCompleted: number;
}

export interface WorkExperience {
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  description: string;
}

/** Professional certifications, e.g. AWS Certified Developer. */
export interface Certification {
  name: string;
  issuer: string;
  year: number;
  credentialUrl?: string;
}

/** Digital badges, typically issued through Credly or a similar platform. */
export interface DigitalBadge {
  name: string;
  issuer: string;
  issuedYear?: number;
  url?: string;
}

/** A GitHub repository, or a deployed website / application with a live URL. */
export interface ProjectLink {
  name: string;
  url: string;
  description?: string;
}

/** Businesses founded, start-ups, freelance work, innovations, ventures. */
export interface VentureExperience {
  name: string;
  role: string;
  description: string;
  startYear: number;
  endYear?: number;
  url?: string;
}

/** Academic achievements, scholarships, awards and recognitions. */
export interface Achievement {
  title: string;
  issuer?: string;
  year: number;
  description?: string;
}

/** SRC, class representative, mentor, student ambassador and similar. */
export interface LeadershipRole {
  role: string;
  organisation: string;
  startYear: number;
  endYear?: number;
  description?: string;
}

export type ActivityType =
  | 'club'
  | 'society'
  | 'hackathon'
  | 'competition'
  | 'innovation-challenge'
  | 'entrepreneurship-hub'
  | 'volunteer'
  | 'community'
  | 'other';

export const ACTIVITY_TYPES: ActivityType[] = [
  'club', 'society', 'hackathon', 'competition',
  'innovation-challenge', 'entrepreneurship-hub', 'volunteer', 'community', 'other',
];

/** Clubs, societies, hackathons, competitions, volunteering, community work. */
export interface Activity {
  name: string;
  type: ActivityType;
  year?: number;
  description?: string;
}

export interface Endorsement {
  skill: string;
  endorsedBy: string;
  timestamp: number;
}

/**
 * A written recommendation or testimonial left on someone else's profile.
 * Stored at users/{uid}/recommendations/{authorUid} — one per author, so
 * re-submitting edits the existing entry rather than stacking duplicates.
 */
export interface Recommendation {
  id: string;
  authorUid: string;
  authorName: string;
  authorHeadline?: string;
  authorRole: UserRole;
  /** How the author knows the subject: mentor, supervisor, lecturer, employer… */
  relationship: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export const RELATIONSHIPS = [
  'Lecturer', 'Mentor', 'Supervisor', 'Employer', 'Colleague', 'Client', 'Peer',
] as const;

export type CampusLocation = 'Durban' | 'Johannesburg' | 'Cape Town' | 'Pretoria' | 'Distance Learning';

export const CAMPUS_LOCATIONS: CampusLocation[] = [
  'Durban', 'Johannesburg', 'Cape Town', 'Pretoria', 'Distance Learning',
];

/**
 * Canonical profile contract for users/{uid}.
 *
 * Intentionally flat at the top level so Firestore can query common portfolio
 * attributes without an ORM or opaque blobs.
 */
export interface PortfolioProfile {
  uid: string;
  role: UserRole;
  email: string;
  displayName: string;
  headline: string;
  summary: string;
  campusLocation: CampusLocation;
  avatarUrl: string;

  // Academic identity
  studentNumber?: string;
  /** Students: the programme they are enrolled in. Drives matching and the pathway explorer. */
  programmeOfStudy?: string;
  /** Alumni: current field of work. */
  fieldOfWork?: string;
  yearOfEnrolment?: number;
  graduationYear?: number;

  // Portfolio
  skills: string[];
  qualifications: Qualification[];
  certifications: Certification[];
  workExperience: WorkExperience[];
  entrepreneurialExperience: VentureExperience[];
  gitHubProjects: ProjectLink[];
  deployedProjects: ProjectLink[];
  digitalBadges: DigitalBadge[];
  achievements: Achievement[];
  leadershipRoles: LeadershipRole[];
  activities: Activity[];
  careerInterests: string[];
  careerAspirations?: string;

  // Links
  gitHubUrl?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  credlyUrl?: string;
  resumeUrl?: string;

  // Business profile
  companyName?: string;
  industry?: string;
  companyDescription?: string;
  companyLocation?: string;
  companyWebsite?: string;
  contactName?: string;
  contactPhone?: string;
  /** Types of graduates, skills or talent this employer is seeking. */
  talentSought?: string;

  endorsements: Endorsement[];
  visibility: ProfileVisibility;
  isApproved: boolean;
  emailVerified: boolean;
  accountStatus?: 'active' | 'suspended' | 'revoked';
  createdAt: number;
  updatedAt: number;
  onboardingComplete?: boolean;
}

export type EditablePortfolioProfile = Pick<PortfolioProfile,
  | 'displayName'
  | 'headline'
  | 'summary'
  | 'campusLocation'
  | 'studentNumber'
  | 'programmeOfStudy'
  | 'fieldOfWork'
  | 'yearOfEnrolment'
  | 'graduationYear'
  | 'skills'
  | 'qualifications'
  | 'certifications'
  | 'workExperience'
  | 'entrepreneurialExperience'
  | 'gitHubProjects'
  | 'deployedProjects'
  | 'digitalBadges'
  | 'achievements'
  | 'leadershipRoles'
  | 'activities'
  | 'careerInterests'
  | 'careerAspirations'
  | 'gitHubUrl'
  | 'linkedInUrl'
  | 'portfolioUrl'
  | 'credlyUrl'
  | 'avatarUrl'
  | 'resumeUrl'
  | 'companyName'
  | 'industry'
  | 'companyDescription'
  | 'companyLocation'
  | 'companyWebsite'
  | 'talentSought'
  | 'visibility'
>;

/** What another member sees — already redacted server-side. */
export type VisibleProfile = Partial<PortfolioProfile> & {
  uid: string;
  role: UserRole;
  recommendations?: Recommendation[];
};

export interface ProfileAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface ProfileCompleteness {
  score: number;
  missing: string[];
  strengths: string[];
  suggestions: string[];
}

export interface CvExtractionResult {
  summary: string;
  skills: string[];
  qualifications: Qualification[];
  workExperience: WorkExperience[];
  headline: string;
  confidence: number;
  sourceTextHash: string;
}

const CLOSED: SectionAudience = { public: false, connections: false, students: false, alumni: false, business: false };
const OPEN: SectionAudience = { public: true, connections: true, students: true, alumni: true, business: true };

/** Mirrors the server default: discoverable, but not exposed. */
export function defaultVisibility(): ProfileVisibility {
  const output = {} as ProfileVisibility;
  for (const section of PROFILE_SECTIONS) output[section] = { ...CLOSED };
  output.skills = { ...OPEN };
  output.projects = { ...OPEN };
  output.careerInterests = { ...OPEN };
  output.badges = { ...OPEN };
  output.recommendations = { ...OPEN };
  output.experience = { ...CLOSED, connections: true, business: true };
  output.entrepreneurship = { ...CLOSED, connections: true, business: true };
  output.academicRecords = { ...CLOSED, connections: true };
  output.activities = { ...CLOSED, connections: true };
  output.contactInfo = { ...CLOSED, connections: true };
  return output;
}

/**
 * Accepts the legacy three-level string form as well as the current object, so
 * profiles written before the model changed still load into the editor.
 */
export function normaliseVisibility(value: unknown): ProfileVisibility {
  const input = (value ?? {}) as Record<string, unknown>;
  const output = {} as ProfileVisibility;
  for (const section of PROFILE_SECTIONS) {
    const raw = input[section];
    if (typeof raw === 'string') {
      output[section] = raw === 'public' ? { ...OPEN }
        : raw === 'connections' ? { ...CLOSED, connections: true }
        : { ...CLOSED };
    } else if (raw && typeof raw === 'object') {
      const row = raw as Record<string, unknown>;
      output[section] = {
        public: row.public === true,
        connections: row.connections === true,
        students: row.students === true,
        alumni: row.alumni === true,
        business: row.business === true,
      };
    } else {
      output[section] = { ...CLOSED };
    }
  }
  return output;
}
