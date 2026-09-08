export type ConnectionRequestStatus = 'pending' | 'accepted' | 'declined';
export type ReactionType = 'like' | 'celebrate' | 'insightful';

export interface ConnectionRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: ConnectionRequestStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ConnectionMember {
  uid: string;
  connectedAt?: unknown;
}

export interface SocialPost {
  id: string;
  uid: string;
  authorRole: 'student' | 'alumni' | 'business' | 'administrator';
  body: string;
  reactionCount: number;
  commentCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  authorDisplayName?: string;
}

export interface FeedItem {
  id: string;
  postId: string;
  authorUid: string;
  authorRole: SocialPost['authorRole'];
  score: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DirectMessage {
  id: string;
  senderUid: string;
  body: string;
  createdAt?: unknown;
}

export interface Conversation {
  id: string;
  memberUids: string[];
  lastMessage?: string;
  lastMessageAt?: unknown;
  updatedAt?: unknown;
}

export type VideoStatus = 'uploaded' | 'processing' | 'transcoding' | 'ready' | 'failed';

export interface VideoAsset {
  id: string;
  uid: string;
  status: VideoStatus;
  sourcePath: string;
  outputPrefix?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  updatedAt?: unknown;
}
