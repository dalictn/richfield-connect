import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, HelperText, Snackbar, Text, useTheme } from 'react-native-paper';
import { reviewOpportunity, subscribePendingOpportunities } from '../../opportunities/opportunityService';
import type { Opportunity } from '../../types/opportunity';
import { confirmAction } from '../../ui/alert';

/**
 * Administrator opportunity oversight. Nothing reaches students until published
 * here; publishing triggers skill and programme matching against every student.
 */
export function OpportunityApprovalScreen() {
  const theme = useTheme();
  const [pending, setPending] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => subscribePendingOpportunities(
    (items) => { setPending(items); setLoading(false); },
    (e) => { setError(e.message); setLoading(false); },
  ), []);

  async function review(item: Opportunity, status: 'approved' | 'rejected') {
    const approving = status === 'approved';
    const confirmed = await confirmAction({
      title: approving ? 'Publish this opportunity?' : 'Reject this opportunity?',
      message: approving
        ? `"${item.title}" becomes visible to students and matched students are notified.`
        : `"${item.title}" stays hidden from students.`,
      confirmLabel: approving ? 'Publish' : 'Reject',
      destructive: !approving,
    });
    if (!confirmed) return;
    setBusyId(item.id); setError('');
    try {
      await reviewOpportunity(item.id, status);
      setNotice(approving ? `"${item.title}" is live — matched students are being notified.` : `"${item.title}" was rejected.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to review this opportunity.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>Opportunity approvals</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
          Listings stay hidden from students until you publish them.
        </Text>
        {error ? <HelperText type="error">{error}</HelperText> : null}
        {pending.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No opportunities are awaiting review.</Text>
        ) : pending.map((item) => (
          <Card key={item.id} mode="outlined" style={styles.card}>
            <Card.Title title={item.title} titleNumberOfLines={2} subtitle={`${item.companyName} · ${item.remote ? 'Remote' : item.location}`} />
            <Card.Content>
              <View style={styles.tags}>
                <Chip compact icon="tag-outline">{item.type}</Chip>
                {(item.requiredSkills ?? []).map((skill) => <Chip key={skill} compact>{skill}</Chip>)}
              </View>
              <Text variant="bodyMedium" style={styles.body}>{item.description}</Text>
              {item.programmeTags?.length ? (
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Programmes: {item.programmeTags.join(', ')}</Text>
              ) : null}
            </Card.Content>
            <Card.Actions>
              <Button mode="outlined" textColor={theme.colors.error} disabled={busyId === item.id} onPress={() => void review(item, 'rejected')}>Reject</Button>
              <Button mode="contained" icon="check" loading={busyId === item.id} disabled={busyId === item.id} onPress={() => void review(item, 'approved')}>Publish</Button>
            </Card.Actions>
          </Card>
        ))}
      </ScrollView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={4000}>{notice}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: 32 },
  card: { marginBottom: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  body: { lineHeight: 21, marginBottom: 8 },
});
