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
