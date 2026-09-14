import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Badge, Card, HelperText, List, Text, useTheme } from 'react-native-paper';
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
  icon: string;
  badge?: number;
}

/**
 * Administrator console hub. Each row carries the count of work waiting behind
 * it, so the console doubles as a triage view.
 */
export function AdminConsoleScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useTheme();
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
  useEffect(() => subscribePendingOpportunities((items) => setPendingOpportunities(items.length), (e) => setError(e.message)), []);

  const entries: ConsoleEntry[] = [
    { route: 'AdminUsers', label: 'User management', description: 'Approve businesses, suspend or revoke accounts', icon: 'account-cog', badge: analytics?.pendingBusinessApprovals },
    { route: 'AdminApprovals', label: 'Opportunity approvals', description: 'Publish or reject business listings', icon: 'briefcase-check', badge: pendingOpportunities },
    { route: 'AdminModeration', label: 'Moderation queue', description: 'Reported posts, comments, profiles and recommendations', icon: 'shield-alert', badge: analytics?.flaggedContent },
    { route: 'AdminEvents', label: 'Institutional events', description: 'Create, edit and publish career fairs and workshops', icon: 'calendar-star' },
    { route: 'AdminAnalytics', label: 'Platform analytics', description: 'Registrations, engagement and content volume', icon: 'chart-box' },
    { route: 'AdminBroadcast', label: 'Broadcast centre', description: 'Announce to a role or the whole platform', icon: 'bullhorn' },
  ];

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text variant="headlineSmall" style={styles.title}>Administrator console</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Platform health, governance and communications.</Text>
      {error ? <HelperText type="error">{error}</HelperText> : null}

      {analytics ? (
        <View style={styles.metrics}>
          {[
            { label: 'Registered users', value: analytics.totalUsers, icon: 'account-group' },
            { label: 'Active in 30 days', value: analytics.activeUsers30d, icon: 'pulse' },
            { label: 'New in 30 days', value: analytics.newRegistrations30d, icon: 'account-plus' },
          ].map((metric) => (
            <Card key={metric.label} mode="contained" style={[styles.metric, { backgroundColor: theme.colors.primaryContainer }]}>
              <Card.Content>
                <Avatar.Icon size={32} icon={metric.icon} style={{ backgroundColor: theme.colors.primary }} />
                <Text variant="headlineMedium" style={[styles.metricValue, { color: theme.colors.onPrimaryContainer }]}>{metric.value}</Text>
                <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>{metric.label}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      ) : null}

      <Card mode="outlined">
        {entries.map((entry) => (
          <List.Item
            key={entry.route}
            title={entry.label}
            description={entry.description}
            descriptionNumberOfLines={2}
            onPress={() => navigation.navigate(entry.route)}
            left={(props) => <List.Icon {...props} icon={entry.icon} color={theme.colors.primary} />}
            right={(props) => (
              <View style={styles.right}>
                {entry.badge ? <Badge style={styles.badge}>{entry.badge}</Badge> : null}
                <List.Icon {...props} icon="chevron-right" />
              </View>
            )}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
  metric: { flexGrow: 1, flexBasis: 150 },
  metricValue: { marginTop: 8, fontWeight: '700' },
  right: { flexDirection: 'row', alignItems: 'center' },
  badge: { alignSelf: 'center', marginRight: 4 },
});
