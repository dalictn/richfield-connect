import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { createConnectionRequest, respondToConnectionRequest, subscribeConnections, subscribeIncomingRequests } from '../../social/socialService';
import type { ConnectionMember, ConnectionRequest } from '../../types/social';

export function ConnectionsScreen() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [members, setMembers] = useState<ConnectionMember[]>([]);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [targetUid, setTargetUid] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => uid ? subscribeConnections(uid, setMembers, e => setMessage(e.message)) : undefined, [uid]);
  useEffect(() => uid ? subscribeIncomingRequests(uid, setRequests, e => setMessage(e.message)) : undefined, [uid]);

  async function request() { if (!targetUid.trim() || busy) return; setBusy(true); setMessage(''); try { await createConnectionRequest(targetUid.trim()); setTargetUid(''); setMessage('Request sent.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to send request.'); } finally { setBusy(false); } }
  async function respond(id: string, decision: 'accept' | 'decline') { try { await respondToConnectionRequest(id, decision); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to respond.'); } }

  return <View style={{ flex: 1, padding: 16 }}>
    <Text style={{ fontSize: 26, fontWeight: '800', marginBottom: 12 }}>Connections</Text>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}><TextInput value={targetUid} onChangeText={setTargetUid} placeholder="Enter a user's UID" style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10 }} /><Pressable onPress={request} style={{ backgroundColor: '#111827', padding: 12, borderRadius: 8 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? '…' : 'Connect'}</Text></Pressable></View>
    {message ? <Text style={{ marginBottom: 12, color: '#374151' }}>{message}</Text> : null}
    <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Pending requests</Text>
    <FlatList data={requests} keyExtractor={(item) => item.id} ListEmptyComponent={<Text style={{ color: '#666', marginBottom: 20 }}>No pending requests.</Text>} renderItem={({ item }) => <View style={{ padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 8 }}><Text style={{ fontWeight: '700' }}>{item.fromUid}</Text><View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}><Pressable onPress={() => respond(item.id, 'accept')}><Text style={{ color: '#166534', fontWeight: '700' }}>Accept</Text></Pressable><Pressable onPress={() => respond(item.id, 'decline')}><Text style={{ color: '#991b1b', fontWeight: '700' }}>Decline</Text></Pressable></View></View>} />
    <Text style={{ fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 8 }}>Connected users</Text>
    <FlatList data={members} keyExtractor={(item) => item.uid} renderItem={({ item }) => <Text style={{ paddingVertical: 8 }}>{item.uid}</Text>} />
  </View>;
}
