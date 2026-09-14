import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, HelperText, SegmentedButtons, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { callFunction } from '../../firebaseApi';

type Audience = 'all' | 'student' | 'alumni' | 'business';

export function BroadcastScreen() {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function send() {
    if (!title.trim() || !body.trim()) {
      setError('Enter a title and a message.');
      return;
    }
    setBusy(true); setError('');
    try {
      const result = await callFunction<{ title: string; body: string; targetRole: Audience }, { recipientCount: number; sent: number; failed: number }>(
        'broadcastAnnouncement',
        { title: title.trim(), body: body.trim(), targetRole: audience },
      );
      setNotice(`Delivered to ${result.recipientCount} inboxes · ${result.sent} device pushes.`);
      setTitle('');
      setBody('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send the announcement.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>Broadcast centre</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
          Announcements appear instantly in members' in-app inboxes and as push notifications on their devices.
        </Text>
        <Card mode="outlined">
          <Card.Content style={styles.form}>
            <Text variant="labelLarge">Audience</Text>
            <SegmentedButtons
              value={audience}
              onValueChange={(value) => setAudience(value as Audience)}
              buttons={[
                { value: 'all', label: 'Everyone', icon: 'account-multiple' },
                { value: 'student', label: 'Students', icon: 'school' },
                { value: 'alumni', label: 'Alumni', icon: 'account-star' },
                { value: 'business', label: 'Employers', icon: 'domain' },
              ]}
            />
            <TextInput mode="outlined" label="Title" value={title} onChangeText={setTitle} maxLength={120} />
            <TextInput mode="outlined" label="Message" value={body} onChangeText={setBody} maxLength={2000} multiline numberOfLines={5} />
            {error ? <HelperText type="error">{error}</HelperText> : null}
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" icon="bullhorn" loading={busy} disabled={busy} onPress={() => void send()}>Send announcement</Button>
          </Card.Actions>
        </Card>
      </ScrollView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={4000}>{notice}</Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontWeight: '700' },
  form: { gap: 12 },
});
