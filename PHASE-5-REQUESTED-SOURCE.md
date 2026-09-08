# Richfield Connect — Phase 5 Requested Source

## Included files

1. `src/screens/admin/AdminDashboardScreen.tsx`
2. `src/screens/admin/ModerationQueueScreen.tsx`
3. `src/screens/admin/BroadcastScreen.tsx`
4. `functions/src/admin.ts`
5. `firestore/firestore.rules`
6. `firestore.indexes.json`
7. `functions/src/videoProcessing.ts` — Phase 3 bug patch
8. `src/navigation/RootNavigator.tsx` — Phase 5 admin navigation integration
9. `src/types/auth.ts` — account lifecycle status type
10. `PHASE-5-POPIA-AND-BUILD-CHECKLIST.md`

---

## src/screens/admin/AdminDashboardScreen.tsx
```
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getAdminAnalytics } from '../../analyticsService';
import { callFunction } from '../../firebaseApi';
import type { AdminAnalytics } from '../../types/analytics';
import type { UserProfile, UserRole } from '../../types/auth';
interface AdminUser extends UserProfile { accountStatus?: 'active'|'suspended'|'revoked'; }
interface UserResponse { users: AdminUser[]; }
const roles: Array<'all'|UserRole> = ['all','student','alumni','business','administrator'];
const statuses = ['all','active','suspended','revoked'] as const;
export function AdminDashboardScreen() {
 const [analytics,setAnalytics]=useState<AdminAnalytics|null>(null); const [users,setUsers]=useState<AdminUser[]>([]); const [role,setRole]=useState<'all'|UserRole>('all'); const [status,setStatus]=useState<typeof statuses[number]>('all'); const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [error,setError]=useState('');
 const load=useCallback(async()=>{try{setError('');const [a,u]=await Promise.all([getAdminAnalytics(),callFunction<{role:string;status:string},UserResponse>('listAdminUsers',{role,status})]);setAnalytics(a);setUsers(u.users);}catch(e){setError(e instanceof Error?e.message:'Unable to load administrator data.');}finally{setLoading(false);setRefreshing(false);}},[role,status]);
 useEffect(()=>{void load();},[load]);
 const setUserStatus=(user:AdminUser,next:'active'|'suspended'|'revoked')=>Alert.alert('Confirm account change',`${user.displayName||user.email} will be ${next}.`,[{text:'Cancel',style:'cancel'},{text:'Confirm',style:next==='revoked'?'destructive':'default',onPress:async()=>{try{await callFunction('manageUserStatus',{uid:user.uid,status:next});await load();}catch(e){Alert.alert('Failed',e instanceof Error?e.message:'Unable to update account.');}}}]);
 if(loading)return <ActivityIndicator style={{flex:1}} size="large"/>;
 return <FlatList data={users} keyExtractor={u=>u.uid} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>} contentContainerStyle={styles.list} ListHeaderComponent={<><Text style={styles.title}>Administrator Control Centre</Text><Text style={styles.sub}>Lifecycle management, platform analytics and security operations.</Text>{error?<Text style={styles.error}>{error}</Text>:null}{analytics?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>{[['Users',analytics.totalUsers],['Active 30d',analytics.activeUsers30d],['New 30d',analytics.newRegistrations30d],['Pending business',analytics.pendingBusinessApprovals],['Open flags',analytics.flaggedContent]].map(([l,v])=><View key={String(l)} style={styles.metric}><Text style={styles.metricValue}>{String(v)}</Text><Text>{String(l)}</Text></View>)}</ScrollView>:null}<Text style={styles.heading}>Users</Text><ScrollView horizontal contentContainerStyle={styles.filters}>{roles.map(r=><Pressable key={r} onPress={()=>setRole(r)} style={[styles.filter,role===r&&styles.selected]}><Text style={role===r?styles.selectedText:undefined}>{r}</Text></Pressable>)}</ScrollView><ScrollView horizontal contentContainerStyle={styles.filters}>{statuses.map(s=><Pressable key={s} onPress={()=>setStatus(s)} style={[styles.filter,status===s&&styles.selected]}><Text style={status===s?styles.selectedText:undefined}>{s}</Text></Pressable>)}</ScrollView></>} renderItem={({item})=><View style={styles.card}><View style={{flex:1}}><Text style={styles.name}>{item.displayName||item.email}</Text><Text>{item.email}</Text><Text style={styles.meta}>{item.role} · {item.accountStatus||'active'}</Text>{item.companyName?<Text>{item.companyName}</Text>:null}</View>{item.role!=='administrator'?<View style={styles.actions}>{item.accountStatus==='active'?<Pressable style={styles.action} onPress={()=>setUserStatus(item,'suspended')}><Text style={styles.white}>Suspend</Text></Pressable>:<Pressable style={styles.action} onPress={()=>setUserStatus(item,'active')}><Text style={styles.white}>Activate</Text></Pressable>}<Pressable style={styles.danger} onPress={()=>setUserStatus(item,'revoked')}><Text style={styles.white}>Revoke</Text></Pressable></View>:<Text style={styles.meta}>Protected administrator</Text>}</View>} ListEmptyComponent={<Text style={styles.empty}>No users match these filters.</Text>}/>;
}
const styles=StyleSheet.create({list:{padding:16,paddingBottom:40},title:{fontSize:28,fontWeight:'800'},sub:{color:'#667085',marginBottom:16},error:{color:'#b42318',marginBottom:12},metrics:{gap:10,paddingBottom:18},metric:{width:125,padding:14,borderRadius:14,backgroundColor:'#f2f4f7'},metricValue:{fontSize:24,fontWeight:'800'},heading:{fontSize:20,fontWeight:'800',marginBottom:8},filters:{gap:8,paddingBottom:9},filter:{paddingHorizontal:13,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'#d0d5dd'},selected:{backgroundColor:'#111827'},selectedText:{color:'#fff'},card:{padding:14,borderRadius:14,borderWidth:1,borderColor:'#e4e7ec',marginBottom:10,flexDirection:'row',gap:10},name:{fontSize:16,fontWeight:'800'},meta:{color:'#667085',marginTop:3},actions:{justifyContent:'center',gap:6},action:{backgroundColor:'#111827',paddingHorizontal:10,paddingVertical:8,borderRadius:8},danger:{backgroundColor:'#b42318',paddingHorizontal:10,paddingVertical:8,borderRadius:8},white:{color:'#fff',fontWeight:'700'},empty:{textAlign:'center',padding:30,color:'#667085'}});
```

## src/screens/admin/ModerationQueueScreen.tsx
```
import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,FlatList,Pressable,RefreshControl,StyleSheet,Text,View} from 'react-native';
import {callFunction} from '../../firebaseApi';
interface Flag{ id:string; contentType:'post'|'comment'|'profile'; contentId:string; parentId?:string; reason:string; reportedBy:string; status:string; }
export function ModerationQueueScreen(){const[flags,setFlags]=useState<Flag[]>([]);const[loading,setLoading]=useState(true);const[refreshing,setRefreshing]=useState(false);const[error,setError]=useState('');const load=useCallback(async()=>{try{setError('');const r=await callFunction<Record<string,never>,{flags:Flag[]}>('listModerationQueue',{});setFlags(r.flags);}catch(e){setError(e instanceof Error?e.message:'Unable to load moderation queue.');}finally{setLoading(false);setRefreshing(false);}},[]);useEffect(()=>{void load();},[load]);const act=(flag:Flag,action:'dismiss'|'delete')=>Alert.alert(action==='delete'?'Delete content?':'Dismiss report?',action==='delete'?'This cannot be undone.':'Close this report without deleting content.',[{text:'Cancel',style:'cancel'},{text:'Confirm',style:action==='delete'?'destructive':'default',onPress:async()=>{try{await callFunction('moderateContent',{flagId:flag.id,action});await load();}catch(e){Alert.alert('Failed',e instanceof Error?e.message:'Moderation action failed.');}}}]);if(loading)return <ActivityIndicator style={{flex:1}} size="large"/>;return <FlatList data={flags} keyExtractor={f=>f.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>} contentContainerStyle={styles.list} ListHeaderComponent={<><Text style={styles.title}>Moderation Queue</Text><Text style={styles.sub}>Review flagged posts, comments and profiles.</Text>{error?<Text style={styles.error}>{error}</Text>:null}</>} renderItem={({item})=><View style={styles.card}><Text style={styles.type}>{item.contentType.toUpperCase()}</Text><Text style={styles.reason}>{item.reason}</Text><Text style={styles.meta}>Content: {item.contentId}</Text><Text style={styles.meta}>Reporter: {item.reportedBy}</Text><View style={styles.actions}><Pressable style={styles.secondary} onPress={()=>act(item,'dismiss')}><Text>Dismiss</Text></Pressable><Pressable style={styles.danger} onPress={()=>act(item,'delete')}><Text style={styles.white}>Delete</Text></Pressable></View></View>} ListEmptyComponent={<Text style={styles.empty}>No open moderation reports.</Text>}/>}
const styles=StyleSheet.create({list:{padding:16},title:{fontSize:28,fontWeight:'800'},sub:{color:'#667085',marginBottom:16},error:{color:'#b42318'},card:{padding:16,borderWidth:1,borderColor:'#e4e7ec',borderRadius:14,marginBottom:12},type:{fontWeight:'800',fontSize:11,marginBottom:7},reason:{fontSize:17,fontWeight:'700'},meta:{color:'#667085',marginTop:4},actions:{flexDirection:'row',gap:8,marginTop:14},secondary:{padding:10,borderWidth:1,borderColor:'#d0d5dd',borderRadius:8},danger:{padding:10,borderRadius:8,backgroundColor:'#b42318'},white:{color:'#fff',fontWeight:'700'},empty:{padding:30,textAlign:'center',color:'#667085'}});
```

## src/screens/admin/BroadcastScreen.tsx
```
import React,{useState} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {callFunction} from '../../firebaseApi';
const targets=['all','student','alumni','business'] as const;
export function BroadcastScreen(){const[title,setTitle]=useState('');const[body,setBody]=useState('');const[targetRole,setTargetRole]=useState<typeof targets[number]>('all');const[busy,setBusy]=useState(false);const send=async()=>{if(!title.trim()||!body.trim()){Alert.alert('Missing information','Enter a title and message.');return;}setBusy(true);try{const r=await callFunction<{title:string;body:string;targetRole:string},{recipientCount:number;sent:number;failed:number}>('broadcastAnnouncement',{title:title.trim(),body:body.trim(),targetRole});Alert.alert('Broadcast complete',`${r.sent} notifications sent to ${r.recipientCount} active recipients. ${r.failed} failed.`);setTitle('');setBody('');}catch(e){Alert.alert('Broadcast failed',e instanceof Error?e.message:'Unable to send announcement.');}finally{setBusy(false);}};return <ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>Broadcast Centre</Text><Text style={styles.sub}>System-wide push notifications with role targeting.</Text><Text style={styles.label}>Audience</Text><View style={styles.targets}>{targets.map(t=><Pressable key={t} onPress={()=>setTargetRole(t)} style={[styles.target,targetRole===t&&styles.selected]}><Text style={targetRole===t?styles.selectedText:undefined}>{t==='all'?'All users':t[0].toUpperCase()+t.slice(1)+'s'}</Text></Pressable>)}</View><Text style={styles.label}>Title</Text><TextInput value={title} onChangeText={setTitle} maxLength={120} style={styles.input} placeholder="Announcement title"/><Text style={styles.label}>Message</Text><TextInput value={body} onChangeText={setBody} maxLength={2000} multiline textAlignVertical="top" style={[styles.input,styles.area]} placeholder="Write the announcement..."/><Pressable disabled={busy} onPress={()=>void send()} style={[styles.send,busy&&styles.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<Text style={styles.sendText}>Send announcement</Text>}</Pressable></ScrollView>}
const styles=StyleSheet.create({container:{padding:18},title:{fontSize:30,fontWeight:'800'},sub:{color:'#667085',marginBottom:20},label:{fontWeight:'800',marginTop:12,marginBottom:7},targets:{flexDirection:'row',flexWrap:'wrap',gap:8},target:{paddingHorizontal:13,paddingVertical:9,borderRadius:20,borderWidth:1,borderColor:'#d0d5dd'},selected:{backgroundColor:'#111827'},selectedText:{color:'#fff'},input:{borderWidth:1,borderColor:'#d0d5dd',borderRadius:10,padding:12,fontSize:16},area:{minHeight:150},send:{marginTop:20,padding:14,borderRadius:10,backgroundColor:'#111827',alignItems:'center'},sendText:{color:'#fff',fontWeight:'800'},disabled:{opacity:.5}});
```

## functions/src/admin.ts
```
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { adminAuth, adminDb } from './firebaseAdmin';

const REGION = 'africa-south1';
const ROLES = new Set(['student', 'alumni', 'business', 'administrator']);
const STATUSES = new Set(['active', 'suspended', 'revoked']);
const MODERATION_TYPES = new Set(['post', 'comment', 'profile']);
const MODERATION_ACTIONS = new Set(['dismiss', 'delete']);
const BROADCAST_ROLES = new Set(['all', 'student', 'alumni', 'business']);

interface AdminRequest {
  auth?: { uid?: string | null; token?: Record<string, unknown> | null } | null;
  data?: Record<string, unknown>;
}

function requireAdmin(request: AdminRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  if (request.auth?.token?.role !== 'administrator') {
    throw new HttpsError('permission-denied', 'Administrator role required.');
  }
  if (request.auth?.token?.accountStatus === 'suspended' || request.auth?.token?.accountStatus === 'revoked') {
    throw new HttpsError('permission-denied', 'Administrator account is not active.');
  }
  return uid;
}

function requiredString(value: unknown, field: string, max: number): string {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) throw new HttpsError('invalid-argument', `${field} is required.`);
  return result;
}

async function audit(adminUid: string, action: string, target: string, details: Record<string, unknown>): Promise<void> {
  await adminDb.collection('admin_logs').add({
    adminUid,
    action,
    target,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function updateClaims(uid: string, updates: Record<string, unknown>): Promise<void> {
  const current = await adminAuth.getUser(uid);
  const existing = current.customClaims ?? {};
  await adminAuth.setCustomUserClaims(uid, { ...existing, ...updates });
}

export const manageUserStatus = onCall(
  { region: REGION, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    const adminUid = requireAdmin(request);
    try {
      const targetUid = requiredString(request.data?.uid, 'uid', 128);
      const status = requiredString(request.data?.status, 'status', 32);
      if (!STATUSES.has(status)) throw new HttpsError('invalid-argument', 'Unsupported account status.');
      if (targetUid === adminUid) throw new HttpsError('failed-precondition', 'An administrator cannot suspend or revoke their own account.');

      const userRef = adminDb.collection('users').doc(targetUid);
      const snap = await userRef.get();
      if (!snap.exists) throw new HttpsError('not-found', 'User profile not found.');
      const profile = snap.data() ?? {};
      const role = String(profile.role ?? '');
      if (!ROLES.has(role)) throw new HttpsError('failed-precondition', 'Target user has an invalid role.');
      if (role === 'administrator') throw new HttpsError('permission-denied', 'Administrator accounts require out-of-band governance.');

      const isApproved = status === 'active';
      const now = FieldValue.serverTimestamp();
      await userRef.update({ accountStatus: status, isApproved, updatedAt: now });
      await updateClaims(targetUid, {
        role,
        isApproved,
        accountStatus: status,
      });
      await adminAuth.updateUser(targetUid, { disabled: status !== 'active' });
      await audit(adminUid, 'manage_user_status', targetUid, { role, status, isApproved });
      return { ok: true, uid: targetUid, role, status, isApproved };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('manageUserStatus failed', error);
      throw new HttpsError('internal', 'Unable to change user status.');
    }
  },
);

export const moderateContent = onCall(
  { region: REGION, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    const adminUid = requireAdmin(request);
    try {
      const flagId = requiredString(request.data?.flagId, 'flagId', 128);
      const action = requiredString(request.data?.action, 'action', 32);
      if (!MODERATION_ACTIONS.has(action)) throw new HttpsError('invalid-argument', 'Unsupported moderation action.');

      const flagRef = adminDb.collection('moderation_flags').doc(flagId);
      const flagSnap = await flagRef.get();
      if (!flagSnap.exists) throw new HttpsError('not-found', 'Moderation item not found.');
      const flag = flagSnap.data() ?? {};
      const contentType = String(flag.contentType ?? '');
      if (!MODERATION_TYPES.has(contentType)) throw new HttpsError('failed-precondition', 'Unsupported moderation content type.');
      const contentId = requiredString(flag.contentId, 'contentId', 256);

      const batch = adminDb.batch();
      if (action === 'delete') {
        if (contentType === 'post') {
          const postRef = adminDb.collection('posts').doc(contentId);
          await adminDb.recursiveDelete(postRef);
          const feedItems = await adminDb.collectionGroup('items').where('postId', '==', contentId).limit(500).get();
          for (const item of feedItems.docs) batch.delete(item.ref);
        } else if (contentType === 'comment') {
          const postId = requiredString(flag.parentId, 'parentId', 128);
          batch.delete(adminDb.collection('posts').doc(postId).collection('comments').doc(contentId));
        } else {
          batch.update(adminDb.collection('users').doc(contentId), {
            profileVisibility: 'private',
            moderationRestricted: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      batch.update(flagRef, {
        status: action === 'delete' ? 'resolved_deleted' : 'dismissed',
        reviewedBy: adminUid,
        reviewedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      await audit(adminUid, 'moderate_content', contentId, { flagId, contentType, action });
      return { ok: true, status: action === 'delete' ? 'resolved_deleted' : 'dismissed' };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('moderateContent failed', error);
      throw new HttpsError('internal', 'Unable to complete moderation action.');
    }
  },
);

async function targetUserIds(targetRole: string): Promise<string[]> {
  if (targetRole === 'all') {
    const snapshot = await adminDb.collection('users').where('accountStatus', '==', 'active').limit(10000).get();
    return snapshot.docs.map((doc) => doc.id);
  }
  const snapshot = await adminDb.collection('users').where('role', '==', targetRole).where('accountStatus', '==', 'active').limit(10000).get();
  return snapshot.docs.map((doc) => doc.id);
}

async function sendBroadcast(uids: string[], title: string, body: string, announcementId: string): Promise<{ sent: number; failed: number }> {
  const tokens: string[] = [];
  for (let i = 0; i < uids.length; i += 100) {
    const group = uids.slice(i, i + 100);
    const snapshots = await Promise.all(group.map((uid) => adminDb.collection('users').doc(uid).collection('devices').get()));
    for (const snapshot of snapshots) {
      for (const device of snapshot.docs) {
        const token = String(device.data().token ?? '');
        if (token) tokens.push(token);
      }
    }
  }
  const uniqueTokens = Array.from(new Set(tokens));
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const chunk = uniqueTokens.slice(i, i + 500);
    if (!chunk.length) continue;
    const message: MulticastMessage = {
      tokens: chunk,
      notification: { title, body },
      data: { type: 'admin_broadcast', announcementId },
      android: { priority: 'high', notification: { channelId: 'richfield-connect' } },
      apns: { payload: { aps: { sound: 'default' } } },
    };
    const result = await getMessaging().sendEachForMulticast(message);
    sent += result.successCount;
    failed += result.failureCount;
  }
  return { sent, failed };
}

export const broadcastAnnouncement = onCall(
  { region: REGION, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    const adminUid = requireAdmin(request);
    try {
      const title = requiredString(request.data?.title, 'title', 120);
      const body = requiredString(request.data?.body, 'body', 2000);
      const targetRole = String(request.data?.targetRole ?? 'all').trim();
      if (!BROADCAST_ROLES.has(targetRole)) throw new HttpsError('invalid-argument', 'Invalid target role.');

      const ref = adminDb.collection('announcements').doc();
      await ref.set({
        title,
        body,
        targetRole,
        createdBy: adminUid,
        createdAt: FieldValue.serverTimestamp(),
        status: 'sent',
      });

      const uids = await targetUserIds(targetRole);
      const delivery = await sendBroadcast(uids, title, body, ref.id);
      await ref.update({ recipientCount: uids.length, sentCount: delivery.sent, failedCount: delivery.failed, deliveredAt: Timestamp.now() });
      await audit(adminUid, 'broadcast_announcement', ref.id, { targetRole, recipientCount: uids.length, ...delivery });
      return { ok: true, announcementId: ref.id, recipientCount: uids.length, ...delivery };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('broadcastAnnouncement failed', error);
      throw new HttpsError('internal', 'Unable to broadcast announcement.');
    }
  },
);

export const listAdminUsers = onCall(
  { region: REGION, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    requireAdmin(request);
    try {
      const role = String(request.data?.role ?? 'all');
      const status = String(request.data?.status ?? 'all');
      if (role !== 'all' && !ROLES.has(role)) throw new HttpsError('invalid-argument', 'Invalid role filter.');
      if (status !== 'all' && !STATUSES.has(status)) throw new HttpsError('invalid-argument', 'Invalid status filter.');
      let query = adminDb.collection('users').orderBy('createdAt', 'desc').limit(200);
      if (role !== 'all') query = query.where('role', '==', role);
      if (status !== 'all') query = query.where('accountStatus', '==', status);
      const snapshot = await query.get();
      return { users: snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })) };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('listAdminUsers failed', error);
      throw new HttpsError('internal', 'Unable to list users.');
    }
  },
);

export const listModerationQueue = onCall(
  { region: REGION, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    requireAdmin(request);
    try {
      const snapshot = await adminDb.collection('moderation_flags').where('status', '==', 'open').orderBy('createdAt', 'desc').limit(200).get();
      return { flags: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('listModerationQueue failed', error);
      throw new HttpsError('internal', 'Unable to load moderation queue.');
    }
  },
);
```

## firestore/firestore.rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function role(r) { return signedIn() && request.auth.token.role == r; }
    function isAdmin() { return role('administrator') && request.auth.token.accountStatus != 'suspended' && request.auth.token.accountStatus != 'revoked'; }
    function isOwner(uid) { return signedIn() && request.auth.uid == uid; }
    function activeUser() { return signedIn() && request.auth.token.accountStatus != 'suspended' && request.auth.token.accountStatus != 'revoked'; }
    function approvedUser() { return activeUser() && (request.auth.token.role != 'business' || request.auth.token.isApproved == true); }
    function sameImmutableUserFields() {
      return request.resource.data.uid == resource.data.uid
        && request.resource.data.email == resource.data.email
        && request.resource.data.role == resource.data.role
        && request.resource.data.isApproved == resource.data.isApproved
        && request.resource.data.accountStatus == resource.data.accountStatus;
    }
    function validVisibility(v) {
      return v == 'public' || v == 'connections' || v == 'private';
    }

    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow create: if false;
      allow update: if isOwner(uid) && sameImmutableUserFields();
      allow delete: if false;
      match /devices/{deviceId} { allow read, write: if false; }
    }

    match /alumni_registry/{recordId} { allow read, write: if false; }
    match /alumni_verification_requests/{requestId} { allow read, write: if false; }
    match /registration_intents/{intentId} { allow read, write: if false; }

    match /connection_requests/{requestId} {
      allow read: if activeUser() && (resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid || isAdmin());
      allow create, update, delete: if false;
    }
    match /connections/{uid}/members/{memberUid} { allow read: if isOwner(uid) || isAdmin(); allow write: if false; }

    match /posts/{postId} {
      allow read: if approvedUser();
      allow create, update, delete: if false;
      match /comments/{commentId} { allow read: if approvedUser(); allow write: if false; }
      match /reactions/{reactionUid} { allow read: if approvedUser(); allow write: if false; }
    }
    match /feeds/{uid}/items/{itemId} { allow read: if (isOwner(uid) && approvedUser()) || isAdmin(); allow write: if false; }

    match /conversations/{conversationId} {
      allow read: if approvedUser() && request.auth.uid in resource.data.memberUids;
      allow write: if false;
      match /messages/{messageId} { allow read: if approvedUser() && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.memberUids; allow write: if false; }
    }

    match /videos/{videoId} { allow read: if approvedUser() && (resource.data.uid == request.auth.uid || isAdmin()); allow write: if false; }

    match /opportunities/{opportunityId} {
      allow read: if approvedUser() && (resource.data.status == 'approved' || isAdmin() || resource.data.ownerUid == request.auth.uid);
      allow write: if false;
      match /applications/{studentUid} {
        allow read: if isAdmin() || (isOwner(studentUid) && approvedUser()) || (approvedUser() && get(/databases/$(database)/documents/opportunities/$(opportunityId)).data.ownerUid == request.auth.uid);
        allow write: if false;
      }
    }
    match /matches/{uid}/opportunities/{opportunityId} { allow read: if isOwner(uid) && approvedUser() || isAdmin(); allow write: if false; }
    match /opportunity_views/{viewId} { allow read, write: if false; }
    match /skill_demand/{skill} { allow read: if approvedUser(); allow write: if false; }
    match /profile_views/{viewId} { allow read, write: if false; }

    match /announcements/{announcementId} {
      allow read: if activeUser() && (resource.data.targetRole == 'all' || resource.data.targetRole == request.auth.token.role || isAdmin());
      allow write: if false;
    }

    match /moderation_flags/{flagId} { allow read: if isAdmin(); allow write: if false; }
    match /admin_logs/{logId} { allow read: if isAdmin(); allow write: if false; }
    match /analytics/{document=**} { allow read, write: if false; }

    match /admin/{document=**} { allow read, write: if isAdmin(); }
  }
}
```

## firestore.indexes.json
```
{
  "indexes": [
    {
      "collectionGroup": "moderation_flags",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "accountStatus", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## functions/src/videoProcessing.ts
```
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
    inputUri: `gs://${bucket}/${name}`,
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

## src/navigation/RootNavigator.tsx
```
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
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { ModerationQueueScreen } from '../screens/admin/ModerationQueueScreen';
import { BroadcastScreen } from '../screens/admin/BroadcastScreen';
import { AccountScreen } from '../screens/system/AccountScreen';
import { PortfolioScreen } from '../screens/profile/PortfolioScreen';
import { ProfileAssistantScreen } from '../screens/profile/ProfileAssistantScreen';
import { OnboardingScreen } from '../screens/profile/OnboardingScreen';
import { FeedScreen } from '../screens/social/FeedScreen';
import { ConnectionsScreen } from '../screens/social/ConnectionsScreen';
import { MessagesScreen } from '../screens/social/MessagesScreen';
import { OpportunityBoardScreen } from '../screens/opportunities/OpportunityBoardScreen';
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

type RoleTabParamList = { Dashboard: undefined; Feed: undefined; Connections: undefined; Messages: undefined; Opportunities: undefined; Portfolio: undefined; Assistant: undefined; Moderation: undefined; Broadcast: undefined; Account: undefined };
const RootStack = createNativeStackNavigator<RootStackParamList>();
const StudentTabs = createBottomTabNavigator<RoleTabParamList>();
const AlumniTabs = createBottomTabNavigator<RoleTabParamList>();
const BusinessTabs = createBottomTabNavigator<RoleTabParamList>();
const AdminTabs = createBottomTabNavigator<RoleTabParamList>();

function RoleTabs({ dashboard, showAssistant = true }: { dashboard: React.ComponentType; showAssistant?: boolean }) {
  return <StudentTabs.Navigator><StudentTabs.Screen name="Dashboard" component={dashboard} /><StudentTabs.Screen name="Feed" component={FeedScreen} /><StudentTabs.Screen name="Connections" component={ConnectionsScreen} /><StudentTabs.Screen name="Messages" component={MessagesScreen} /><StudentTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><StudentTabs.Screen name="Portfolio" component={PortfolioScreen} />{showAssistant && <StudentTabs.Screen name="Assistant" component={ProfileAssistantScreen} />}<StudentTabs.Screen name="Account" component={AccountScreen} /></StudentTabs.Navigator>;
}
function AlumniRoleTabs() { return <AlumniTabs.Navigator><AlumniTabs.Screen name="Dashboard" component={AlumniDashboard} /><AlumniTabs.Screen name="Feed" component={FeedScreen} /><AlumniTabs.Screen name="Connections" component={ConnectionsScreen} /><AlumniTabs.Screen name="Messages" component={MessagesScreen} /><AlumniTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><AlumniTabs.Screen name="Portfolio" component={PortfolioScreen} /><AlumniTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><AlumniTabs.Screen name="Account" component={AccountScreen} /></AlumniTabs.Navigator>; }
function BusinessRoleTabs() { return <BusinessTabs.Navigator><BusinessTabs.Screen name="Dashboard" component={BusinessDashboard} /><BusinessTabs.Screen name="Feed" component={FeedScreen} /><BusinessTabs.Screen name="Connections" component={ConnectionsScreen} /><BusinessTabs.Screen name="Messages" component={MessagesScreen} /><BusinessTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><BusinessTabs.Screen name="Portfolio" component={PortfolioScreen} /><BusinessTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><BusinessTabs.Screen name="Account" component={AccountScreen} /></BusinessTabs.Navigator>; }
function AdminRoleTabs() { return <AdminTabs.Navigator><AdminTabs.Screen name="Dashboard" component={AdminDashboardScreen} /><AdminTabs.Screen name="Moderation" component={ModerationQueueScreen} /><AdminTabs.Screen name="Broadcast" component={BroadcastScreen} /><AdminTabs.Screen name="Feed" component={FeedScreen} /><AdminTabs.Screen name="Connections" component={ConnectionsScreen} /><AdminTabs.Screen name="Messages" component={MessagesScreen} /><AdminTabs.Screen name="Portfolio" component={PortfolioScreen} /><AdminTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><AdminTabs.Screen name="Account" component={AccountScreen} /></AdminTabs.Navigator>; }
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

## src/types/auth.ts
```
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
```

## PHASE-5-POPIA-AND-BUILD-CHECKLIST.md
```
# Richfield Connect — Phase 5 Production Verification & POPIA Sign-off Checklist

## Scope
This checklist is the release gate for the final Phase 5 build. It is an engineering and compliance readiness checklist, not a legal opinion or a declaration by the Information Regulator that the application is compliant.

## Android release verification

- [ ] `npm ci` completes from a clean checkout.
- [ ] `npm run typecheck` completes with zero errors.
- [ ] `cd functions && npm ci && npm run build` completes with zero errors.
- [ ] Firebase project ID, Android package name, SHA-1/SHA-256 fingerprints and `google-services.json` match the production Firebase project.
- [ ] App Check is enforced in production and debug providers are not enabled in the release build.
- [ ] Email-link authentication deep links open the production application and complete successfully on a physical Android device.
- [ ] Student domain registration is rejected server-side for non-approved domains.
- [ ] Alumni verification returns a generic failure response for unmatched records and does not reveal registry membership.
- [ ] Business accounts remain blocked until administrator approval.
- [ ] Suspend/revoke immediately disables the Firebase Auth account and removes platform access after token refresh.
- [ ] Administrator accounts cannot be self-registered and administrator management cannot target another administrator through the mobile panel.
- [ ] Firestore Rules emulator tests cover every collection and all allow/deny boundaries.
- [ ] Storage Rules reject raw video downloads and unauthorized uploads.
- [ ] FCM foreground/background notification delivery is tested on physical Android hardware.
- [ ] Transcoder output is H.264/AAC at the configured 720p profile and a thumbnail is generated.
- [ ] Transcoder input uses the complete Storage object name: `gs://${bucket}/${name}`.
- [ ] Release APK/AAB is signed with the production signing key and verified from a clean install.

## iOS release verification

- [ ] `pod install` completes from a clean checkout.
- [ ] `npm run typecheck` completes with zero errors.
- [ ] Firebase iOS configuration matches the production bundle identifier.
- [ ] APNs key/certificate is configured for the production Firebase project.
- [ ] App Check is enforced for the production iOS bundle.
- [ ] Universal/deep-link handling completes the alumni email-link flow on a physical iPhone.
- [ ] FCM foreground/background delivery is tested on physical iOS hardware.
- [ ] Production archive succeeds in Xcode with no signing warnings.
- [ ] Release archive is exported using the correct distribution profile and verified by installing through the intended distribution channel.
- [ ] Suspend/revoke, moderation, broadcast and role routing are verified on iOS.

## Backend release verification

- [ ] `firebase deploy --only firestore:rules,firestore:indexes,functions,storage` succeeds against the intended production project.
- [ ] Production Functions are deployed in the configured region and have least-privilege service configuration.
- [ ] `AI_API_KEY` and all other secrets are stored in the Functions secret manager; no secret is bundled into React Native.
- [ ] Administrator provisioning is performed only through the Admin SDK provisioning process.
- [ ] `admin_logs` records user lifecycle, moderation and broadcast actions with administrator UID, action, target and timestamp.
- [ ] Firestore indexes deploy successfully.
- [ ] Rate limiting and App Check are enabled for all privileged callable functions.
- [ ] Logs do not contain national IDs, passwords, authentication tokens, FCM registration tokens, CV contents or unnecessary personal information.

## POPIA engineering readiness

### Governance
- [ ] Richfield identifies the responsible party and formally assigns/registers the Information Officer as required.
- [ ] A documented processing inventory exists for student, alumni, business and administrator data.
- [ ] A documented retention/deletion schedule exists for profiles, CVs, messages, moderation records, analytics and security logs.
- [ ] Operator/data-processing agreements are in place for Firebase/Google Cloud and any AI provider used for CV/profile processing.
- [ ] Cross-border processing and international data transfers have been assessed and approved where required.
- [ ] A privacy notice explains purposes, categories of information, recipients/operators, retention, rights and complaint channels.
- [ ] Data-subject access, correction, deletion/restriction and objection workflows are documented and operational.

### Security safeguards
- [ ] Least-privilege Firebase IAM is applied.
- [ ] Firestore and Storage deny-by-default rules are deployed.
- [ ] Authentication is enforced for protected data and privileged Functions use App Check.
- [ ] Administrator actions are auditable.
- [ ] Sensitive verification data is not exposed through client-readable collections.
- [ ] Security monitoring and incident response procedures are documented.
- [ ] Backups, exports and logs are protected with appropriate access controls.

### Security compromise response
- [ ] A breach-response runbook names the Information Officer/Deputy Information Officer and technical incident owner.
- [ ] The team can identify affected data subjects and the categories of personal information involved.
- [ ] The organisation can notify the Information Regulator and affected data subjects as required by POPIA section 22.
- [ ] The Information Regulator eServices security-compromise reporting path has been tested or documented.

## POPIA sign-off status

**Engineering status:** READY FOR FORMAL COMPLIANCE REVIEW only after every unchecked item above is evidenced.

**Legal/regulatory status:** NOT SELF-CERTIFIED. Final POPIA sign-off must be issued by Richfield's authorised Information Officer/legal/compliance function. This checklist does not constitute a legal opinion or approval by the Information Regulator.

## Evidence pack

Retain the following with the release record:

1. Firestore Rules emulator test report.
2. Storage Rules test report.
3. Android release build hash and test matrix.
4. iOS release archive/test matrix.
5. Firebase Functions deployment output.
6. Admin provisioning audit record.
7. Penetration/security test report.
8. Privacy impact/risk assessment and processing inventory.
9. Operator agreements and cross-border transfer assessment.
10. POPIA privacy notice and data-subject rights procedure.
11. Security incident response and section 22 notification procedure.
```

