export type UserRole = 'student' | 'alumni' | 'business' | 'administrator';

export interface UserProfile {
  uid: string;
  role: UserRole;
  email: string;
  displayName: string;
  isApproved: boolean;
  accountStatus?: 'active' | 'suspended' | 'revoked';
  emailVerified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  companyName?: string;
  industry?: string;
  companyDescription?: string;
  companyLocation?: string;
  companyWebsite?: string;
  contactName?: string;
  contactPhone?: string;
  studentNumber?: string;
  programme?: string;
  graduationYear?: number;
  headline?: string;
  summary?: string;
  campusLocation?: 'Durban' | 'Johannesburg' | 'Cape Town' | 'Pretoria' | 'Distance Learning';
  skills?: string[];
  qualifications?: Array<{ title: string; institution: string; yearCompleted: number }>;
  workExperience?: Array<{ company: string; role: string; startDate: string; endDate?: string; description: string }>;
  gitHubUrl?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  avatarUrl?: string;
  resumeUrl?: string;
  endorsements?: Array<{ skill: string; endorsedBy: string; timestamp: number }>;
  visibility?: { skills: 'public' | 'connections' | 'private'; experience: 'public' | 'connections' | 'private'; contactInfo: 'public' | 'connections' | 'private'; academicRecords: 'public' | 'connections' | 'private' };
  onboardingComplete?: boolean;
}

export interface BusinessRegistration {
  companyName: string;
  industry: string;
  description: string;
  location: string;
  website: string;
  contactName: string;
  contactPhone: string;
}
