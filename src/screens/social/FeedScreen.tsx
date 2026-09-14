import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Dialog, HelperText, IconButton, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { commentOnPost, createPost, reactToPost, reportContent, subscribeFeed, subscribePosts } from '../../social/socialService';
import type { FeedItem, SocialPost } from '../../types/social';
import { initials, ROLE_LABELS } from '../../members/memberService';
import { timeAgo } from '../../notifications/inboxService';

export function FeedScreen() {
  const { firebaseUser } = useAuth();
  const theme = useTheme();
  const uid = firebaseUser?.uid;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [body, setBody] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [reporting, setReporting] = useState<SocialPost | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => (uid ? subscribeFeed(uid, setItems, (e) => setError(e.message)) : undefined), [uid]);
  useEffect(() => subscribePosts(items.map((item) => item.postId), setPosts, (e) => setError(e.message)), [items]);

  // The feed collection holds per-viewer scores; posts hold the content. Keep the ranked order.
  const ordered = useMemo(() => {
    const byId = new Map(posts.map((post) => [post.id, post]));
    return items.map((item) => byId.get(item.postId)).filter(Boolean) as SocialPost[];
  }, [items, posts]);

  async function publish() {
    if (!body.trim() || publishing) return;
    setPublishing(true); setError('');
    try {
      await createPost(body.trim());
      setBody('');
      setNotice('Posted to your network.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to publish.');
    } finally {
      setPublishing(false);
    }
  }

  async function react(postId: string) {
    try { await reactToPost(postId, 'like'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to react.'); }
  }

  async function sendComment(postId: string) {
    const value = comment.trim();
    if (!value) return;
    try {
      await commentOnPost(postId, value);
      setComment('');
      setOpenComment(null);
      setNotice('Comment added.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to comment.');
    }
  }

  async function submitReport() {
    if (!reporting || !reason.trim()) return;
    try {
      const result = await reportContent({ contentType: 'post', contentId: reporting.id, reason: reason.trim() });
      setNotice(result.alreadyReported ? 'You already reported this post; an administrator is reviewing it.' : 'Report sent to the moderation team.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit this report.');
    } finally {
      setReporting(null);
      setReason('');
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.composer}>
            <TextInput
              mode="outlined"
              placeholder="Share a professional update, a win or a lesson learned…"
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={3}
            />
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" icon="send" loading={publishing} disabled={publishing || !body.trim()} onPress={() => void publish()}>Post</Button>
          </Card.Actions>
        </Card>

        {error ? <HelperText type="error">{error}</HelperText> : null}

        {ordered.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
            Your feed fills up as you and your connections post. It's ranked for your role, so you see what matters to you first.
          </Text>
        ) : ordered.map((post) => {
          const name = post.authorDisplayName || 'Richfield member';
          return (
            <Card key={post.id} mode="outlined" style={styles.card}>
              <Card.Title
                title={name}
                subtitle={[ROLE_LABELS[post.authorRole] ?? post.authorRole, timeAgo(post.createdAt)].filter(Boolean).join(' · ')}
                left={(props) => <Avatar.Text {...props} label={initials(name)} />}
                right={() => post.uid !== uid ? (
                  <IconButton icon="flag-outline" onPress={() => setReporting(post)} accessibilityLabel="Report post" />
                ) : null}
              />
              <Card.Content>
                <Text variant="bodyLarge" style={styles.body}>{post.body}</Text>
              </Card.Content>
              <Card.Actions style={styles.actions}>
                <Button mode="text" icon="thumb-up-outline" onPress={() => void react(post.id)}>{post.reactionCount}</Button>
                <Button mode="text" icon="comment-outline" onPress={() => { setOpenComment(openComment === post.id ? null : post.id); setComment(''); }}>{post.commentCount}</Button>
              </Card.Actions>
              {openComment === post.id ? (
                <Card.Content style={styles.commentRow}>
                  <TextInput mode="outlined" dense placeholder="Write a comment" value={comment} onChangeText={setComment} onSubmitEditing={() => void sendComment(post.id)} style={styles.commentInput} />
                  <IconButton icon="send" mode="contained-tonal" disabled={!comment.trim()} onPress={() => void sendComment(post.id)} />
                </Card.Content>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>

      <Portal>
        <Dialog visible={Boolean(reporting)} onDismiss={() => { setReporting(null); setReason(''); }}>
          <Dialog.Title>Report this post</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>An administrator will review it. Your report is not shown to the author.</Text>
            <TextInput mode="outlined" label="Reason" placeholder="e.g. harassment, spam, misleading claims" value={reason} onChangeText={setReason} multiline />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setReporting(null); setReason(''); }}>Cancel</Button>
            <Button mode="contained" buttonColor={theme.colors.error} disabled={!reason.trim()} onPress={() => void submitReport()}>Report</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={3000}>{notice}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: { marginBottom: 12 },
  composer: { paddingTop: 8 },
  empty: { textAlign: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  body: { lineHeight: 24 },
  actions: { justifyContent: 'flex-start' },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 12 },
  commentInput: { flex: 1 },
  dialogText: { marginBottom: 12 },
});
