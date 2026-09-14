import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, HelperText, ProgressBar, Text, useTheme } from 'react-native-paper';
import { getAdminAnalytics } from '../../analyticsService';
import type { AdminAnalytics } from '../../types/analytics';
import { BarChart, MetricCard } from './MetricCard';

const ROLE_NAMES: Record<string, string> = { student: 'Students', alumni: 'Alumni', business: 'Employers', administrator: 'Administrators' };
const CONTENT_NAMES: Record<string, string> = { posts: 'Posts', videos: 'Videos', opportunities: 'Opportunities' };

export function AdminAnalyticsScreen() {
  const theme = useTheme();
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminAnalytics().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load analytics.'));
  }, []);

  if (!data && !error) return <ActivityIndicator style={styles.loading} />;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>Platform analytics</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Growth, engagement and governance across Richfield Connect.</Text>
      {error ? <HelperText type="error">{error}</HelperText> : null}

      {data ? (
        <>
          <View style={styles.metrics}>
            <MetricCard label="Registered users" value={data.totalUsers} />
            <MetricCard label="Monthly active users" value={data.activeUsers30d} />
            <MetricCard label="New in 30 days" value={data.newRegistrations30d} />
            <MetricCard label="Pending business approvals" value={data.pendingBusinessApprovals} />
            <MetricCard label="Open moderation flags" value={data.flaggedContent} />
          </View>

          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Engagement</Text>
              <View style={styles.retentionRow}>
                <Text variant="bodyMedium">Active in the last 7 days</Text>
                <Text variant="labelLarge">{(data.retention7d * 100).toFixed(1)}%</Text>
              </View>
              <ProgressBar progress={data.retention7d} color={theme.colors.primary} style={styles.bar} />
              <View style={styles.retentionRow}>
                <Text variant="bodyMedium">Active in the last 30 days</Text>
                <Text variant="labelLarge">{(data.retention30d * 100).toFixed(1)}%</Text>
              </View>
              <ProgressBar progress={data.retention30d} color={theme.colors.secondary} style={styles.bar} />
            </Card.Content>
          </Card>

          <Text variant="titleMedium" style={styles.section}>Users by type</Text>
          <BarChart items={Object.entries(data.roles).map(([role, value]) => ({ label: ROLE_NAMES[role] ?? role, value }))} />

          <Text variant="titleMedium" style={styles.section}>New registrations by month</Text>
          <BarChart items={data.registrationTrend.map((item) => ({ label: item.month, value: item.count }))} />

          <Text variant="titleMedium" style={styles.section}>Content volume</Text>
          <BarChart items={Object.entries(data.content).map(([kind, value]) => ({ label: CONTENT_NAMES[kind] ?? kind, value }))} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 860, alignSelf: 'center' },
  title: { fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12, marginHorizontal: -5 },
  card: { marginTop: 4 },
  retentionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  bar: { height: 10, borderRadius: 5, marginTop: 6 },
  section: { marginTop: 16 },
});
