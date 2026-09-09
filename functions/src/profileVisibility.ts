/**
 * Single source of truth for what one user may see of another.
 *
 * Firestore rules deny reading other users' documents, so every cross-user
 * profile read is served by a callable. Those callables must all redact
 * identically — a directory that returned a field the profile view hides would
 * quietly defeat the POPIA controls — so both paths call the helpers here
 * rather than reimplementing the rules.
 */

export type ProfileRole = 'student' | 'alumni' | 'business' | 'administrator';

/**
 * Per-section audience control, as required by the brief: a member chooses
 * which audiences see each section of their profile.
 *
 * `public` means any authenticated member. The remaining flags grant access to
 * one specific audience, so a student can expose skills to employers while
 * keeping work history to connections. Everything defaults to closed.
 *
 * Note: "lecturers" are named in the brief but are not a modelled role on this
 * platform — there are only students, alumni, business users and
 * administrators. Administrators bypass redaction entirely.
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

const CLOSED: SectionAudience = { public: false, connections: false, students: false, alumni: false, business: false };
const OPEN: SectionAudience = { public: true, connections: true, students: true, alumni: true, business: true };
const CONNECTIONS_ONLY: SectionAudience = { ...CLOSED, connections: true };

/**
 * Accepts both the current per-audience object and the original three-level
 * string ('public' | 'connections' | 'private'), so profiles written before the
 * model changed keep working and keep meaning the same thing.
 */
export function normaliseSectionAudience(value: unknown): SectionAudience {
  if (typeof value === 'string') {
    if (value === 'public') return { ...OPEN };
    if (value === 'connections') return { ...CONNECTIONS_ONLY };
    return { ...CLOSED };
  }
  if (!value || typeof value !== 'object') return { ...CLOSED };
  const input = value as Record<string, unknown>;
  return {
    public: input.public === true,
    connections: input.connections === true,
    students: input.students === true,
    alumni: input.alumni === true,
    business: input.business === true,
  };
}

export function normaliseVisibility(value: unknown): Record<ProfileSection, SectionAudience> {
  const input = (value ?? {}) as Record<string, unknown>;
  const output = {} as Record<ProfileSection, SectionAudience>;
  for (const section of PROFILE_SECTIONS) {
    output[section] = normaliseSectionAudience(input[section]);
  }
  return output;
}

/** A sensible starting point for a new profile: discoverable, but not exposed. */
export function defaultVisibility(): Record<ProfileSection, SectionAudience> {
  const output = {} as Record<ProfileSection, SectionAudience>;
  for (const section of PROFILE_SECTIONS) output[section] = { ...CLOSED };
  output.skills = { ...OPEN };
  output.projects = { ...OPEN };
  output.careerInterests = { ...OPEN };
  output.badges = { ...OPEN };
  output.recommendations = { ...OPEN };
  output.experience = { ...CONNECTIONS_ONLY, business: true };
  output.academicRecords = { ...CONNECTIONS_ONLY };
  output.activities = { ...CONNECTIONS_ONLY };
  output.entrepreneurship = { ...CONNECTIONS_ONLY, business: true };
  output.contactInfo = { ...CONNECTIONS_ONLY };
  return output;
}

export interface Viewer {
  role: ProfileRole;
  connected: boolean;
}

export function canSeeSection(
  target: Record<string, unknown>,
  section: ProfileSection,
  viewer: Viewer,
): boolean {
  const audience = normaliseSectionAudience((target.visibility as Record<string, unknown> | undefined)?.[section]);
  if (audience.public) return true;
  if (audience.connections && viewer.connected) return true;
  if (viewer.role === 'student' && audience.students) return true;
  if (viewer.role === 'alumni' && audience.alumni) return true;
  if (viewer.role === 'business' && audience.business) return true;
  return false;
}

function sectionOr<T>(target: Record<string, unknown>, section: ProfileSection, viewer: Viewer, fallback: T): T {
  return canSeeSection(target, section, viewer) ? ((target[sectionField(section)] as T) ?? fallback) : fallback;
}

/** Maps a visibility section to the profile field it guards, where they differ. */
function sectionField(section: ProfileSection): string {
  switch (section) {
    case 'experience': return 'workExperience';
    case 'academicRecords': return 'qualifications';
    default: return section;
  }
}

/**
 * The full profile view, used when opening someone's profile.
 */
export function redactProfile(
  target: Record<string, unknown>,
  viewer: Viewer,
): Record<string, unknown> {
  const academic = canSeeSection(target, 'academicRecords', viewer);
  const projects = canSeeSection(target, 'projects', viewer);
  const activities = canSeeSection(target, 'activities', viewer);

  return {
    uid: target.uid,
    role: target.role,
    displayName: target.displayName,
    headline: target.headline,
    summary: target.summary,
    campusLocation: target.campusLocation,
    avatarUrl: target.avatarUrl,
    programmeOfStudy: target.programmeOfStudy,
    fieldOfWork: target.fieldOfWork,
    yearOfEnrolment: target.yearOfEnrolment,
    graduationYear: target.graduationYear,

    skills: sectionOr(target, 'skills', viewer, [] as unknown[]),
    workExperience: sectionOr(target, 'experience', viewer, [] as unknown[]),
    qualifications: academic ? target.qualifications ?? [] : [],
    certifications: academic ? target.certifications ?? [] : [],
    achievements: academic ? target.achievements ?? [] : [],

    gitHubProjects: projects ? target.gitHubProjects ?? [] : [],
    deployedProjects: projects ? target.deployedProjects ?? [] : [],
    entrepreneurialExperience: sectionOr(target, 'entrepreneurship', viewer, [] as unknown[]),

    leadershipRoles: activities ? target.leadershipRoles ?? [] : [],
    activities: activities ? target.activities ?? [] : [],

    digitalBadges: sectionOr(target, 'badges', viewer, [] as unknown[]),
    careerInterests: sectionOr(target, 'careerInterests', viewer, [] as unknown[]),
    careerAspirations: canSeeSection(target, 'careerInterests', viewer) ? target.careerAspirations : undefined,

    gitHubUrl: target.gitHubUrl,
    linkedInUrl: target.linkedInUrl,
    portfolioUrl: target.portfolioUrl,
    credlyUrl: canSeeSection(target, 'badges', viewer) ? target.credlyUrl : undefined,
    resumeUrl: canSeeSection(target, 'contactInfo', viewer) ? target.resumeUrl : undefined,

    companyName: target.companyName,
    industry: target.industry,
    companyDescription: target.companyDescription,
    companyLocation: target.companyLocation,
    companyWebsite: target.companyWebsite,
    talentSought: target.talentSought,

    // Never leaves the server: a student number identifies a person against the
    // institutional registry and is not a networking field.
    studentNumber: undefined,
    email: canSeeSection(target, 'contactInfo', viewer) ? target.email : undefined,
    contactPhone: canSeeSection(target, 'contactInfo', viewer) ? target.contactPhone : undefined,
    endorsements: sectionOr(target, 'skills', viewer, [] as unknown[]),
  };
}

/**
 * The compact card shown in directory results. Deliberately narrower than
 * redactProfile — a search result should not carry a full work history.
 */
export function redactDirectoryCard(
  target: Record<string, unknown>,
  viewer: Viewer,
): Record<string, unknown> {
  const skillsVisible = canSeeSection(target, 'skills', viewer);
  const skills = skillsVisible && Array.isArray(target.skills) ? target.skills : [];
  return {
    uid: target.uid,
    role: target.role,
    displayName: target.displayName,
    headline: target.headline,
    campusLocation: target.campusLocation,
    avatarUrl: target.avatarUrl,
    programmeOfStudy: target.programmeOfStudy,
    fieldOfWork: target.fieldOfWork,
    companyName: target.companyName,
    industry: target.industry,
    skills: skills.slice(0, 12),
    skillsHidden: !skillsVisible,
  };
}
