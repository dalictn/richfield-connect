import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, HelperText, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { getStudentAnalytics } from '../../analyticsService';
import { subscribeApprovedOpportunities } from '../../opportunities/opportunityService';
import type { StudentAnalytics } from '../../types/analytics';
import type { Opportunity } from '../../types/opportunity';
import { BarChart, MetricCard } from './MetricCard';

export function StudentAnalyticsScreen() {
  const { profile } = useAuth();
  const theme = useTheme();
  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getStudentAnalytics().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load analytics.'));
  }, []);
  useEffect(() => subscribeApprovedOpportunities(setOpportunities, () => undefined), []);

  // Matches are stored by opportunity id; show the listing title instead.
  const titles = useMemo(() => new Map(opportunities.map((item) => [item.id, item.title])), [opportunities]);
  const firstName = (profile?.displayName ?? '').split(' ')[0] || 'there';

  if (!data && !error) return <ActivityIndicator style={styles.loading} />;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>Welcome back, {firstName}</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>How your profile is performing with employers.</Text>
      {error ? <HelperText type="error">{error}</HelperText> : null}

      {data ? (
        <>
          <Card mode="contained" style={[styles.strength, { backgroundColor: theme.colors.primaryContainer }]}>
            <Card.Content>
              <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>Profile strength</Text>
              <Text variant="displaySmall" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>{data.profileCompleteness}%</Text>
              <ProgressBar progress={data.profileCompleteness / 100} color={theme.colors.primary} style={styles.bar} />
              <Text variant="labelMedium" style={[styles.peer, { color: theme.colors.onPrimaryContainer }]}>Programme average</Text>
              <ProgressBar progress={data.peerAverageCompleteness / 100} color={theme.colors.secondary} style={styles.bar} />
              <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, marginTop: 6 }}>
                {data.profileCompleteness >= data.peerAverageCompleteness
                  ? `You're ${data.profileCompleteness - data.peerAverageCompleteness} points ahead of your programme peers.`
                  : `You're ${data.peerAverageCompleteness - data.profileCompleteness} points behind your programme peers — the assistant can help.`}
              </Text>
            </Card.Content>
          </Card>

          <View style={styles.metrics}>
            <MetricCard label="Profile views" value={data.profileViews} />
            <MetricCard label={`Connections (+${data.connections30d} this month)`} value={data.connectionCount} />
            <MetricCard label="Applications" value={data.applications} />
            <MetricCard label="Post engagement" value={data.engagement} />
          </View>

          <Text variant="titleMedium" style={styles.section}>Skills employers are searching for</Text>
          <BarChart items={data.skillDemand.map((item) => ({ label: item.skill, value: item.count }))} />

          <Text variant="titleMedium" style={styles.section}>Your best opportunity matches</Text>
          <BarChart items={data.topMatches.map((item) => ({ label: titles.get(item.opportunityId) ?? 'Opportunity', value: Math.round(item.score * 100) }))} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 860, alignSelf: 'center' },
  title: { fontWeight: '700' },
  strength: { marginTop: 16 },
  bar: { height: 10, borderRadius: 5, marginTop: 6 },
  peer: { marginTop: 10 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12, marginHorizontal: -5 },
  section: { marginTop: 16 },
});
