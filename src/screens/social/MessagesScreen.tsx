import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Card, HelperText, List, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';
import { subscribeConnections, subscribeConversations } from '../../social/socialService';
import type { ConnectionMember, Conversation } from '../../types/social';
import type { MessagesStackParamList } from '../../navigation/MessagesStack';
import { initials, ROLE_LABELS, useMembers } from '../../members/memberService';

type Navigation = NativeStackNavigationProp<MessagesStackParamList, 'MessagesList'>;

/** Conversation ids are the two member uids sorted and joined — must match the server. */
const conversationIdFor = (a: string, b: string) => [a, b].sort().join('_');

export function MessagesScreen() {
  const { firebaseUser } = useAuth();
  const navigation = useNavigation<Navigation>();
  const theme = useTheme();
  const uid = firebaseUser?.uid;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [connections, setConnections] = useState<ConnectionMember[]>([]);
  const [error, setError] = useState('');

  useEffect(() => (uid ? subscribeConversations(uid, setConversations, (e) => setError(e.message)) : undefined), [uid]);
  useEffect(() => (uid ? subscribeConnections(uid, setConnections, (e) => setError(e.message)) : undefined), [uid]);

  const other = (conversation: Conversation) => conversation.memberUids.find((id) => id !== uid) ?? '';
  const people = useMembers([...conversations.map(other), ...connections.map((c) => c.uid)]);

  const open = (targetUid: string) => {
    if (!uid || !targetUid) return;
    navigation.navigate('Conversation', {
      conversationId: conversationIdFor(uid, targetUid),
      targetUid,
      title: people[targetUid]?.displayName ?? 'Conversation',
    });
  };

  const withThread = new Set(conversations.map(other));
  const startable = connections.filter((c) => !withThread.has(c.uid));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {error ? <HelperText type="error">{error}</HelperText> : null}

      <Text variant="titleMedium" style={styles.heading}>Conversations</Text>
      {conversations.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No conversations yet. Start one with a connection below.</Text>
      ) : (
        <Card mode="outlined" style={styles.card}>
          {conversations.map((conversation) => {
            const target = other(conversation);
            const name = people[target]?.displayName ?? 'Loading…';
            return (
              <List.Item
                key={conversation.id}
                title={name}
                description={conversation.lastMessage || 'No messages yet'}
                descriptionNumberOfLines={1}
                left={() => <Avatar.Text size={40} label={initials(name)} style={styles.avatar} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => open(target)}
              />
            );
          })}
        </Card>
      )}

      <Text variant="titleMedium" style={styles.heading}>Start a conversation</Text>
      {startable.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
          {connections.length ? 'You already have a thread with every connection.' : 'Messaging is available once you have connections.'}
        </Text>
      ) : (
        <Card mode="outlined" style={styles.card}>
          {startable.map((connection) => {
            const person = people[connection.uid];
            const name = person?.displayName ?? 'Loading…';
            return (
              <List.Item
                key={connection.uid}
                title={name}
                description={person ? ROLE_LABELS[person.role] ?? person.role : ''}
                left={() => <Avatar.Text size={40} label={initials(name)} style={styles.avatar} />}
                right={(props) => <List.Icon {...props} icon="message-plus-outline" />}
                onPress={() => open(connection.uid)}
              />
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  heading: { marginTop: 8, marginBottom: 8 },
  card: { marginBottom: 12 },
  empty: { marginBottom: 12 },
  avatar: { marginLeft: 8, alignSelf: 'center' },
});
