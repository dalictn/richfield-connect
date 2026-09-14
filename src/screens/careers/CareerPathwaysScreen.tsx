import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, Chip, HelperText, List, Searchbar, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { callFunction } from '../../firebaseApi';
import { initials } from '../../members/memberService';

interface PathwayRole {
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
}

interface AlumnusPathway {
  uid: string;
  displayName: string;
  headline: string;
  graduationYear: number | null;
  fieldOfWork: string;
  currentRole: PathwayRole | null;
  history: PathwayRole[];
  experienceHidden: boolean;
}

interface PathwayResult {
  programme: string;
  alumniCount: number;
  topCompanies: Array<{ label: string; count: number }>;
  topRoles: Array<{ label: string; count: number }>;
  topFields: Array<{ label: string; count: number }>;
  pathways: AlumnusPathway[];
}

/**
 * Career pathway explorer (brief §2.5): where graduates of a programme ended up
 * and the roles they held. Work history only appears where an alumnus has shared
 * it with this viewer, enforced server-side.
 */
export function CareerPathwaysScreen() {
  const { profile } = useAuth();
  const theme = useTheme();
  const initial = (profile as { programmeOfStudy?: string } | null)?.programmeOfStudy || 'BSc Information Technology';
  const [programme, setProgramme] = useState(initial);
  const [result, setResult] = useState<PathwayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const explore = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setLoading(true); setError('');
    try {
      setResult(await callFunction<{ programme: string }, PathwayResult>('getCareerPathways', { programme: value.trim() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load career pathways.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void explore(initial); }, [explore, initial]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="bodyMedium" style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}>
        See where Richfield graduates of a programme work today, and the roles that got them there.
      </Text>
      <Searchbar
        placeholder="Programme, e.g. BSc Information Technology"
        value={programme}
        onChangeText={setProgramme}
        onSubmitEditing={() => void explore(programme)}
        onIconPress={() => void explore(programme)}
        style={styles.search}
      />
      {error ? <HelperText type="error">{error}</HelperText> : null}
      {loading ? <ActivityIndicator style={styles.loading} /> : result ? (
        <>
          <Card mode="contained" style={[styles.card, { backgroundColor: theme.colors.primaryContainer }]}>
            <Card.Content>
              <Text variant="displaySmall" style={{ color: theme.colors.onPrimaryContainer }}>{result.alumniCount}</Text>
              <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer }}>
                {result.alumniCount === 1 ? 'graduate' : 'graduates'} of {result.programme} on Richfield Connect
              </Text>
            </Card.Content>
          </Card>

          {result.topCompanies.length ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Where they work</Text>
              <View style={styles.chips}>
                {result.topCompanies.map((item) => <Chip key={item.label} icon="domain">{item.label} · {item.count}</Chip>)}
              </View>
            </View>
          ) : null}

          {result.topRoles.length ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Roles they've held</Text>
              <View style={styles.chips}>
                {result.topRoles.map((item) => <Chip key={item.label} icon="briefcase-outline">{item.label} · {item.count}</Chip>)}
              </View>
            </View>
          ) : null}

          <Text variant="titleMedium" style={styles.sectionTitle}>Graduate journeys</Text>
          {result.pathways.length === 0 ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>No alumni from this programme have joined yet.</Text>
          ) : result.pathways.map((alumnus) => (
            <Card key={alumnus.uid} mode="outlined" style={styles.card}>
              <Card.Title
                title={alumnus.displayName}
                subtitle={[alumnus.graduationYear ? `Class of ${alumnus.graduationYear}` : '', alumnus.fieldOfWork].filter(Boolean).join(' · ')}
                left={(props) => <Avatar.Text {...props} label={initials(alumnus.displayName)} />}
              />
              <Card.Content>
                {alumnus.headline ? <Text variant="bodyMedium" style={styles.headline}>{alumnus.headline}</Text> : null}
                {alumnus.experienceHidden ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}>
                    This graduate keeps their work history private.
                  </Text>
                ) : alumnus.history.map((role, index) => (
                  <List.Item
                    key={`${role.company}-${role.startDate}-${index}`}
                    title={`${role.role} · ${role.company}`}
                    description={`${role.startDate}${role.endDate ? ` – ${role.endDate}` : ' – present'}`}
                    left={(props) => <List.Icon {...props} icon={index === 0 && !role.endDate ? 'briefcase-check' : 'briefcase-outline'} />}
                    style={styles.role}
                  />
                ))}
              </Card.Content>
            </Card>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  intro: { marginBottom: 12 },
  search: { marginBottom: 12 },
  loading: { marginTop: 32 },
  card: { marginBottom: 12 },
  section: { marginBottom: 12 },
  sectionTitle: { marginTop: 4, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  headline: { marginBottom: 6 },
  role: { paddingLeft: 0, paddingVertical: 2 },
});
