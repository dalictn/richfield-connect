import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAdminAnalytics } from '../../analyticsService';
import { subscribePendingOpportunities } from '../../opportunities/opportunityService';
import type { AdminAnalytics } from '../../types/analytics';
import type { AdminStackParamList } from '../../navigation/AdminStack';

type Navigation = NativeStackNavigationProp<AdminStackParamList, 'AdminHome'>;

interface ConsoleEntry {
  route: keyof AdminStackParamList;
  label: string;
  description: string;
  badge?: number;
}

/**
 * Landing screen for the administrator console.
 *
 * The five governance screens used to sit alongside the member screens as
 * sibling tabs, which pushed the admin shell to eleven tabs. They now live
 * behind this hub, which doubles as a triage view: each row carries the count of
 * work waiting behind it so an administrator can see what needs attention
 * without opening every screen.
 */
export function AdminConsoleScreen() {
  const navigation = useNavigation<Navigation>();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [pendingOpportunities, setPendingOpportunities] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setAnalytics(await getAdminAnalytics());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load console metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribePendingOpportunities(
    (items) => setPendingOpportunities(items.length),
    (e) => setError(e.message),
  ), []);

  const entries: ConsoleEntry[] = [
    { route: 'AdminUsers', label: 'User management', description: 'Approve, suspend or revoke any account.', badge: analytics?.pendingBusinessApprovals },
    { route: 'AdminApprovals', label: 'Opportunity approvals', description: 'Publish or reject business listings.', badge: pendingOpportunities },
    { route: 'AdminModeration', label: 'Moderation queue', description: 'Review reported posts, comments and profiles.', badge: analytics?.flaggedContent },
    { route: 'AdminAnalytics', label: 'Platform analytics', description: 'Registrations, engagement and content volume.' },
    { route: 'AdminBroadcast', label: 'Broadcast centre', description: 'Push an announcement to a role or the whole platform.' },
  ];

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.title}>Administrator Console</Text>
      <Text style={styles.sub}>Platform health, governance and communications.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {analytics ? (
        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{analytics.totalUsers}</Text><Text style={styles.metricLabel}>Registered users</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{analytics.activeUsers30d}</Text><Text style={styles.metricLabel}>Active / 30d</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{analytics.newRegistrations30d}</Text><Text style={styles.metricLabel}>New / 30d</Text></View>
        </View>
      ) : null}

      {entries.map((entry) => (
        <Pressable key={entry.route} onPress={() => navigation.navigate(entry.route)} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{entry.label}</Text>
            <Text style={styles.rowDescription}>{entry.description}</Text>
          </View>
          {entry.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{entry.badge}</Text></View> : null}
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800' },
  sub: { color: '#667085', marginBottom: 16 },
  error: { color: '#b42318', marginBottom: 12 },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  metric: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#f2f4f7' },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { color: '#667085', marginTop: 2, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 14, marginBottom: 10 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '800' },
  rowDescription: { color: '#667085', marginTop: 3 },
  badge: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 13, backgroundColor: '#b42318', alignItems: 'center' },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  chevron: { fontSize: 26, color: '#98a2b3' },
});
