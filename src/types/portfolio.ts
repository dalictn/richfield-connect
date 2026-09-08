export type UserRole = 'student' | 'alumni' | 'business' | 'administrator';
export type VisibilityLevel = 'public' | 'connections' | 'private';

export interface FieldVisibility {
  skills: VisibilityLevel;
  experience: VisibilityLevel;
  contactInfo: VisibilityLevel;
  academicRecords: VisibilityLevel;
}

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

export interface Endorsement {
  skill: string;
  endorsedBy: string;
  timestamp: number;
}

/**
 * Canonical profile contract for users/{uid}.
 * The profile is intentionally flat at the top level so Firestore can query
 * common portfolio attributes without introducing an ORM or opaque blobs.
 */
export interface PortfolioProfile {
  uid: string;
  role: UserRole;
  email: string;
  displayName: string;
  headline: string;
  summary: string;
  campusLocation: 'Durban' | 'Johannesburg' | 'Cape Town' | 'Pretoria' | 'Distance Learning';
  studentNumber?: string;
  companyName?: string;
  industry?: string;
  skills: string[];
  qualifications: Qualification[];
  workExperience: WorkExperience[];
  gitHubUrl?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  avatarUrl: string;
  resumeUrl?: string;
  endorsements: Endorsement[];
  visibility: FieldVisibility;
  isApproved: boolean;
  emailVerified: boolean;
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
  | 'companyName'
  | 'industry'
  | 'skills'
  | 'qualifications'
  | 'workExperience'
  | 'gitHubUrl'
  | 'linkedInUrl'
  | 'portfolioUrl'
  | 'avatarUrl'
  | 'resumeUrl'
  | 'visibility'
>;

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
