import type { UserRole } from './auth';

export type ConnectionState = 'self' | 'connected' | 'outgoing_pending' | 'incoming_pending' | 'none';

export interface DirectoryCard {
  uid: string;
  role: UserRole;
  displayName?: string;
  headline?: string;
  campusLocation?: string;
  avatarUrl?: string;
  companyName?: string;
  industry?: string;
  skills: string[];
  /** True when the member keeps their skills private or connections-only. */
  skillsHidden: boolean;
  connectionState: ConnectionState;
  /** Present only when connectionState is `incoming_pending`. */
  requestId?: string;
}

export interface DirectorySearch {
  query?: string;
  role?: 'student' | 'alumni' | 'business';
  skill?: string;
}

export interface DirectoryResponse {
  results: DirectoryCard[];
  scanned: number;
  truncated: boolean;
}
