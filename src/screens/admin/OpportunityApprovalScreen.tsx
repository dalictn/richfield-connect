import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { reviewOpportunity, subscribePendingOpportunities } from '../../opportunities/opportunityService';
import type { Opportunity } from '../../types/opportunity';
import { confirmAction } from '../../ui/alert';

/**
 * Administrator opportunity oversight.
 *
 * Business users submit listings with status `pending`; nothing reaches students
 * until an administrator approves it here. Approving flips the status, which the
 * matchOnOpportunityApproval trigger picks up to score the listing against every
 * student profile and push a match notification.
 */
export function OpportunityApprovalScreen() {
  const [pending, setPending] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    return subscribePendingOpportunities(
      (items) => { setPending(items); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
  }, []);

  const review = async (item: Opportunity, status: 'approved' | 'rejected') => {
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

    setBusyId(item.id); setError(''); setNotice('');
    try {
      await reviewOpportunity(item.id, status);
      setNotice(approving ? `"${item.title}" is live and matched students have been notified.` : `"${item.title}" was rejected.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to review this opportunity.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <FlatList
      data={pending}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Opportunity Approvals</Text>
          <Text style={styles.sub}>Listings stay hidden from students until you publish them.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>No opportunities are awaiting review.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.meta}>{item.companyName} · {item.type} · {item.remote ? 'Remote' : item.location}</Text>
          <Text style={styles.body}>{item.description}</Text>
          <Text style={styles.meta}>Skills: {item.requiredSkills.join(', ') || 'None listed'}</Text>
          {item.programmeTags?.length ? <Text style={styles.meta}>Programmes: {item.programmeTags.join(', ')}</Text> : null}
          <View style={styles.actions}>
            <Pressable disabled={busyId === item.id} onPress={() => void review(item, 'approved')} style={[styles.primary, busyId === item.id && styles.disabled]}>
              <Text style={styles.primaryText}>{busyId === item.id ? 'Working…' : 'Publish'}</Text>
            </Pressable>
            <Pressable disabled={busyId === item.id} onPress={() => void review(item, 'rejected')} style={[styles.secondary, busyId === item.id && styles.disabled]}>
              <Text style={styles.secondaryText}>Reject</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800' },
  sub: { color: '#667085', marginBottom: 16 },
  error: { color: '#b42318', marginBottom: 12 },
  notice: { color: '#166534', marginBottom: 12 },
  card: { padding: 16, borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 14, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  meta: { color: '#667085', marginTop: 4 },
  body: { marginVertical: 8, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#111827' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#d0d5dd' },
  secondaryText: { fontWeight: '700' },
  disabled: { opacity: 0.5 },
  empty: { textAlign: 'center', padding: 30, color: '#667085' },
});
