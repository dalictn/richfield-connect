import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, HelperText, List, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';
import { respondToConnectionRequest, subscribeConnections, subscribeIncomingRequests } from '../../social/socialService';
import type { ConnectionMember, ConnectionRequest } from '../../types/social';
import type { ConnectionsStackParamList } from '../../navigation/ConnectionsStack';
import { initials, ROLE_LABELS, useMembers } from '../../members/memberService';

type Navigation = NativeStackNavigationProp<ConnectionsStackParamList, 'ConnectionsHome'>;

export function ConnectionsScreen() {
  const { firebaseUser } = useAuth();
  const navigation = useNavigation<Navigation>();
  const theme = useTheme();
  const uid = firebaseUser?.uid;
  const [members, setMembers] = useState<ConnectionMember[]>([]);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => (uid ? subscribeConnections(uid, setMembers, (e) => setMessage(e.message)) : undefined), [uid]);
  useEffect(() => (uid ? subscribeIncomingRequests(uid, setRequests, (e) => setMessage(e.message)) : undefined), [uid]);

  const people = useMembers([...requests.map((r) => r.fromUid), ...members.map((m) => m.uid)]);

  async function respond(id: string, decision: 'accept' | 'decline') {
    setBusyId(id); setMessage('');
    try {
      await respondToConnectionRequest(id, decision);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to respond.');
    } finally {
      setBusyId(null);
    }
  }

  const describe = (memberUid: string) => {
    const person = people[memberUid];
    if (!person) return '';
    return [ROLE_LABELS[person.role] ?? person.role, person.companyName || person.headline].filter(Boolean).join(' · ');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card mode="contained" style={[styles.find, { backgroundColor: theme.colors.primaryContainer }]} onPress={() => navigation.navigate('Directory')}>
        <Card.Title
          title="Find people"
          subtitle="Search students, alumni and employers by name, skill or campus"
          titleStyle={{ color: theme.colors.onPrimaryContainer }}
          subtitleStyle={{ color: theme.colors.onPrimaryContainer }}
          left={(props) => <Avatar.Icon {...props} icon="account-search" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onPrimaryContainer} />}
        />
      </Card>

      {message ? <HelperText type="error">{message}</HelperText> : null}

      <Text variant="titleMedium" style={styles.heading}>Pending requests{requests.length ? ` (${requests.length})` : ''}</Text>
      {requests.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No pending requests.</Text>
      ) : requests.map((request) => {
        const name = people[request.fromUid]?.displayName ?? 'Loading…';
        return (
          <Card key={request.id} mode="outlined" style={styles.card}>
            <Card.Title title={name} subtitle={describe(request.fromUid)} left={(props) => <Avatar.Text {...props} label={initials(name)} />} />
            <Card.Actions>
              <Button onPress={() => navigation.navigate('Profile', { targetUid: request.fromUid, title: name })}>View profile</Button>
              <Button mode="outlined" disabled={busyId === request.id} onPress={() => void respond(request.id, 'decline')}>Decline</Button>
              <Button mode="contained" loading={busyId === request.id} disabled={busyId === request.id} onPress={() => void respond(request.id, 'accept')}>Accept</Button>
            </Card.Actions>
          </Card>
        );
      })}

      <Text variant="titleMedium" style={styles.heading}>Your connections{members.length ? ` (${members.length})` : ''}</Text>
      {members.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No connections yet — try Find people above.</Text>
      ) : (
        <Card mode="outlined">
          {members.map((member, index) => {
            const name = people[member.uid]?.displayName ?? 'Loading…';
            return (
              <View key={member.uid}>
                <List.Item
                  title={name}
                  description={describe(member.uid)}
                  left={() => <Avatar.Text size={40} label={initials(name)} style={styles.avatar} />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => navigation.navigate('Profile', { targetUid: member.uid, title: name })}
                />
                {index < members.length - 1 ? <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} /> : null}
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  find: { marginBottom: 16 },
  heading: { marginTop: 8, marginBottom: 8 },
  card: { marginBottom: 10 },
  empty: { marginBottom: 12 },
  avatar: { marginLeft: 8, alignSelf: 'center' },
  divider: { height: 1, marginLeft: 72 },
});
