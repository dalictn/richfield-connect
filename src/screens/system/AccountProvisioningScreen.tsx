import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Avatar, Button, Card, HelperText, Text, useTheme } from 'react-native-paper';
import { completeStudentRegistration } from '../../auth/authService';
import { useAuth } from '../../auth/AuthProvider';

export function AccountProvisioningScreen({ error }: { error: string | null }) {
  const { firebaseUser, logout } = useAuth();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  const complete = async () => {
    setBusy(true); setFailure('');
    try {
      await firebaseUser?.reload();
      await completeStudentRegistration();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Unable to complete account setup.');
    } finally {
      setBusy(false);
    }
  };

  const unverified = firebaseUser?.emailVerified === false;
  const message = failure || error;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.body}>
          <Avatar.Icon size={64} icon={unverified ? 'email-alert-outline' : 'account-cog-outline'} />
          <Text variant="headlineSmall" style={styles.title}>Finish account verification</Text>
          <Text variant="bodyLarge" style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            {unverified
              ? `Open the verification link we sent to ${firebaseUser?.email ?? 'your institutional inbox'}, then come back here.`
              : 'Your sign-in exists, but your Richfield profile has not been activated yet.'}
          </Text>
          {message ? <HelperText type="error" visible style={styles.text}>{message}</HelperText> : null}
        </Card.Content>
        <Card.Actions style={styles.actions}>
          <Button icon="logout" onPress={() => void logout()}>Sign out</Button>
          <Button mode="contained" icon="check" loading={busy} disabled={busy} onPress={() => void complete()}>
            I've verified my email
          </Button>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480 },
  body: { alignItems: 'center', gap: 12, paddingTop: 24 },
  title: { textAlign: 'center', fontWeight: '700' },
  text: { textAlign: 'center', lineHeight: 24 },
  actions: { padding: 12 },
});
