import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';
import { respondToConnectionRequest, subscribeConnections, subscribeIncomingRequests } from '../../social/socialService';
import type { ConnectionMember, ConnectionRequest } from '../../types/social';
import type { ConnectionsStackParamList } from '../../navigation/ConnectionsStack';

type Navigation = NativeStackNavigationProp<ConnectionsStackParamList, 'ConnectionsHome'>;

export function ConnectionsScreen() {
  const { firebaseUser } = useAuth();
  const navigation = useNavigation<Navigation>();
  const uid = firebaseUser?.uid;
  const [members, setMembers] = useState<ConnectionMember[]>([]);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => uid ? subscribeConnections(uid, setMembers, e => setMessage(e.message)) : undefined, [uid]);
  useEffect(() => uid ? subscribeIncomingRequests(uid, setRequests, e => setMessage(e.message)) : undefined, [uid]);

  async function respond(id: string, decision: 'accept' | 'decline') {
    try {
      await respondToConnectionRequest(id, decision);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to respond.');
    }
  }

  return (
    <View style={styles.root}>
      <Pressable onPress={() => navigation.navigate('Directory')} style={styles.find}>
        <View style={{ flex: 1 }}>
          <Text style={styles.findLabel}>Find people</Text>
          <Text style={styles.findHint}>Search students, alumni and employers by name, skill or campus.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Text style={styles.heading}>Pending requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No pending requests.</Text>}
        renderItem={({ item }) => (
          <View style={styles.request}>
            <Text style={styles.name}>{item.fromUid}</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => respond(item.id, 'accept')}><Text style={styles.accept}>Accept</Text></Pressable>
              <Pressable onPress={() => respond(item.id, 'decline')}><Text style={styles.decline}>Decline</Text></Pressable>
            </View>
          </View>
        )}
      />

      <Text style={[styles.heading, { marginTop: 16 }]}>Connected users</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        ListEmptyComponent={<Text style={styles.empty}>You have no connections yet. Try Find people above.</Text>}
        renderItem={({ item }) => <Text style={styles.member}>{item.uid}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16 },
  find: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 14, marginBottom: 16 },
  findLabel: { fontSize: 16, fontWeight: '800' },
  findHint: { color: '#667085', marginTop: 3 },
  chevron: { fontSize: 26, color: '#98a2b3' },
  message: { marginBottom: 12, color: '#374151' },
  heading: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  request: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 8 },
  name: { fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  accept: { color: '#166534', fontWeight: '700' },
  decline: { color: '#991b1b', fontWeight: '700' },
  member: { paddingVertical: 8 },
  empty: { color: '#667085', marginBottom: 12 },
});
