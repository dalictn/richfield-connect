import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HelperText, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { sendDirectMessage, subscribeMessages } from '../../social/socialService';
import type { DirectMessage } from '../../types/social';

export function ConversationScreen({ conversationId, targetUid }: { conversationId: string; targetUid: string }) {
  const { firebaseUser } = useAuth();
  const theme = useTheme();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [threadExists, setThreadExists] = useState(true);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => subscribeMessages(
    conversationId,
    (next) => { setMessages(next); setThreadExists(true); setError(''); },
    // A brand-new conversation has no document yet, so the rules can't confirm
    // membership until the first message creates it. That's expected, not an error.
    () => setThreadExists(false),
  ), [conversationId, threadExists]);

  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }); }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true); setError('');
    try {
      await sendDirectMessage(targetUid, text);
      setBody('');
      if (!threadExists) setThreadExists(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView ref={scroll} contentContainerStyle={styles.thread}>
        {messages.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No messages yet — say hello.</Text>
        ) : messages.map((message) => {
          const mine = message.senderUid === firebaseUser?.uid;
          return (
            <View
              key={message.id}
              style={[
                styles.bubble,
                mine
                  ? { alignSelf: 'flex-end', backgroundColor: theme.colors.primary }
                  : { alignSelf: 'flex-start', backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant, borderWidth: 1 },
              ]}
            >
              <Text style={{ color: mine ? theme.colors.onPrimary : theme.colors.onSurface }}>{message.body}</Text>
            </View>
          );
        })}
      </ScrollView>
      {error ? <HelperText type="error" style={styles.error}>{error}</HelperText> : null}
      <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
        <TextInput
          mode="outlined"
          dense
          placeholder="Write a message"
          value={body}
          onChangeText={setBody}
          onSubmitEditing={() => void send()}
          style={styles.input}
        />
        <IconButton icon="send" mode="contained" disabled={!body.trim() || sending} onPress={() => void send()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  thread: { padding: 16, gap: 8, width: '100%', maxWidth: 760, alignSelf: 'center' },
  empty: { textAlign: 'center', marginTop: 24 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  error: { paddingHorizontal: 16 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderTopWidth: 1 },
  input: { flex: 1 },
});
