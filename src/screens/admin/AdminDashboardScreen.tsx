import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, Chip, HelperText, Snackbar, Text, useTheme } from 'react-native-paper';
import { callFunction } from '../../firebaseApi';
import { confirmAction } from '../../ui/alert';
import type { UserProfile, UserRole } from '../../types/auth';
import { initials, ROLE_LABELS } from '../../members/memberService';

type Status = 'active' | 'suspended' | 'revoked';
interface AdminUser extends UserProfile { accountStatus?: Status }

const ROLE_FILTERS: Array<{ value: 'all' | UserRole; label: string }> = [
  { value: 'all', label: 'All roles' },
  { value: 'student', label: 'Students' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'business', label: 'Employers' },
  { value: 'administrator', label: 'Admins' },
];
const STATUS_FILTERS: Array<{ value: 'all' | Status; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
];

/**
 * User management (brief §2.2): approve employers, suspend or revoke accounts.
 * Changes update both the profile and the member's auth claims server-side, and
 * are written to the audit log.
 */
export function AdminDashboardScreen() {
  const theme = useTheme();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [role, setRole] = useState<'all' | UserRole>('all');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await callFunction<{ role: string; status: string }, { users: AdminUser[] }>('listAdminUsers', { role, status });
      setUsers(result.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, status]);

  useEffect(() => { void load(); }, [load]);

  async function change(user: AdminUser, next: Status, verb: string) {
    const name = user.displayName || user.email;
    const confirmed = await confirmAction({
      title: `${verb} ${name}?`,
      message: next === 'revoked' ? 'They will lose access immediately.' : `Their account will be ${next === 'active' ? 'active' : next}.`,
      confirmLabel: verb,
      destructive: next === 'revoked',
    });
    if (!confirmed) return;
    setBusyUid(user.uid); setError('');
    try {
      await callFunction('manageUserStatus', { uid: user.uid, status: next });
      setNotice(`${name}: ${verb.toLowerCase()} — recorded in the audit log.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update this account.');
    } finally {
      setBusyUid(null);
    }
  }

  const statusColour = (value?: Status) => (value === 'suspended' ? theme.colors.tertiary : value === 'revoked' ? theme.colors.error : theme.colors.secondary);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text variant="headlineSmall" style={styles.title}>User management</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
          Approve employers and govern member accounts.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {ROLE_FILTERS.map((item) => <Chip key={item.value} selected={role === item.value} onPress={() => setRole(item.value)}>{item.label}</Chip>)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {STATUS_FILTERS.map((item) => <Chip key={item.value} selected={status === item.value} onPress={() => setStatus(item.value)}>{item.label}</Chip>)}
        </ScrollView>
        {error ? <HelperText type="error">{error}</HelperText> : null}

        {loading ? <ActivityIndicator style={styles.loading} /> : users.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No users match these filters.</Text>
        ) : users.map((user) => {
          const name = user.displayName || user.email;
          const current = user.accountStatus ?? 'active';
          const awaitingApproval = user.role === 'business' && !user.isApproved && current === 'active';
          const busy = busyUid === user.uid;
          return (
            <Card key={user.uid} mode="outlined" style={styles.card}>
              <Card.Title
                title={name}
                subtitle={[user.email, user.companyName].filter(Boolean).join(' · ')}
                left={(props) => <Avatar.Text {...props} label={initials(name)} />}
              />
              <Card.Content style={styles.chips}>
                <Chip compact icon="badge-account-outline">{ROLE_LABELS[user.role] ?? user.role}</Chip>
                <Chip compact textStyle={{ color: '#fff' }} style={{ backgroundColor: statusColour(current) }}>{current}</Chip>
                {awaitingApproval ? <Chip compact icon="clock-outline" style={{ backgroundColor: theme.colors.tertiaryContainer }}>Awaiting approval</Chip> : null}
              </Card.Content>
              {user.role !== 'administrator' ? (
                <Card.Actions>
                  {awaitingApproval ? (
                    <Button mode="contained" icon="check" loading={busy} disabled={busy} onPress={() => void change(user, 'active', 'Approve')}>Approve</Button>
                  ) : current === 'active' ? (
                    <Button mode="outlined" disabled={busy} onPress={() => void change(user, 'suspended', 'Suspend')}>Suspend</Button>
                  ) : (
                    <Button mode="contained" loading={busy} disabled={busy} onPress={() => void change(user, 'active', 'Reactivate')}>Reactivate</Button>
                  )}
                  {current !== 'revoked' ? (
                    <Button mode="text" textColor={theme.colors.error} disabled={busy} onPress={() => void change(user, 'revoked', 'Revoke')}>Revoke</Button>
                  ) : null}
                </Card.Actions>
              ) : (
                <Card.Content>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, paddingBottom: 12 }}>
                    Administrator accounts are governed out-of-band.
                  </Text>
                </Card.Content>
              )}
            </Card>
          );
        })}
      </ScrollView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={4000}>{notice}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontWeight: '700' },
  filters: { gap: 6, paddingBottom: 8 },
  loading: { marginTop: 32 },
  empty: { textAlign: 'center', paddingVertical: 32 },
  card: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 4 },
});
