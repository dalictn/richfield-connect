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
