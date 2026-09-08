import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { sendProfileAssistantMessage } from '../../profile/profileService';
import type { ProfileAssistantMessage } from '../../types/portfolio';

export function ProfileAssistantScreen() {
  const { firebaseUser } = useAuth();
  const [messages, setMessages] = useState<ProfileAssistantMessage[]>(() => [{ id: 'welcome', role: 'assistant', content: 'Hi! I can help you improve your Richfield Connect profile. Ask me what to improve, how to describe a project, or how to make your skills more discoverable.', createdAt: Date.now() }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const suggestions = useMemo(() => ['What should I improve first?', 'Help me write a stronger headline.', 'How can I make my skills more searchable?'], []);

  const send = async (preset?: string) => {
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
      setMessages((current) => [...current, { id: `${Date.now()}-error`, role: 'assistant', content: error instanceof Error ? error.message : 'The assistant is unavailable right now.', createdAt: Date.now() }]);
    } finally {
      setSending(false);
    }
  };

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.messages}>
      <Text style={styles.title}>Profile Assistant</Text>
      <Text style={styles.subtitle}>Context-aware coaching for your professional portfolio.</Text>
      {messages.map((message) => <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.user : styles.assistant]}><Text style={styles.bubbleText}>{message.content}</Text></View>)}
      {sending && <ActivityIndicator />}
      <View style={styles.suggestions}>{suggestions.map((item) => <Button key={item} title={item} onPress={() => void send(item)} disabled={sending} />)}</View>
    </ScrollView>
    <View style={styles.composer}><TextInput value={input} onChangeText={setInput} style={styles.input} placeholder="Ask about your profile…" multiline /><Button title="Send" onPress={() => void send()} disabled={sending || !input.trim()} /></View>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, messages: { padding: 20, gap: 12 }, title: { fontSize: 28, fontWeight: '800' }, subtitle: { color: '#66717d', marginBottom: 8 }, bubble: { borderRadius: 14, padding: 14, maxWidth: '92%' }, user: { alignSelf: 'flex-end', backgroundColor: '#dceeff' }, assistant: { alignSelf: 'flex-start', backgroundColor: '#f0f2f4' }, bubbleText: { lineHeight: 21 }, suggestions: { gap: 6, marginTop: 8 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#ddd', backgroundColor: '#fff' }, input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: '#cbd2d9', borderRadius: 10, padding: 10 },
});
