import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, HelperText, Snackbar, Text, useTheme } from 'react-native-paper';
import { callFunction } from '../../firebaseApi';
import { confirmAction } from '../../ui/alert';

interface Flag {
  id: string;
  contentType: 'post' | 'comment' | 'profile' | 'recommendation';
  contentId: string;
  parentId?: string | null;
  reason: string;
  reportedBy: string;
  status: string;
}

const TYPE_ICONS: Record<Flag['contentType'], string> = {
  post: 'post-outline',
  comment: 'comment-outline',
  profile: 'account-outline',
  recommendation: 'star-outline',
};

export function ModerationQueueScreen() {
  const theme = useTheme();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await callFunction<Record<string, never>, { flags: Flag[] }>('listModerationQueue', {});
      setFlags(result.flags);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the moderation queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(flag: Flag, action: 'dismiss' | 'delete') {
    const confirmed = await confirmAction({
      title: action === 'delete' ? 'Remove this content?' : 'Dismiss this report?',
      message: action === 'delete' ? 'This cannot be undone.' : 'The report closes and the content stays up.',
      confirmLabel: action === 'delete' ? 'Remove' : 'Dismiss',
      destructive: action === 'delete',
    });
    if (!confirmed) return;
    setBusyId(flag.id); setError('');
    try {
      await callFunction('moderateContent', { flagId: flag.id, action });
      setNotice(action === 'delete' ? 'Content removed and logged.' : 'Report dismissed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Moderation action failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text variant="headlineSmall" style={styles.title}>Moderation queue</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
          Reports from members. Every action is recorded in the audit log.
        </Text>
        {error ? <HelperText type="error">{error}</HelperText> : null}
        {flags.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No open reports.</Text>
        ) : flags.map((flag) => (
          <Card key={flag.id} mode="outlined" style={styles.card}>
            <Card.Title
              title={flag.reason}
              titleNumberOfLines={3}
              subtitle={`Reported ${flag.contentType}`}
              left={() => <Chip compact icon={TYPE_ICONS[flag.contentType] ?? 'flag-outline'}>{flag.contentType}</Chip>}
              leftStyle={styles.left}
            />
            <Card.Actions>
              <Button mode="outlined" disabled={busyId === flag.id} onPress={() => void act(flag, 'dismiss')}>Dismiss</Button>
              <Button mode="contained" buttonColor={theme.colors.error} icon="delete-outline" loading={busyId === flag.id} disabled={busyId === flag.id} onPress={() => void act(flag, 'delete')}>
                Remove
              </Button>
            </Card.Actions>
          </Card>
        ))}
      </ScrollView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={3000}>{notice}</Snackbar>
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
  left: { width: 'auto', marginRight: 12 },
});
