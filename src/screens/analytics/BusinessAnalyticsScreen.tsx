import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, HelperText, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { getBusinessAnalytics } from '../../analyticsService';
import type { BusinessAnalytics } from '../../types/analytics';
import { BarChart, MetricCard } from './MetricCard';

export function BusinessAnalyticsScreen() {
  const { profile } = useAuth();
  const theme = useTheme();
  const [data, setData] = useState<BusinessAnalytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getBusinessAnalytics().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load analytics.'));
  }, []);

  if (!data && !error) return <ActivityIndicator style={styles.loading} />;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>{profile?.companyName ?? 'Hiring dashboard'}</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Your pipeline and reach across Richfield talent.</Text>
      {error ? <HelperText type="error">{error}</HelperText> : null}

      {data ? (
        <>
          <View style={styles.metrics}>
            <MetricCard label={`Listings (${data.approvedListings} live)`} value={data.listings} />
            <MetricCard label="Applicants" value={data.applicants} />
            <MetricCard label="Listing views" value={data.views} />
            <MetricCard label="Profile reach" value={data.reach} />
          </View>

          <Card mode="contained" style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Card.Content>
              <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>Listing engagement</Text>
              <Text variant="displaySmall" style={{ color: theme.colors.onSecondaryContainer, fontWeight: '700' }}>
                {(data.conversionRate * 100).toFixed(1)}%
              </Text>
              <ProgressBar progress={Math.min(1, data.conversionRate)} color={theme.colors.secondary} style={styles.bar} />
              <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, marginTop: 6 }}>
                Of students who viewed a listing, this share applied.
              </Text>
            </Card.Content>
          </Card>

          <Text variant="titleMedium" style={styles.section}>Skills across Richfield candidates</Text>
          <BarChart items={data.candidateSkillDemand.map((item) => ({ label: item.skill, value: item.count }))} />

          <Text variant="titleMedium" style={styles.section}>Applicants by programme</Text>
          <BarChart items={data.applicantsByProgramme.map((item) => ({ label: item.programme, value: item.count }))} />

          <Text variant="titleMedium" style={styles.section}>Applicants by year of study</Text>
          <BarChart items={data.applicantsByYear.map((item) => ({ label: item.year, value: item.count }))} />
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
  bar: { height: 10, borderRadius: 5, marginTop: 6 },
  section: { marginTop: 16 },
});
