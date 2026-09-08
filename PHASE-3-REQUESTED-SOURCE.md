# Richfield Connect — Phase 3 Requested Source

Generated from the Phase 3 implementation. Only Phase 3 scope is included; Phase 4 systems are intentionally excluded.

## `package.json`

```json
{
  "name": "richfield-connect",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "start": "react-native start",
    "typecheck": "tsc --noEmit",
    "web": "webpack serve --config web/webpack.config.js --mode development",
    "web:build": "webpack --config web/webpack.config.js --mode production"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "^2.2.0",
    "@react-native-firebase/app": "^23.5.0",
    "@react-native-firebase/app-check": "^23.5.0",
    "@react-native-firebase/auth": "^23.5.0",
    "@react-native-firebase/firestore": "^23.5.0",
    "@react-native-firebase/functions": "^23.5.0",
    "@react-navigation/bottom-tabs": "^7.4.7",
    "@react-navigation/native": "^7.1.17",
    "@react-navigation/native-stack": "^7.3.26",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-native": "^0.81.4",
    "react-native-safe-area-context": "^5.6.1",
    "react-native-screens": "^4.16.0",
    "react-native-svg": "^15.15.5",
    "react-native-web": "^0.21.2",
    "firebase": "^12.18.0",
    "@react-native-firebase/storage": "^23.5.0",
    "@react-native-firebase/messaging": "^23.5.0"
  },
  "devDependencies": {
    "@babel/core": "^7.28.4",
    "@babel/preset-env": "^7.28.3",
    "@babel/runtime": "^7.28.3",
    "@react-native-community/cli": "^20.0.2",
    "@types/react": "^19.1.11",
    "@types/react-dom": "^19.1.9",
    "@types/react-native": "^0.81.1",
    "babel-loader": "^10.0.0",
    "html-webpack-plugin": "^5.6.4",
    "react-native-svg-transformer": "^1.5.1",
    "typescript": "^5.9.2",
    "webpack": "^5.101.3",
    "webpack-cli": "^6.0.1",
    "webpack-dev-server": "^5.2.2",
    "@babel/preset-react": "^7.27.1",
    "@react-native/babel-preset": "^0.81.4",
    "@svgr/webpack": "^8.1.0"
  }
}

```

## `firebase.json`

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs22"
  },
  "firestore": {
    "rules": "firestore/firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  }
}

```

## `storage.rules`

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() { return request.auth != null; }
    function owner(uid) { return signedIn() && request.auth.uid == uid; }
    function approved() { return signedIn() && (request.auth.token.role != 'business' || request.auth.token.isApproved == true); }

    // Source video files are write-only for their owner. They are never readable
    // by mobile clients and are processed asynchronously before publication.
    match /video-input/{uid}/{videoId}/{fileName} {
      allow write: if owner(uid) && approved()
        && request.resource.size < 524288000
        && request.resource.contentType.matches('video/.*');
      allow read: if false;
      allow delete: if owner(uid);
    }

    // Only processed media can be read by authenticated approved users.
    match /video-processed/{uid}/{videoId}/{fileName} {
      allow read: if approved();
      allow write, delete: if false;
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}

```

## `firestore/firestore.rules`

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function hasRole(role) { return signedIn() && request.auth.token.role == role; }
    function isAdmin() { return hasRole('administrator'); }
    function isOwner(uid) { return signedIn() && request.auth.uid == uid; }
    function approved() { return signedIn() && (request.auth.token.role != 'business' || request.auth.token.isApproved == true); }

    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow update: if isOwner(uid)
        && request.resource.data.role == resource.data.role
        && request.resource.data.isApproved == resource.data.isApproved
        && request.resource.data.email == resource.data.email
        && request.resource.data.uid == resource.data.uid;
      allow create, delete: if false;
    }

    allow read, write: if false;

    match /alumni_registry/{recordId} { allow read, write: if false; }
    match /alumni_verification_requests/{requestId} { allow read, write: if false; }
    match /registration_intents/{intentId} { allow read, write: if false; }

    match /connection_requests/{requestId} {
      allow read: if signedIn() && (resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid || isAdmin());
      allow write: if false;
    }

    match /connections/{uid}/members/{memberUid} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if false;
    }

    match /posts/{postId} {
      allow read: if approved();
      allow write: if false;
      match /comments/{commentId} {
        allow read: if approved();
        allow write: if false;
      }
      match /reactions/{uid} {
        allow read: if approved();
        allow write: if false;
      }
    }

    match /feeds/{uid}/items/{itemId} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if false;
    }

    match /conversations/{conversationId} {
      allow read: if approved() && request.auth.uid in resource.data.memberUids;
      allow write: if false;
      match /messages/{messageId} {
        allow read: if approved() && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.memberUids;
        allow write: if false;
      }
    }

    match /videos/{videoId} {
      allow read: if approved() && (resource.data.uid == request.auth.uid || isAdmin());
      allow write: if false;
    }

    match /opportunities/{opportunityId} {
      allow read: if signedIn();
      allow create: if hasRole('business')
        && request.auth.token.isApproved == true;
      allow update, delete: if hasRole('business')
        && resource.data.ownerUid == request.auth.uid
        && request.auth.token.isApproved == true;
    }

    match /admin/{document=**} {
      allow read, write: if isAdmin();
    }
  }
}

```

## `src/navigation/RootNavigator.tsx`

```typescript
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthProvider';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterChoiceScreen } from '../screens/RegisterChoiceScreen';
import { StudentRegisterScreen } from '../screens/StudentRegisterScreen';
import { AlumniVerifyScreen } from '../screens/AlumniVerifyScreen';
import { AlumniEmailLinkPendingScreen } from '../screens/AlumniEmailLinkPendingScreen';
import { BusinessRegisterScreen } from '../screens/BusinessRegisterScreen';
import { PendingApprovalScreen } from '../screens/PendingApprovalScreen';
import { AccountProvisioningScreen } from '../screens/system/AccountProvisioningScreen';
import { StudentDashboard } from '../screens/dashboards/StudentDashboard';
import { AlumniDashboard } from '../screens/dashboards/AlumniDashboard';
import { BusinessDashboard } from '../screens/dashboards/BusinessDashboard';
import { AdminDashboard } from '../screens/dashboards/AdminDashboard';
import { AccountScreen } from '../screens/system/AccountScreen';
import { PortfolioScreen } from '../screens/profile/PortfolioScreen';
import { ProfileAssistantScreen } from '../screens/profile/ProfileAssistantScreen';
import { OnboardingScreen } from '../screens/profile/OnboardingScreen';
import { FeedScreen } from '../screens/social/FeedScreen';
import { ConnectionsScreen } from '../screens/social/ConnectionsScreen';
import { MessagesScreen } from '../screens/social/MessagesScreen';
import { firebaseProjectId } from '../firebaseApi';

export type RootStackParamList = {
  Login: undefined;
  RegisterChoice: undefined;
  StudentRegister: undefined;
  AlumniVerify: undefined;
  AlumniPending: undefined;
  BusinessRegister: undefined;
  PendingApproval: undefined;
  AccountProvisioning: undefined;
  Onboarding: undefined;
  StudentShell: undefined;
  AlumniShell: undefined;
  BusinessShell: undefined;
  AdminShell: undefined;
};

type RoleTabParamList = { Dashboard: undefined; Feed: undefined; Connections: undefined; Messages: undefined; Portfolio: undefined; Assistant: undefined; Account: undefined };
const RootStack = createNativeStackNavigator<RootStackParamList>();
const StudentTabs = createBottomTabNavigator<RoleTabParamList>();
const AlumniTabs = createBottomTabNavigator<RoleTabParamList>();
const BusinessTabs = createBottomTabNavigator<RoleTabParamList>();
const AdminTabs = createBottomTabNavigator<RoleTabParamList>();

function RoleTabs({ dashboard, showAssistant = true }: { dashboard: React.ComponentType; showAssistant?: boolean }) {
  return <StudentTabs.Navigator><StudentTabs.Screen name="Dashboard" component={dashboard} /><StudentTabs.Screen name="Feed" component={FeedScreen} /><StudentTabs.Screen name="Connections" component={ConnectionsScreen} /><StudentTabs.Screen name="Messages" component={MessagesScreen} /><StudentTabs.Screen name="Portfolio" component={PortfolioScreen} />{showAssistant && <StudentTabs.Screen name="Assistant" component={ProfileAssistantScreen} />}<StudentTabs.Screen name="Account" component={AccountScreen} /></StudentTabs.Navigator>;
}
function AlumniRoleTabs() { return <AlumniTabs.Navigator><AlumniTabs.Screen name="Dashboard" component={AlumniDashboard} /><AlumniTabs.Screen name="Feed" component={FeedScreen} /><AlumniTabs.Screen name="Connections" component={ConnectionsScreen} /><AlumniTabs.Screen name="Messages" component={MessagesScreen} /><AlumniTabs.Screen name="Portfolio" component={PortfolioScreen} /><AlumniTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><AlumniTabs.Screen name="Account" component={AccountScreen} /></AlumniTabs.Navigator>; }
function BusinessRoleTabs() { return <BusinessTabs.Navigator><BusinessTabs.Screen name="Dashboard" component={BusinessDashboard} /><BusinessTabs.Screen name="Feed" component={FeedScreen} /><BusinessTabs.Screen name="Connections" component={ConnectionsScreen} /><BusinessTabs.Screen name="Messages" component={MessagesScreen} /><BusinessTabs.Screen name="Portfolio" component={PortfolioScreen} /><BusinessTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><BusinessTabs.Screen name="Account" component={AccountScreen} /></BusinessTabs.Navigator>; }
function AdminRoleTabs() { return <AdminTabs.Navigator><AdminTabs.Screen name="Dashboard" component={AdminDashboard} /><AdminTabs.Screen name="Feed" component={FeedScreen} /><AdminTabs.Screen name="Connections" component={ConnectionsScreen} /><AdminTabs.Screen name="Messages" component={MessagesScreen} /><AdminTabs.Screen name="Portfolio" component={PortfolioScreen} /><AdminTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><AdminTabs.Screen name="Account" component={AccountScreen} /></AdminTabs.Navigator>; }
function getLinking(): LinkingOptions<RootStackParamList> { const projectId = firebaseProjectId(); return { prefixes: ['richfieldconnect://', `https://${projectId}.firebaseapp.com`] }; }
function BootstrapError({ message }: { message: string }) { return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Account state unavailable</Text><Text>{message}</Text></View>; }

export function RootNavigator() {
  const { loading, firebaseUser, profile, profileError } = useAuth();
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  return <NavigationContainer linking={getLinking()}><RootStack.Navigator>
    {!firebaseUser ? <RootStack.Group><RootStack.Screen name="Login" component={LoginScreen} /><RootStack.Screen name="RegisterChoice" component={RegisterChoiceScreen} /><RootStack.Screen name="StudentRegister" component={StudentRegisterScreen} /><RootStack.Screen name="AlumniVerify" component={AlumniVerifyScreen} /><RootStack.Screen name="AlumniPending" component={AlumniEmailLinkPendingScreen} /><RootStack.Screen name="BusinessRegister" component={BusinessRegisterScreen} /></RootStack.Group>
      : !profile ? <RootStack.Screen name="AccountProvisioning">{() => <AccountProvisioningScreen error={profileError} />}</RootStack.Screen>
      : profile.role === 'business' && !profile.isApproved ? <RootStack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      : profile.role !== 'administrator' && profile.onboardingComplete !== true ? <RootStack.Screen name="Onboarding">{() => <OnboardingScreen onComplete={() => undefined} />}</RootStack.Screen>
      : profile.role === 'student' ? <RootStack.Screen name="StudentShell">{() => <RoleTabs dashboard={StudentDashboard} />}</RootStack.Screen>
      : profile.role === 'alumni' ? <RootStack.Screen name="AlumniShell" component={AlumniRoleTabs} />
      : profile.role === 'business' && profile.isApproved ? <RootStack.Screen name="BusinessShell" component={BusinessRoleTabs} />
      : profile.role === 'administrator' ? <RootStack.Screen name="AdminShell" component={AdminRoleTabs} />
      : <RootStack.Screen name="AccountProvisioning">{() => <BootstrapError message="Your account has an unsupported role. Contact a Richfield administrator." />}</RootStack.Screen>}
  </RootStack.Navigator></NavigationContainer>;
}

```

## `src/types/social.ts`

```typescript
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

```

## `src/social/socialService.native.ts`

```typescript
import { collection, doc, limit, onSnapshot, orderBy, query, where } from '@react-native-firebase/firestore';
import { getFirestore } from '@react-native-firebase/firestore';
import { callFunction } from '../firebaseApi';
import type { ConnectionMember, ConnectionRequest, Conversation, DirectMessage, FeedItem, SocialPost } from '../types/social';

const db = getFirestore();

export const createConnectionRequest = (targetUid: string) => callFunction<{ targetUid: string }, { ok: boolean; requestId: string }>('createConnectionRequest', { targetUid });
export const respondToConnectionRequest = (requestId: string, decision: 'accept' | 'decline') => callFunction<{ requestId: string; decision: 'accept' | 'decline' }, { ok: boolean }>('respondToConnectionRequest', { requestId, decision });
export const createPost = (body: string) => callFunction<{ body: string }, { ok: boolean; postId: string }>('createPost', { body });
export const reactToPost = (postId: string, reaction: 'like' | 'celebrate' | 'insightful') => callFunction<{ postId: string; reaction: string }, { ok: boolean; active: boolean }>('reactToPost', { postId, reaction });
export const commentOnPost = (postId: string, body: string) => callFunction<{ postId: string; body: string }, { ok: boolean; commentId: string }>('commentOnPost', { postId, body });
export const sendDirectMessage = (targetUid: string, body: string) => callFunction<{ targetUid: string; body: string }, { ok: boolean; conversationId: string; messageId: string }>('sendDirectMessage', { targetUid, body });

export function subscribeConnections(uid: string, onNext: (items: ConnectionMember[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(collection(doc(collection(db, 'connections'), uid), 'members'), (snap) => onNext(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as object) })) as ConnectionMember[]), onError);
}

export function subscribeIncomingRequests(uid: string, onNext: (items: ConnectionRequest[]) => void, onError: (error: Error) => void): () => void {
  const q = query(collection(db, 'connection_requests'), where('toUid', '==', uid), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as ConnectionRequest[]), onError);
}

export function subscribeFeed(uid: string, onNext: (items: FeedItem[]) => void, onError: (error: Error) => void): () => void {
  const q = query(collection(doc(collection(db, 'feeds'), uid), 'items'), orderBy('score', 'desc'), limit(50));
  return onSnapshot(q, (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as FeedItem[]), onError);
}

export function subscribePosts(ids: string[], onNext: (posts: SocialPost[]) => void, onError: (error: Error) => void): () => void {
  if (ids.length === 0) { onNext([]); return () => undefined; }
  const unique = Array.from(new Set(ids)).slice(0, 30);
  const q = query(collection(db, 'posts'), where('__name__', 'in', unique));
  return onSnapshot(q, (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as SocialPost[]), onError);
}

export function subscribeConversations(uid: string, onNext: (items: Conversation[]) => void, onError: (error: Error) => void): () => void {
  const q = query(collection(db, 'conversations'), where('memberUids', 'array-contains', uid), orderBy('updatedAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Conversation[]), onError);
}

export function subscribeMessages(conversationId: string, onNext: (items: DirectMessage[]) => void, onError: (error: Error) => void): () => void {
  const q = query(collection(doc(collection(db, 'conversations'), conversationId), 'messages'), orderBy('createdAt', 'asc'), limit(100));
  return onSnapshot(q, (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as DirectMessage[]), onError);
}

```

## `src/social/socialService.web.ts`

```typescript
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { callFunction } from '../firebaseApi.web';
import type { ConnectionMember, ConnectionRequest, Conversation, DirectMessage, FeedItem, SocialPost } from '../types/social';
const db = getFirestore();
export const createConnectionRequest = (targetUid: string) => callFunction<{ targetUid: string }, { ok: boolean; requestId: string }>('createConnectionRequest', { targetUid });
export const respondToConnectionRequest = (requestId: string, decision: 'accept' | 'decline') => callFunction<{ requestId: string; decision: 'accept' | 'decline' }, { ok: boolean }>('respondToConnectionRequest', { requestId, decision });
export const createPost = (body: string) => callFunction<{ body: string }, { ok: boolean; postId: string }>('createPost', { body });
export const reactToPost = (postId: string, reaction: 'like' | 'celebrate' | 'insightful') => callFunction<{ postId: string; reaction: string }, { ok: boolean; active: boolean }>('reactToPost', { postId, reaction });
export const commentOnPost = (postId: string, body: string) => callFunction<{ postId: string; body: string }, { ok: boolean; commentId: string }>('commentOnPost', { postId, body });
export const sendDirectMessage = (targetUid: string, body: string) => callFunction<{ targetUid: string; body: string }, { ok: boolean; conversationId: string; messageId: string }>('sendDirectMessage', { targetUid, body });
export function subscribeConnections(uid: string, onNext: (items: ConnectionMember[]) => void, onError: (error: Error) => void): () => void { return onSnapshot(collection(doc(collection(db, 'connections'), uid), 'members'), (s) => onNext(s.docs.map(d => ({ uid: d.id, ...d.data() })) as ConnectionMember[]), onError); }
export function subscribeIncomingRequests(uid: string, onNext: (items: ConnectionRequest[]) => void, onError: (error: Error) => void): () => void { const q = query(collection(db,'connection_requests'), where('toUid','==',uid), where('status','==','pending'), orderBy('createdAt','desc'), limit(50)); return onSnapshot(q,s=>onNext(s.docs.map(d=>({id:d.id,...d.data()})) as ConnectionRequest[]),onError); }
export function subscribeFeed(uid: string, onNext: (items: FeedItem[]) => void, onError: (error: Error) => void): () => void { const q=query(collection(doc(collection(db,'feeds'),uid),'items'),orderBy('score','desc'),limit(50)); return onSnapshot(q,s=>onNext(s.docs.map(d=>({id:d.id,...d.data()})) as FeedItem[]),onError); }
export function subscribePosts(ids: string[], onNext: (posts: SocialPost[]) => void, onError: (error: Error) => void): () => void { if(!ids.length){onNext([]);return()=>undefined;} const q=query(collection(db,'posts'),where('__name__','in',Array.from(new Set(ids)).slice(0,30))); return onSnapshot(q,s=>onNext(s.docs.map(d=>({id:d.id,...d.data()})) as SocialPost[]),onError); }
export function subscribeConversations(uid: string, onNext: (items: Conversation[]) => void, onError: (error: Error) => void): () => void { const q=query(collection(db,'conversations'),where('memberUids','array-contains',uid),orderBy('updatedAt','desc'),limit(50)); return onSnapshot(q,s=>onNext(s.docs.map(d=>({id:d.id,...d.data()})) as Conversation[]),onError); }
export function subscribeMessages(conversationId: string, onNext: (items: DirectMessage[]) => void, onError: (error: Error) => void): () => void { const q=query(collection(doc(collection(db,'conversations'),conversationId),'messages'),orderBy('createdAt','asc'),limit(100)); return onSnapshot(q,s=>onNext(s.docs.map(d=>({id:d.id,...d.data()})) as DirectMessage[]),onError); }

```

## `src/social/socialService.ts`

```typescript
export * from './socialService.native';

```

## `src/screens/social/FeedScreen.tsx`

```typescript
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { commentOnPost, createPost, reactToPost, subscribeFeed, subscribePosts } from '../../social/socialService';
import type { FeedItem, SocialPost } from '../../types/social';

export function FeedScreen() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [body, setBody] = useState('');
  const [comment, setComment] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeFeed(uid, setItems, (e) => setError(e.message));
  }, [uid]);

  useEffect(() => {
    return subscribePosts(items.map((item) => item.postId), setPosts, (e) => setError(e.message));
  }, [items]);

  const orderedPosts = useMemo(() => {
    const map = new Map(posts.map((post) => [post.id, post]));
    return items.map((item) => map.get(item.postId)).filter(Boolean) as SocialPost[];
  }, [items, posts]);

  async function publish() {
    if (!body.trim() || busy) return;
    setBusy(true); setError('');
    try { await createPost(body); setBody(''); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to publish.'); } finally { setBusy(false); }
  }

  async function react(postId: string) { try { await reactToPost(postId, 'like'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to react.'); } }
  async function commentPost(postId: string) {
    const value = comment[postId]?.trim(); if (!value) return;
    try { await commentOnPost(postId, value); setComment((old) => ({ ...old, [postId]: '' })); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to comment.'); }
  }

  return <View style={{ flex: 1, padding: 16 }}>
    <Text style={{ fontSize: 26, fontWeight: '800', marginBottom: 12 }}>Professional Feed</Text>
    <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <TextInput value={body} onChangeText={setBody} placeholder="Share a professional update..." multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      <Pressable onPress={publish} disabled={busy} style={{ backgroundColor: '#111827', padding: 12, borderRadius: 8, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? 'Publishing…' : 'Publish'}</Text></Pressable>
    </View>
    {error ? <Text style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</Text> : null}
    <FlatList data={orderedPosts} keyExtractor={(item) => item.id} ListEmptyComponent={<Text style={{ color: '#666', paddingVertical: 20 }}>Your ranked feed will appear here as you and your connections post.</Text>} renderItem={({ item }) => <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <Text style={{ fontWeight: '800' }}>{item.authorDisplayName || item.uid}</Text>
      <Text style={{ color: '#6b7280', marginBottom: 8 }}>{item.authorRole}</Text>
      <Text style={{ fontSize: 16, lineHeight: 23 }}>{item.body}</Text>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}><Pressable onPress={() => react(item.id)}><Text>👍 {item.reactionCount}</Text></Pressable><Text>💬 {item.commentCount}</Text></View>
      <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}><TextInput value={comment[item.id] || ''} onChangeText={(value) => setComment((old) => ({ ...old, [item.id]: value }))} placeholder="Write a comment" style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10 }} /><Pressable onPress={() => commentPost(item.id)} style={{ padding: 10 }}><Text style={{ fontWeight: '700' }}>Send</Text></Pressable></View>
    </View>} />
  </View>;
}

```

## `src/screens/social/ConnectionsScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { createConnectionRequest, respondToConnectionRequest, subscribeConnections, subscribeIncomingRequests } from '../../social/socialService';
import type { ConnectionMember, ConnectionRequest } from '../../types/social';

export function ConnectionsScreen() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [members, setMembers] = useState<ConnectionMember[]>([]);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [targetUid, setTargetUid] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => uid ? subscribeConnections(uid, setMembers, e => setMessage(e.message)) : undefined, [uid]);
  useEffect(() => uid ? subscribeIncomingRequests(uid, setRequests, e => setMessage(e.message)) : undefined, [uid]);

  async function request() { if (!targetUid.trim() || busy) return; setBusy(true); setMessage(''); try { await createConnectionRequest(targetUid.trim()); setTargetUid(''); setMessage('Request sent.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to send request.'); } finally { setBusy(false); } }
  async function respond(id: string, decision: 'accept' | 'decline') { try { await respondToConnectionRequest(id, decision); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to respond.'); } }

  return <View style={{ flex: 1, padding: 16 }}>
    <Text style={{ fontSize: 26, fontWeight: '800', marginBottom: 12 }}>Connections</Text>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}><TextInput value={targetUid} onChangeText={setTargetUid} placeholder="Enter a user's UID" style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10 }} /><Pressable onPress={request} style={{ backgroundColor: '#111827', padding: 12, borderRadius: 8 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? '…' : 'Connect'}</Text></Pressable></View>
    {message ? <Text style={{ marginBottom: 12, color: '#374151' }}>{message}</Text> : null}
    <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Pending requests</Text>
    <FlatList data={requests} keyExtractor={(item) => item.id} ListEmptyComponent={<Text style={{ color: '#666', marginBottom: 20 }}>No pending requests.</Text>} renderItem={({ item }) => <View style={{ padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 8 }}><Text style={{ fontWeight: '700' }}>{item.fromUid}</Text><View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}><Pressable onPress={() => respond(item.id, 'accept')}><Text style={{ color: '#166534', fontWeight: '700' }}>Accept</Text></Pressable><Pressable onPress={() => respond(item.id, 'decline')}><Text style={{ color: '#991b1b', fontWeight: '700' }}>Decline</Text></Pressable></View></View>} />
    <Text style={{ fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 8 }}>Connected users</Text>
    <FlatList data={members} keyExtractor={(item) => item.uid} renderItem={({ item }) => <Text style={{ paddingVertical: 8 }}>{item.uid}</Text>} />
  </View>;
}

```

## `src/screens/social/MessagesScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { sendDirectMessage, subscribeConversations } from '../../social/socialService';
import type { Conversation } from '../../types/social';

export function MessagesScreen() {
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [targetUid, setTargetUid] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => firebaseUser ? subscribeConversations(firebaseUser.uid, setItems, e => setMessage(e.message)) : undefined, [firebaseUser]);
  async function send() { if (!targetUid.trim() || !body.trim()) return; try { await sendDirectMessage(targetUid.trim(), body.trim()); setBody(''); setMessage('Message sent.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to send message.'); } }
  return <View style={{ flex: 1, padding: 16 }}><Text style={{ fontSize: 26, fontWeight: '800', marginBottom: 12 }}>Messages</Text><TextInput value={targetUid} onChangeText={setTargetUid} placeholder="Connected user's UID" style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8 }} /><TextInput value={body} onChangeText={setBody} placeholder="Message" multiline style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, minHeight: 80, marginBottom: 8 }} /><Pressable onPress={send} style={{ backgroundColor: '#111827', padding: 12, borderRadius: 8, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Send direct message</Text></Pressable>{message ? <Text style={{ marginVertical: 10 }}>{message}</Text> : null}<Text style={{ fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 8 }}>Conversations</Text><FlatList data={items} keyExtractor={item => item.id} ListEmptyComponent={<Text style={{ color: '#666' }}>No conversations yet.</Text>} renderItem={({ item }) => <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}><Text style={{ fontWeight: '700' }}>{item.memberUids.filter(id => id !== firebaseUser?.uid).join(', ')}</Text><Text style={{ color: '#666' }}>{item.lastMessage || ''}</Text></View>} /></View>;
}

```

## `src/screens/social/ConversationScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { FlatList, Text, TextInput, Pressable, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { sendDirectMessage, subscribeMessages } from '../../social/socialService';
import type { DirectMessage } from '../../types/social';

export function ConversationScreen({ conversationId, targetUid }: { conversationId: string; targetUid: string }) {
  const { firebaseUser } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  useEffect(() => subscribeMessages(conversationId, setMessages, e => setError(e.message)), [conversationId]);
  async function send() { if (!body.trim()) return; try { await sendDirectMessage(targetUid, body.trim()); setBody(''); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send message.'); } }
  return <View style={{ flex: 1, padding: 16 }}><FlatList data={messages} keyExtractor={m => m.id} renderItem={({ item }) => <View style={{ alignSelf: item.senderUid === firebaseUser?.uid ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: item.senderUid === firebaseUser?.uid ? '#e0f2fe' : '#f3f4f6', padding: 10, borderRadius: 10, marginBottom: 6 }}><Text>{item.body}</Text></View>} /><View style={{ flexDirection: 'row', gap: 8 }}><TextInput value={body} onChangeText={setBody} placeholder="Type a message" style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10 }} /><Pressable onPress={send} style={{ padding: 12 }}><Text style={{ fontWeight: '700' }}>Send</Text></Pressable></View>{error ? <Text style={{ color: '#b91c1c', marginTop: 8 }}>{error}</Text> : null}</View>;
}

```

## `functions/package.json`

```json
{
  "name": "richfield-connect-functions",
  "private": true,
  "engines": {
    "node": "22"
  },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "dependencies": {
    "firebase-admin": "^13.5.0",
    "firebase-functions": "^6.5.0",
    "@google-cloud/video-transcoder": "^8.2.0",
    "@google-cloud/storage": "^7.16.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.30",
    "typescript": "^5.9.2"
  }
}

```

## `functions/src/index.ts`

```typescript
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth as auth, adminDb as db } from './firebaseAdmin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
import { beforeUserCreated } from './authBlocking';
import {
  finalizeAlumniRegistration,
  verifyAlumniCredentials,
} from './alumniVerification';

export { beforeUserCreated, verifyAlumniCredentials, finalizeAlumniRegistration };
export { upsertPortfolioProfile, endorseSkill, evaluateProfileCompleteness, completeOnboarding, getVisibleProfile } from './portfolio';
export { extractCvProfile } from './cvExtraction';
export { profileAssistant } from './profileAssistant';

const STUDENT_DOMAINS = ['@my.richfield.ac.za', '@richfield.ac.za', '@my.aaa.ac.za', '@aaa.ac.za'] as const;
const REGISTRATION_INTENTS = 'registration_intents';
const INTENT_TTL_MS = 15 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStudentEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return STUDENT_DOMAINS.some(
    (domain) => normalized.endsWith(domain) && normalized.indexOf('@') === normalized.length - domain.length,
  );
}

function requireSignedIn(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  return request.auth.uid;
}

function requireAdministrator(request: {
  auth?: { token?: Record<string, unknown>; uid?: string | null } | null;
}): string {
  const uid = requireSignedIn(request);
  if (request.auth?.token?.role !== 'administrator') {
    throw new HttpsError('permission-denied', 'Administrator role required.');
  }
  return uid;
}

function emailHash(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

export const createBusinessRegistrationIntent = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: true, region: 'africa-south1' },
  async (request) => {
    try {
      const email = normalizeEmail(String(request.data?.email ?? ''));
      if (!validEmail(email)) {
        throw new HttpsError('invalid-argument', 'A valid email address is required.');
      }
      if (isStudentEmail(email)) {
        throw new HttpsError('failed-precondition', 'Institutional accounts must use student registration.');
      }

      const expiresAt = Timestamp.fromMillis(Date.now() + INTENT_TTL_MS);
      await db.collection(REGISTRATION_INTENTS).doc(emailHash(email)).set({
        role: 'business',
        email,
        expiresAt,
        consumed: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('createBusinessRegistrationIntent failed', error);
      throw new HttpsError('internal', 'Unable to create registration session.');
    }
  },
);

export const finalizeStudentRegistration = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: true, region: 'africa-south1' },
  async (request) => {
    try {
      const uid = requireSignedIn(request);
      const record = await auth.getUser(uid);
      const email = normalizeEmail(record.email ?? '');
      const displayName = String(request.data?.displayName ?? '').trim();

      if (!isStudentEmail(email)) {
        await auth.deleteUser(uid);
        throw new HttpsError('permission-denied', 'Only Richfield institutional domains may register as students.');
      }
      if (!displayName || displayName.length > 120) {
        throw new HttpsError('invalid-argument', 'A valid display name is required.');
      }

      await auth.setCustomUserClaims(uid, { role: 'student', isApproved: true });
      await db.collection('users').doc(uid).set(
        {
          uid,
          role: 'student',
          email,
          displayName,
          isApproved: true,
          emailVerified: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('finalizeStudentRegistration failed', error);
      throw new HttpsError('internal', 'Unable to finalize student registration.');
    }
  },
);

export const finalizeBusinessRegistration = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: true, region: 'africa-south1' },
  async (request) => {
    try {
      const uid = requireSignedIn(request);
      const record = await auth.getUser(uid);
      const email = normalizeEmail(record.email ?? '');
      const data = (request.data ?? {}) as Record<string, unknown>;

      if (!validEmail(email)) throw new HttpsError('failed-precondition', 'Authenticated email is invalid.');

      const required = ['companyName', 'industry', 'description', 'location', 'website', 'contactName', 'contactPhone'];
      for (const field of required) {
        const value = String(data[field] ?? '').trim();
        if (!value || value.length > 500) {
          throw new HttpsError('invalid-argument', `${field} is required and must be valid.`);
        }
      }

      const intentRef = db.collection(REGISTRATION_INTENTS).doc(emailHash(email));
      const intentSnap = await intentRef.get();
      const intent = intentSnap.data();
      const expiresAt = intent?.expiresAt as Timestamp | undefined;

      if (
        !intentSnap.exists ||
        intent?.role !== 'business' ||
        intent?.consumed === true ||
        !expiresAt ||
        expiresAt.toMillis() <= Date.now()
      ) {
        throw new HttpsError('permission-denied', 'The business registration session is invalid or expired.');
      }

      await auth.setCustomUserClaims(uid, { role: 'business', isApproved: false });
      await db.runTransaction(async (transaction) => {
        transaction.set(
          db.collection('users').doc(uid),
          {
            uid,
            role: 'business',
            email,
            displayName: String(data.contactName).trim(),
            companyName: String(data.companyName).trim(),
            industry: String(data.industry).trim(),
            companyDescription: String(data.description).trim(),
            companyLocation: String(data.location).trim(),
            companyWebsite: String(data.website).trim(),
            contactName: String(data.contactName).trim(),
            contactPhone: String(data.contactPhone).trim(),
            isApproved: false,
            emailVerified: record.emailVerified,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        transaction.update(intentRef, { consumed: true, consumedAt: FieldValue.serverTimestamp() });
      });

      return { ok: true, isApproved: false };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('finalizeBusinessRegistration failed', error);
      throw new HttpsError('internal', 'Unable to finalize business registration.');
    }
  },
);

export const approveBusinessUser = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: true, region: 'africa-south1' },
  async (request) => {
    try {
      requireAdministrator(request);
      const uid = String(request.data?.uid ?? '');
      if (!uid) throw new HttpsError('invalid-argument', 'Business user UID is required.');

      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Business user profile not found.');
      if (snap.data()?.role !== 'business') throw new HttpsError('failed-precondition', 'Target user is not a business user.');

      await userRef.update({ isApproved: true, updatedAt: FieldValue.serverTimestamp() });
      await auth.setCustomUserClaims(uid, { role: 'business', isApproved: true });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('approveBusinessUser failed', error);
      throw new HttpsError('internal', 'Unable to approve business user.');
    }
  },
);
export {
  createConnectionRequest,
  respondToConnectionRequest,
  createPost,
  reactToPost,
  commentOnPost,
  sendDirectMessage,
  recomputeFeedScore,
  deleteOwnPost,
} from './social';
export { processUploadedVideo } from './videoProcessing';

```

## `functions/src/social.ts`

```typescript
import { FieldValue, Timestamp, collectionGroup } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth as auth, adminDb as db } from './firebaseAdmin';

const REGION = 'africa-south1';
const MAX_TEXT = 4000;
const MAX_COMMENT = 1000;
const VALID_REACTIONS = new Set(['like', 'celebrate', 'insightful']);

type Role = 'student' | 'alumni' | 'business' | 'administrator';

function signedIn(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}

function approvedRole(request: { auth?: { uid?: string | null; token?: Record<string, unknown> } | null }): { uid: string; role: Role } {
  const uid = signedIn(request);
  const role = request.auth?.token?.role as Role | undefined;
  if (!role || !['student', 'alumni', 'business', 'administrator'].includes(role)) {
    throw new HttpsError('permission-denied', 'A valid platform role is required.');
  }
  if (role === 'business' && request.auth?.token?.isApproved !== true) {
    throw new HttpsError('permission-denied', 'Business account approval is required.');
  }
  return { uid, role };
}

function text(value: unknown, max: number, field: string): string {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) throw new HttpsError('invalid-argument', `${field} is required and is too long.`);
  return result;
}

function conversationId(a: string, b: string): string {
  return [a, b].sort().join('_');
}

async function refreshFeedScoresForPost(postId: string): Promise<void> {
  const postSnap = await db.collection('posts').doc(postId).get();
  if (!postSnap.exists) return;
  const post = postSnap.data()!;
  const createdAt = post.createdAt as Timestamp;
  const feedSnap = await db.collectionGroup('items').where('postId', '==', postId).limit(500).get();
  const batch = db.batch();
  for (const item of feedSnap.docs) {
    const pathParts = item.ref.path.split('/');
    const viewerUid = pathParts[1];
    const viewer = await db.collection('users').doc(viewerUid).get();
    const viewerRole = viewer.data()?.role as Role | undefined;
    if (!viewerRole) continue;
    const score = relevanceScore(viewerRole, post.authorRole as Role, createdAt.toMillis(), Number(post.reactionCount ?? 0), Number(post.commentCount ?? 0));
    batch.update(item.ref, { score, updatedAt: FieldValue.serverTimestamp() });
  }
  if (!feedSnap.empty) await batch.commit();
}

async function areConnected(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const snap = await db.collection('connections').doc(a).collection('members').doc(b).get();
  return snap.exists;
}

function relevanceScore(viewerRole: Role, authorRole: Role, createdAtMs: number, reactions: number, comments: number): number {
  const roleAffinity: Record<Role, Record<Role, number>> = {
    student: { student: 1.0, alumni: 1.4, business: 1.5, administrator: 0.3 },
    alumni: { student: 1.2, alumni: 1.4, business: 1.5, administrator: 0.3 },
    business: { student: 1.5, alumni: 1.6, business: 1.0, administrator: 0.4 },
    administrator: { student: 1, alumni: 1, business: 1, administrator: 1 },
  };
  const ageHours = Math.max(0, (Date.now() - createdAtMs) / 3600000);
  const freshness = Math.exp(-ageHours / 72);
  return roleAffinity[viewerRole][authorRole] * 100 + freshness * 40 + reactions * 2 + comments * 3;
}

export const createConnectionRequest = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const targetUid = text(request.data?.targetUid, 128, 'targetUid');
    if (targetUid === uid) throw new HttpsError('failed-precondition', 'You cannot connect with yourself.');
    const target = await db.collection('users').doc(targetUid).get();
    if (!target.exists) throw new HttpsError('not-found', 'Target profile not found.');
    if (await areConnected(uid, targetUid)) throw new HttpsError('already-exists', 'You are already connected.');

    const existing = await db.collection('connection_requests')
      .where('fromUid', '==', uid).where('toUid', '==', targetUid).where('status', '==', 'pending').limit(1).get();
    if (!existing.empty) return { ok: true, requestId: existing.docs[0].id };

    const reverse = await db.collection('connection_requests')
      .where('fromUid', '==', targetUid).where('toUid', '==', uid).where('status', '==', 'pending').limit(1).get();
    if (!reverse.empty) throw new HttpsError('failed-precondition', 'This user already sent you a pending request.');

    const ref = db.collection('connection_requests').doc();
    await ref.set({ fromUid: uid, toUid: targetUid, status: 'pending', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, requestId: ref.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('createConnectionRequest failed', error);
    throw new HttpsError('internal', 'Unable to create connection request.');
  }
});

export const respondToConnectionRequest = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const requestId = text(request.data?.requestId, 128, 'requestId');
    const decision = String(request.data?.decision ?? '');
    if (decision !== 'accept' && decision !== 'decline') throw new HttpsError('invalid-argument', 'Decision must be accept or decline.');

    const requestRef = db.collection('connection_requests').doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) throw new HttpsError('not-found', 'Connection request not found.');
    const data = requestSnap.data()!;
    if (data.toUid !== uid || data.status !== 'pending') throw new HttpsError('permission-denied', 'You cannot modify this request.');

    if (decision === 'decline') {
      await requestRef.update({ status: 'declined', updatedAt: FieldValue.serverTimestamp() });
      return { ok: true };
    }

    const fromUid = String(data.fromUid);
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    batch.set(db.collection('connections').doc(uid).collection('members').doc(fromUid), { uid: fromUid, connectedAt: now });
    batch.set(db.collection('connections').doc(fromUid).collection('members').doc(uid), { uid, connectedAt: now });
    batch.update(requestRef, { status: 'accepted', updatedAt: now });
    await batch.commit();
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('respondToConnectionRequest failed', error);
    throw new HttpsError('internal', 'Unable to update connection request.');
  }
});

export const createPost = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid, role } = approvedRole(request);
    const body = text(request.data?.body, MAX_TEXT, 'body');
    const postRef = db.collection('posts').doc();
    const createdAt = Timestamp.now();
    const author = await db.collection('users').doc(uid).get();
    const authorDisplayName = String(author.data()?.displayName ?? 'Richfield Connect user');
    await postRef.set({ uid, authorRole: role, authorDisplayName, body, reactionCount: 0, commentCount: 0, createdAt, updatedAt: createdAt });

    const members = await db.collection('connections').doc(uid).collection('members').limit(200).get();
    const batch = db.batch();
    const recipients = new Set<string>([uid, ...members.docs.map((d) => d.id)]);
    for (const recipientUid of recipients) {
      const recipient = await db.collection('users').doc(recipientUid).get();
      const recipientRole = recipient.data()?.role as Role | undefined;
      if (!recipientRole) continue;
      const score = relevanceScore(recipientRole, role, createdAt.toMillis(), 0, 0);
      const feedRef = db.collection('feeds').doc(recipientUid).collection('items').doc(postRef.id);
      batch.set(feedRef, { postId: postRef.id, authorUid: uid, authorRole: role, authorDisplayName, score, createdAt, updatedAt: createdAt }, { merge: true });
    }
    await batch.commit();
    return { ok: true, postId: postRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('createPost failed', error);
    throw new HttpsError('internal', 'Unable to create post.');
  }
});

export const reactToPost = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const postId = text(request.data?.postId, 128, 'postId');
    const reaction = String(request.data?.reaction ?? 'like');
    if (!VALID_REACTIONS.has(reaction)) throw new HttpsError('invalid-argument', 'Unsupported reaction.');
    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) throw new HttpsError('not-found', 'Post not found.');
    const reactionRef = postRef.collection('reactions').doc(uid);
    const existing = await reactionRef.get();
    if (existing.exists) {
      await reactionRef.delete();
      await postRef.update({ reactionCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      await refreshFeedScoresForPost(postId);
      return { ok: true, active: false };
    }
    await reactionRef.set({ uid, reaction, createdAt: FieldValue.serverTimestamp() });
    await postRef.update({ reactionCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    await refreshFeedScoresForPost(postId);
    return { ok: true, active: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('reactToPost failed', error);
    throw new HttpsError('internal', 'Unable to react to post.');
  }
});

export const commentOnPost = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const postId = text(request.data?.postId, 128, 'postId');
    const body = text(request.data?.body, MAX_COMMENT, 'body');
    const postRef = db.collection('posts').doc(postId);
    if (!(await postRef.get()).exists) throw new HttpsError('not-found', 'Post not found.');
    const ref = postRef.collection('comments').doc();
    await ref.set({ uid, body, createdAt: FieldValue.serverTimestamp() });
    await postRef.update({ commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    await refreshFeedScoresForPost(postId);
    return { ok: true, commentId: ref.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('commentOnPost failed', error);
    throw new HttpsError('internal', 'Unable to comment on post.');
  }
});

export const sendDirectMessage = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const targetUid = text(request.data?.targetUid, 128, 'targetUid');
    const body = text(request.data?.body, 4000, 'body');
    if (targetUid === uid || !(await areConnected(uid, targetUid))) throw new HttpsError('permission-denied', 'Direct messages are available only between connected users.');
    const conversation = conversationId(uid, targetUid);
    const conversationRef = db.collection('conversations').doc(conversation);
    const messageRef = conversationRef.collection('messages').doc();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(conversationRef, { memberUids: [uid, targetUid], lastMessage: body.slice(0, 160), lastMessageAt: now, updatedAt: now }, { merge: true });
    batch.set(messageRef, { senderUid: uid, body, createdAt: now });
    await batch.commit();
    return { ok: true, conversationId: conversation, messageId: messageRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('sendDirectMessage failed', error);
    throw new HttpsError('internal', 'Unable to send message.');
  }
});

export const recomputeFeedScore = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const postId = text(request.data?.postId, 128, 'postId');
    const post = await db.collection('posts').doc(postId).get();
    if (!post.exists) throw new HttpsError('not-found', 'Post not found.');
    const postData = post.data()!;
    const viewer = await db.collection('users').doc(uid).get();
    const score = relevanceScore(viewer.data()?.role as Role, postData.authorRole as Role, (postData.createdAt as Timestamp).toMillis(), postData.reactionCount ?? 0, postData.commentCount ?? 0);
    await db.collection('feeds').doc(uid).collection('items').doc(postId).update({ score, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, score };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('recomputeFeedScore failed', error);
    throw new HttpsError('internal', 'Unable to update feed score.');
  }
});

export const deleteOwnPost = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, region: REGION }, async (request) => {
  try {
    const { uid } = approvedRole(request);
    const postId = text(request.data?.postId, 128, 'postId');
    const ref = db.collection('posts').doc(postId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== uid) throw new HttpsError('permission-denied', 'You cannot delete this post.');
    await ref.delete();
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('deleteOwnPost failed', error);
    throw new HttpsError('internal', 'Unable to delete post.');
  }
});

```

## `functions/src/videoProcessing.ts`

```typescript
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb as db } from './firebaseAdmin';
import { TranscoderServiceClient } from '@google-cloud/video-transcoder';
import { Storage } from '@google-cloud/storage';

const transcoder = new TranscoderServiceClient();
const storage = new Storage();
const REGION = 'africa-south1';

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

export const processUploadedVideo = onObjectFinalized({ region: REGION, retry: true }, async (event) => {
  const object = event.data;
  const bucket = object.bucket;
  const name = object.name ?? '';
  const contentType = object.contentType ?? '';
  if (!name.startsWith('video-input/') || !contentType.startsWith('video/')) return;

  const parts = name.split('/');
  if (parts.length < 4) return;
  const uid = parts[1];
  const videoId = parts[2];
  const sourcePath = parts.slice(3).join('/');
  const docRef = db.collection('videos').doc(videoId);

  await docRef.set({ uid, status: 'processing', sourcePath: name, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('GCLOUD_PROJECT is unavailable.');

  const outputPrefix = `video-processed/${safeSegment(uid)}/${safeSegment(videoId)}/`;
  const transcoderLocation = process.env.TRANSCODER_LOCATION || 'europe-west1';
  const parent = transcoder.locationPath(projectId, transcoderLocation);
  const job = {
    inputUri: `gs://${bucket}/${sourcePath}`,
    outputUri: `gs://${bucket}/${outputPrefix}`,
    config: {
      elementaryStreams: [
        { key: 'video-stream', videoStream: { h264: { heightPixels: 720, widthPixels: 1280, bitrateBps: 2500000, frameRate: 30, pixelFormat: 'yuv420p' } } },
        { key: 'audio-stream', audioStream: { codec: 'aac', bitrateBps: 128000, channelCount: 2, channelLayout: ['fl', 'fr'] } },
      ],
      muxStreams: [{ key: 'mp4', container: 'mp4', elementaryStreams: ['video-stream', 'audio-stream'], fileName: 'main.mp4' }],
      spriteSheets: [{ filePrefix: 'thumb', spriteHeightPixels: 180, spriteWidthPixels: 320, columnCount: 1, rowCount: 1, interval: { seconds: 1 } }],
    },
  };

  const [created] = await transcoder.createJob({ parent, job });
  await docRef.set({ transcoderJob: created.name, status: 'transcoding', outputPrefix, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  await storage.bucket(bucket).file(name).setMetadata({ metadata: { processing: 'submitted', videoId } });
});

```

## `PHASE-3.md`

```text
# Richfield Connect — Phase 3

Phase 3 implements only the authorized roadmap scope:

1. Social networking graph: connection requests, acceptance/decline, symmetric connection membership.
2. Engagement: posts, reactions, comments, and server-side counters.
3. Role-ranked feed: fan-out feed items are scored using viewer role, author role, freshness, reactions, and comments.
4. Direct messaging: only connected users can message; conversations and messages are live Firestore listeners.
5. Video processing engine: source video is private, a Cloud Storage finalization trigger submits an asynchronous Google Cloud Transcoder job for H.264/AAC 720p output and a thumbnail sprite. Processed objects are the only client-readable media.

## Phase boundary

Phase 4 is deliberately not implemented. There is no FCM notification engine, smart opportunity matching pipeline, or analytics dashboard in this release.

## Backend architecture

- Client mutations call Firebase callable functions with App Check enforcement.
- Firestore client writes to social data are denied; privileged mutations occur server-side.
- Connection and message state is observed with Firestore `onSnapshot`, not polling.
- Video source objects are write-only for their owner and unreadable from the client.
- Transcoder jobs are asynchronous. Set `TRANSCODER_LOCATION` to a Google Cloud Transcoder-supported region; it defaults to `europe-west1` because the Firebase Function region `africa-south1` is not a Transcoder job location.

## Deployment

From the project root:

```powershell
npm install
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,storage,functions
```

Enable the Google Cloud Transcoder API and grant the Functions runtime service account permission to create Transcoder jobs and write the configured Cloud Storage bucket.

The Google Cloud Transcoder service is asynchronous and writes its processed outputs back to Cloud Storage. See the official Transcoder documentation for supported locations and IAM requirements.

```
