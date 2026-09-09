import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';
import { sendDirectMessage, subscribeConversations } from '../../social/socialService';
import type { Conversation } from '../../types/social';
import type { MessagesStackParamList } from '../../navigation/MessagesStack';

type Navigation = NativeStackNavigationProp<MessagesStackParamList, 'MessagesList'>;

export function MessagesScreen() {
  const { firebaseUser } = useAuth();
  const navigation = useNavigation<Navigation>();
  const [items, setItems] = useState<Conversation[]>([]);
  const [targetUid, setTargetUid] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => firebaseUser ? subscribeConversations(firebaseUser.uid, setItems, e => setMessage(e.message)) : undefined, [firebaseUser]);

  function otherMember(conversation: Conversation): string {
    return conversation.memberUids.find(id => id !== firebaseUser?.uid) ?? '';
  }

  function openConversation(conversation: Conversation) {
    const other = otherMember(conversation);
    if (!other) return;
    navigation.navigate('Conversation', { conversationId: conversation.id, targetUid: other, title: other });
  }

  async function send() {
    if (!targetUid.trim() || !body.trim()) return;
    try {
      const result = await sendDirectMessage(targetUid.trim(), body.trim());
      setBody('');
      setMessage('Message sent.');
      navigation.navigate('Conversation', { conversationId: result.conversationId, targetUid: targetUid.trim(), title: targetUid.trim() });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to send message.');
    }
  }

  return <View style={{ flex: 1, padding: 16 }}>
    <Text style={{ fontSize: 26, fontWeight: '800', marginBottom: 4 }}>Messages</Text>
    <Text style={{ color: '#6b7280', marginBottom: 12 }}>Start a conversation with a connected user, or open an existing thread below.</Text>
    <TextInput value={targetUid} onChangeText={setTargetUid} placeholder="Connected user's UID" style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8 }} />
    <TextInput value={body} onChangeText={setBody} placeholder="Message" multiline style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, minHeight: 80, marginBottom: 8 }} />
    <Pressable onPress={send} style={{ backgroundColor: '#111827', padding: 12, borderRadius: 8, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Send direct message</Text></Pressable>
    {message ? <Text style={{ marginVertical: 10 }}>{message}</Text> : null}
    <Text style={{ fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 8 }}>Conversations</Text>
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      ListEmptyComponent={<Text style={{ color: '#666' }}>No conversations yet.</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => openConversation(item)} style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontWeight: '700' }}>{otherMember(item) || 'Conversation'}</Text>
          <Text style={{ color: '#666' }} numberOfLines={1}>{item.lastMessage || 'No messages yet.'}</Text>
        </Pressable>
      )}
    />
  </View>;
}
