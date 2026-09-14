import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, HelperText, SegmentedButtons, Searchbar, Snackbar, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import {
  applyToOpportunity,
  createOpportunity,
  recordOpportunityView,
  subscribeApprovedOpportunities,
  subscribeMyMatches,
} from '../../opportunities/opportunityService';
import type { Opportunity, OpportunityMatch } from '../../types/opportunity';
import { EventsScreen } from '../events/EventsScreen';
import { CareerPathwaysScreen } from '../careers/CareerPathwaysScreen';

const TYPES = [
  { value: 'internship', label: 'Internship' },
  { value: 'learnership', label: 'Learnership' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'full-time', label: 'Full-time' },
];

const typeLabel = (value: string) => TYPES.find((type) => type.value === value)?.label ?? value;
const csv = (value: string) => Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));

type Segment = 'jobs' | 'events' | 'pathways';

/**
 * Careers hub: opportunity listings, institutional events and the alumni pathway
 * explorer, grouped so the tab bar stays at one careers tab.
 */
export function OpportunityBoardScreen() {
  const [segment, setSegment] = useState<Segment>('jobs');
  return (
    <View style={styles.root}>
      <SegmentedButtons
        style={styles.segments}
        value={segment}
        onValueChange={(value) => setSegment(value as Segment)}
        buttons={[
          { value: 'jobs', label: 'Opportunities', icon: 'briefcase-outline' },
          { value: 'events', label: 'Events', icon: 'calendar-star' },
          { value: 'pathways', label: 'Pathways', icon: 'map-marker-path' },
        ]}
      />
      {segment === 'jobs' ? <OpportunityList /> : segment === 'events' ? <EventsScreen /> : <CareerPathwaysScreen />}
    </View>
  );
}

function OpportunityList() {
  const { firebaseUser, profile } = useAuth();
  const theme = useTheme();
  const role = profile?.role;
  const [items, setItems] = useState<Opportunity[]>([]);
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => subscribeApprovedOpportunities(setItems, (e) => setError(e.message)), []);
  useEffect(() => {
    if (!firebaseUser || role !== 'student') return undefined;
    return subscribeMyMatches(firebaseUser.uid, setMatches, (e) => setError(e.message));
  }, [firebaseUser, role]);

  const scoreById = useMemo(() => new Map(matches.map((match) => [match.opportunityId || match.id, match.score])), [matches]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => !typeFilter || item.type === typeFilter)
      .filter((item) => !matchedOnly || scoreById.has(item.id))
      .filter((item) => !term || [item.title, item.companyName, item.location, item.description, ...(item.requiredSkills ?? [])].join(' ').toLowerCase().includes(term))
      .sort((a, b) => (scoreById.get(b.id) ?? -1) - (scoreById.get(a.id) ?? -1));
  }, [items, typeFilter, matchedOnly, search, scoreById]);

  async function apply(item: Opportunity) {
    setBusyId(item.id); setError('');
    try {
      await recordOpportunityView(item.id).catch(() => undefined);
      await applyToOpportunity(item.id);
      setApplied((current) => ({ ...current, [item.id]: true }));
      setNotice(`Application sent to ${item.companyName}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to apply.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {role === 'business' ? <PostOpportunityCard defaultCompany={profile?.companyName ?? ''} onPosted={(title) => setNotice(`"${title}" submitted for administrator approval.`)} /> : null}

        <Searchbar placeholder="Search title, company, skill or location" value={search} onChangeText={setSearch} style={styles.search} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip selected={!typeFilter} onPress={() => setTypeFilter(null)}>All</Chip>
          {TYPES.map((type) => (
            <Chip key={type.value} selected={typeFilter === type.value} onPress={() => setTypeFilter(typeFilter === type.value ? null : type.value)}>
              {type.label}
            </Chip>
          ))}
        </ScrollView>
        {role === 'student' ? (
          <View style={styles.switchRow}>
            <Switch value={matchedOnly} onValueChange={setMatchedOnly} />
            <Text variant="bodyMedium">Only roles matched to my profile ({matches.length})</Text>
          </View>
        ) : null}
        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Text variant="labelLarge" style={[styles.count, { color: theme.colors.onSurfaceVariant }]}>
          {visible.length} open {visible.length === 1 ? 'role' : 'roles'}
        </Text>

        {visible.map((item) => {
          const score = scoreById.get(item.id);
          const done = applied[item.id];
          return (
            <Card key={item.id} mode="outlined" style={styles.card}>
              <Card.Title
                title={item.title}
                titleNumberOfLines={2}
                subtitle={`${item.companyName} · ${item.remote ? 'Remote' : item.location}`}
                right={() => score !== undefined ? (
                  <Chip compact icon="star" style={[styles.matchChip, { backgroundColor: theme.colors.secondaryContainer }]}>
                    {Math.round(score * 100)}% match
                  </Chip>
                ) : null}
              />
              <Card.Content>
                <View style={styles.tags}>
                  <Chip compact icon="tag-outline">{typeLabel(item.type)}</Chip>
                  {(item.requiredSkills ?? []).slice(0, 6).map((skill) => <Chip compact key={skill}>{skill}</Chip>)}
                </View>
                <Text variant="bodyMedium" numberOfLines={4} style={styles.description}>{item.description}</Text>
              </Card.Content>
              {role === 'student' ? (
                <Card.Actions>
                  <Button
                    mode={done ? 'outlined' : 'contained'}
                    icon={done ? 'check' : 'send'}
                    loading={busyId === item.id}
                    disabled={done || busyId === item.id}
                    onPress={() => void apply(item)}
                  >
                    {done ? 'Applied' : 'Apply'}
                  </Button>
                </Card.Actions>
              ) : null}
            </Card>
          );
        })}
        {!visible.length ? <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No opportunities match these filters.</Text> : null}
      </ScrollView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={3500}>{notice}</Snackbar>
    </View>
  );
}

function PostOpportunityCard({ defaultCompany, onPosted }: { defaultCompany: string; onPosted: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('graduate');
  const [location, setLocation] = useState('');
  const [remote, setRemote] = useState(false);
  const [skills, setSkills] = useState('');
  const [programmes, setProgrammes] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!csv(skills).length) { setError('Add at least one required skill so students can be matched.'); return; }
    setBusy(true);
    try {
      await createOpportunity({
        title, description, type, location: remote && !location ? 'Remote' : location, remote,
        requiredSkills: csv(skills), programmeTags: csv(programmes), companyName: defaultCompany,
      });
      onPosted(title);
      setTitle(''); setLocation(''); setSkills(''); setProgrammes(''); setDescription(''); setRemote(false);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to post this opportunity.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <Button mode="contained" icon="plus" onPress={() => setOpen(true)} style={styles.postButton}>Post an opportunity</Button>;
  }

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Title title="Post an opportunity" subtitle="Listings go live once an administrator approves them" />
      <Card.Content style={styles.form}>
        <TextInput mode="outlined" label="Job title" value={title} onChangeText={setTitle} />
        <View style={styles.tags}>
          {TYPES.map((item) => <Chip key={item.value} selected={type === item.value} onPress={() => setType(item.value)}>{item.label}</Chip>)}
        </View>
        <TextInput mode="outlined" label="Location" value={location} onChangeText={setLocation} />
        <View style={styles.switchRow}><Switch value={remote} onValueChange={setRemote} /><Text>Remote-friendly</Text></View>
        <TextInput mode="outlined" label="Required skills (comma separated)" value={skills} onChangeText={setSkills} />
        <TextInput mode="outlined" label="Target programmes (comma separated)" placeholder="BSc Information Technology" value={programmes} onChangeText={setProgrammes} />
        <TextInput mode="outlined" label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} />
        {error ? <HelperText type="error">{error}</HelperText> : null}
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => setOpen(false)}>Cancel</Button>
        <Button mode="contained" icon="send" loading={busy} disabled={busy} onPress={() => void submit()}>Submit for approval</Button>
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  segments: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, maxWidth: 760, alignSelf: 'center', width: '92%' },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  search: { marginBottom: 10 },
  filters: { gap: 6, paddingBottom: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  count: { marginVertical: 8 },
  card: { marginBottom: 12 },
  matchChip: { marginRight: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  description: { lineHeight: 21 },
  empty: { paddingVertical: 24, textAlign: 'center' },
  postButton: { alignSelf: 'flex-start', marginBottom: 12 },
  form: { gap: 10 },
});
