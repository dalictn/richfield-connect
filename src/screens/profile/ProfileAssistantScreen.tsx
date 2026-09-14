import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { sendProfileAssistantMessage } from '../../profile/profileService';
import type { ProfileAssistantMessage } from '../../types/portfolio';

const SUGGESTIONS = [
  'What should I improve first?',
  'Help me write a stronger headline.',
  'How can I make my skills more searchable?',
  'What kind of posts get employer attention?',
];

/**
 * Ongoing AI coaching (brief §2.6). Each message is answered with the member's
 * live profile as context, so advice is specific rather than generic.
 */
export function ProfileAssistantScreen() {
  const { firebaseUser, profile } = useAuth();
  const theme = useTheme();
  const scroll = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ProfileAssistantMessage[]>(() => [{
    id: 'welcome',
    role: 'assistant',
    content: `Hi${profile?.displayName ? ` ${profile.displayName.split(' ')[0]}` : ''}! I can see your profile, so ask me what to improve, how to describe a project, or how to get noticed by employers.`,
    createdAt: Date.now(),
  }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }); }, [messages.length, sending]);

  async function send(preset?: string) {
    if (!firebaseUser || sending) return;
    const content = (preset ?? input).trim();
    if (!content) return;
    const userMessage: ProfileAssistantMessage = { id: `${Date.now()}-user`, role: 'user', content, createdAt: Date.now() };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const answer = await sendProfileAssistantMessage(firebaseUser.uid, content, next);
      setMessages((current) => [...current, answer]);
    } catch (error) {
      setMessages((current) => [...current, {
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'The assistant is unavailable right now.',
        createdAt: Date.now(),
      }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView ref={scroll} contentContainerStyle={styles.thread}>
        <Card mode="contained" style={[styles.header, { backgroundColor: theme.colors.primaryContainer }]}>
          <Card.Title
            title="Profile assistant"
            subtitle="Powered by Google Gemini · uses your live profile"
            titleStyle={{ color: theme.colors.onPrimaryContainer }}
            subtitleStyle={{ color: theme.colors.onPrimaryContainer }}
            left={(props) => <Avatar.Icon {...props} icon="robot-happy-outline" />}
          />
        </Card>

        {messages.map((message) => {
          const mine = message.role === 'user';
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
              <Text variant="bodyLarge" style={{ color: mine ? theme.colors.onPrimary : theme.colors.onSurface, lineHeight: 23 }}>
                {message.content}
              </Text>
            </View>
          );
        })}

        {sending ? (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Thinking about your profile…</Text>
          </View>
        ) : null}

        <View style={styles.suggestions}>
          {SUGGESTIONS.map((item) => (
            <Chip key={item} icon="lightbulb-on-outline" disabled={sending} onPress={() => void send(item)}>{item}</Chip>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
        <TextInput
          mode="outlined"
          dense
          placeholder="Ask about your profile…"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => void send()}
          style={styles.input}
        />
        <IconButton icon="send" mode="contained" disabled={sending || !input.trim()} onPress={() => void send()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  thread: { padding: 16, gap: 10, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { marginBottom: 4 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderTopWidth: 1 },
  input: { flex: 1 },
});
