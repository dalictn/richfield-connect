import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { commentOnPost, createPost, reactToPost, reportContent, subscribeFeed, subscribePosts } from '../../social/socialService';
import type { FeedItem, SocialPost } from '../../types/social';

export function FeedScreen() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [body, setBody] = useState('');
  const [comment, setComment] = useState<Record<string, string>>({});
  const [reportReason, setReportReason] = useState<Record<string, string>>({});
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  async function submitReport(postId: string) {
    const reason = reportReason[postId]?.trim();
    if (!reason) return;
    setError(''); setNotice('');
    try {
      const result = await reportContent({ contentType: 'post', contentId: postId, reason });
      setReportReason((old) => ({ ...old, [postId]: '' }));
      setReportingPostId(null);
      setNotice(result.alreadyReported ? 'You have already reported this post. An administrator is reviewing it.' : 'Report sent to the moderation team. Thank you.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit this report.');
    }
  }
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
    {notice ? <Text style={{ color: '#166534', marginBottom: 8 }}>{notice}</Text> : null}
    <FlatList data={orderedPosts} keyExtractor={(item) => item.id} ListEmptyComponent={<Text style={{ color: '#666', paddingVertical: 20 }}>Your ranked feed will appear here as you and your connections post.</Text>} renderItem={({ item }) => <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <Text style={{ fontWeight: '800' }}>{item.authorDisplayName || item.uid}</Text>
      <Text style={{ color: '#6b7280', marginBottom: 8 }}>{item.authorRole}</Text>
      <Text style={{ fontSize: 16, lineHeight: 23 }}>{item.body}</Text>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, alignItems: 'center' }}><Pressable onPress={() => react(item.id)}><Text>👍 {item.reactionCount}</Text></Pressable><Text>💬 {item.commentCount}</Text>{item.uid !== uid ? <Pressable onPress={() => setReportingPostId((current) => (current === item.id ? null : item.id))}><Text style={{ color: '#6b7280' }}>{reportingPostId === item.id ? 'Cancel' : '⚑ Report'}</Text></Pressable> : null}</View>
      {reportingPostId === item.id ? <View style={{ marginTop: 10, padding: 10, borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, backgroundColor: '#fef2f2' }}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Why are you reporting this post?</Text>
        <TextInput value={reportReason[item.id] || ''} onChangeText={(value) => setReportReason((old) => ({ ...old, [item.id]: value }))} placeholder="e.g. harassment, spam, misleading claims" multiline style={{ borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, padding: 10, minHeight: 60, backgroundColor: '#fff' }} />
        <Pressable onPress={() => void submitReport(item.id)} style={{ marginTop: 8, backgroundColor: '#b42318', padding: 10, borderRadius: 8, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Submit report</Text></Pressable>
      </View> : null}
      <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}><TextInput value={comment[item.id] || ''} onChangeText={(value) => setComment((old) => ({ ...old, [item.id]: value }))} placeholder="Write a comment" style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10 }} /><Pressable onPress={() => commentPost(item.id)} style={{ padding: 10 }}><Text style={{ fontWeight: '700' }}>Send</Text></Pressable></View>
    </View>} />
  </View>;
}
