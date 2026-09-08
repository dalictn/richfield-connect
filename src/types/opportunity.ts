export type OpportunityType = 'internship' | 'learnership' | 'part-time' | 'graduate' | 'full-time';
export type OpportunityStatus = 'pending' | 'approved' | 'rejected' | 'closed';
export interface Opportunity { id: string; ownerUid: string; companyName: string; title: string; description: string; type: OpportunityType; location: string; remote: boolean; requiredSkills: string[]; programmeTags: string[]; status: OpportunityStatus; applicantCount: number; viewCount: number; createdAt?: unknown; updatedAt?: unknown; }
export interface OpportunityMatch { id: string; opportunityId: string; studentUid: string; score: number; matchedSkills: string[]; programmeMatch: boolean; createdAt?: unknown; updatedAt?: unknown; }
