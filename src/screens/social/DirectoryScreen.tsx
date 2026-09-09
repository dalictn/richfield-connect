import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchDirectory } from '../../directory/directoryService';
import { createConnectionRequest, respondToConnectionRequest } from '../../social/socialService';
import type { DirectoryCard } from '../../types/directory';

const ROLE_FILTERS = [
  { value: undefined, label: 'Everyone' },
  { value: 'student' as const, label: 'Students' },
  { value: 'alumni' as const, label: 'Alumni' },
  { value: 'business' as const, label: 'Employers' },
];

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  alumni: 'Alumnus',
  business: 'Employer',
  administrator: 'Richfield staff',
};

/**
 * Member directory.
 *
 * This replaces the raw-UID entry that connecting and messaging previously
 * required. Results are redacted server-side, so a card only shows the skills a
 * member has actually chosen to expose to this viewer.
 */
export function DirectoryScreen() {
  const [term, setTerm] = useState('');
  const [skill, setSkill] = useState('');
  const [role, setRole] = useState<'student' | 'alumni' | 'business' | undefined>(undefined);
  const [results, setResults] = useState<DirectoryCard[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await searchDirectory({ query: term, role, skill });
      setResults(response.results);
      setTruncated(response.truncated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to search the directory.');
    } finally {
      setLoading(false);
    }
  }, [term, role, skill]);

  // Run once on mount so the screen opens with people already listed rather
  // than an empty box. Subsequent searches are explicit.
  useEffect(() => { void run(); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  function patch(uid: string, changes: Partial<DirectoryCard>) {
    setResults((current) => current.map((card) => (card.uid === uid ? { ...card, ...changes } : card)));
  }

  async function connect(card: DirectoryCard) {
    setBusyUid(card.uid); setError('');
    try {
      await createConnectionRequest(card.uid);
      patch(card.uid, { connectionState: 'outgoing_pending' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send a connection request.');
    } finally { setBusyUid(null); }
  }

  async function accept(card: DirectoryCard) {
    if (!card.requestId) return;
    setBusyUid(card.uid); setError('');
    try {
      await respondToConnectionRequest(card.requestId, 'accept');
      patch(card.uid, { connectionState: 'connected', requestId: undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to accept this request.');
    } finally { setBusyUid(null); }
  }

  function action(card: DirectoryCard) {
    const busy = busyUid === card.uid;
    switch (card.connectionState) {
      case 'connected':
        return <Text style={styles.stateConnected}>✓ Connected</Text>;
      case 'outgoing_pending':
        return <Text style={styles.statePending}>Request sent</Text>;
      case 'incoming_pending':
        return <Pressable disabled={busy} onPress={() => void accept(card)} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? '…' : 'Accept'}</Text></Pressable>;
      default:
        return <Pressable disabled={busy} onPress={() => void connect(card)} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? '…' : 'Connect'}</Text></Pressable>;
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        <Text style={styles.title}>Find people</Text>
        <Text style={styles.sub}>Search students, alumni and employers across the Richfield network.</Text>
        <TextInput value={term} onChangeText={setTerm} onSubmitEditing={() => void run()} returnKeyType="search" placeholder="Name, headline, company or campus" style={styles.input} />
        <TextInput value={skill} onChangeText={setSkill} onSubmitEditing={() => void run()} returnKeyType="search" placeholder="Filter by a specific skill (e.g. react native)" style={styles.input} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {ROLE_FILTERS.map((filter) => {
            const active = role === filter.value;
            return (
              <Pressable key={filter.label} onPress={() => setRole(filter.value)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={active ? styles.chipActiveText : undefined}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable onPress={() => void run()} style={styles.search}><Text style={styles.primaryText}>Search</Text></Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} size="large" /> : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.list}
          ListHeaderComponent={truncated ? <Text style={styles.hint}>Showing the first matches. Narrow your search with a skill or role.</Text> : null}
          ListEmptyComponent={<Text style={styles.empty}>Nobody matches that search yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.displayName || 'Richfield member'}</Text>
                  <Text style={styles.meta}>
                    {ROLE_LABEL[item.role] ?? item.role}
                    {item.companyName ? ` · ${item.companyName}` : ''}
                    {item.campusLocation ? ` · ${item.campusLocation}` : ''}
                  </Text>
                  {item.headline ? <Text style={styles.headline}>{item.headline}</Text> : null}
                </View>
                {action(item)}
              </View>
              {item.skills.length ? (
                <View style={styles.skills}>
                  {item.skills.map((s) => <View key={s} style={styles.skill}><Text style={styles.skillText}>{s}</Text></View>)}
                </View>
              ) : item.skillsHidden ? <Text style={styles.private}>Skills visible to connections only.</Text> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: { padding: 16, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#e4e7ec' },
  title: { fontSize: 26, fontWeight: '800' },
  sub: { color: '#667085', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, padding: 10, marginBottom: 8 },
  filters: { gap: 8, paddingBottom: 10 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#d0d5dd' },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipActiveText: { color: '#fff' },
  search: { backgroundColor: '#111827', padding: 12, borderRadius: 8, alignItems: 'center' },
  error: { color: '#b42318', marginTop: 10 },
  list: { padding: 16, paddingBottom: 40 },
  hint: { color: '#667085', marginBottom: 12 },
  card: { padding: 16, borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 16, fontWeight: '800' },
  meta: { color: '#667085', marginTop: 3 },
  headline: { marginTop: 6, lineHeight: 20 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  skill: { backgroundColor: '#f2f4f7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  skillText: { fontSize: 12 },
  private: { color: '#98a2b3', marginTop: 12, fontStyle: 'italic' },
  primary: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: '#111827' },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  stateConnected: { color: '#166534', fontWeight: '700', paddingVertical: 9 },
  statePending: { color: '#667085', paddingVertical: 9 },
  empty: { textAlign: 'center', padding: 30, color: '#667085' },
});
