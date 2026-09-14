import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, Chip, HelperText, Searchbar, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { searchDirectory } from '../../directory/directoryService';
import type { ConnectionsStackParamList } from '../../navigation/ConnectionsStack';
import { createConnectionRequest, respondToConnectionRequest } from '../../social/socialService';
import type { DirectoryCard } from '../../types/directory';
import { initials, ROLE_LABELS } from '../../members/memberService';

type Navigation = NativeStackNavigationProp<ConnectionsStackParamList, 'Directory'>;

const ROLE_FILTERS: Array<{ value: 'student' | 'alumni' | 'business' | undefined; label: string; icon: string }> = [
  { value: undefined, label: 'Everyone', icon: 'account-multiple' },
  { value: 'student', label: 'Students', icon: 'school' },
  { value: 'alumni', label: 'Alumni', icon: 'account-star' },
  { value: 'business', label: 'Employers', icon: 'domain' },
];

/**
 * Member directory. Results are redacted server-side, so a card only shows the
 * skills a member has chosen to expose to this viewer.
 */
export function DirectoryScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useTheme();
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

  // Re-run when the role filter changes so the screen never shows stale results.
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
        return <Chip icon="check" compact style={{ backgroundColor: theme.colors.secondaryContainer }}>Connected</Chip>;
      case 'outgoing_pending':
        return <Chip icon="clock-outline" compact>Request sent</Chip>;
      case 'incoming_pending':
        return <Button mode="contained" compact loading={busy} disabled={busy} onPress={() => void accept(card)}>Accept</Button>;
      default:
        return <Button mode="contained-tonal" icon="account-plus" compact loading={busy} disabled={busy} onPress={() => void connect(card)}>Connect</Button>;
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Searchbar placeholder="Name, headline, company or campus" value={term} onChangeText={setTerm} onSubmitEditing={() => void run()} onIconPress={() => void run()} style={styles.search} />
      <Searchbar icon="lightning-bolt-outline" placeholder="Filter by skill, e.g. react native" value={skill} onChangeText={setSkill} onSubmitEditing={() => void run()} onIconPress={() => void run()} style={styles.search} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {ROLE_FILTERS.map((filter) => (
          <Chip key={filter.label} icon={filter.icon} selected={role === filter.value} onPress={() => setRole(filter.value)}>{filter.label}</Chip>
        ))}
      </ScrollView>
      {error ? <HelperText type="error">{error}</HelperText> : null}
      {truncated ? <HelperText type="info">Showing the first matches. Narrow your search with a skill or role.</HelperText> : null}

      {loading ? <ActivityIndicator style={styles.loading} /> : results.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>Nobody matches that search yet.</Text>
      ) : results.map((item) => {
        const name = item.displayName || 'Richfield member';
        return (
          <Card key={item.uid} mode="outlined" style={styles.card} onPress={() => navigation.navigate('Profile', { targetUid: item.uid, title: name })}>
            <Card.Title
              title={name}
              subtitle={[ROLE_LABELS[item.role] ?? item.role, item.companyName, item.campusLocation].filter(Boolean).join(' · ')}
              left={(props) => <Avatar.Text {...props} label={initials(name)} />}
              right={() => <View style={styles.action}>{action(item)}</View>}
            />
            <Card.Content>
              {item.headline ? <Text variant="bodyMedium" style={styles.headline}>{item.headline}</Text> : null}
              {item.skills.length ? (
                <View style={styles.skills}>
                  {item.skills.map((s) => <Chip key={s} compact>{s}</Chip>)}
                </View>
              ) : item.skillsHidden ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}>
                  Skills visible to connections only.
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  search: { marginBottom: 10 },
  filters: { gap: 6, paddingBottom: 12 },
  loading: { marginTop: 32 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  card: { marginBottom: 12 },
  action: { marginRight: 12 },
  headline: { marginBottom: 8 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
