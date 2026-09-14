import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Avatar, Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { registerStudent } from '../auth/authService';

export function StudentRegisterScreen() {
  const theme = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    try {
      await registerStudent(email, password, displayName);
      setSent(true);
    } catch (e) {
      // Shown inline: the institutional-domain rejection is part of the demo.
      setError(e instanceof Error ? e.message : 'Please check your details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <Card mode="elevated" style={styles.card}>
        {sent ? (
          <Card.Content style={styles.form}>
            <Avatar.Icon icon="email-check-outline" size={56} style={{ backgroundColor: theme.colors.secondary }} />
            <Text variant="headlineSmall">Verify your institutional email</Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              We sent a verification link to {email.trim().toLowerCase()}. Open it, then sign in to finish setting up your profile.
            </Text>
          </Card.Content>
        ) : (
          <>
            <Card.Title
              title="Student registration"
              subtitle="Richfield and AAA institutional emails only"
              titleVariant="titleLarge"
              left={(props) => <Avatar.Icon {...props} icon="school" />}
            />
            <Card.Content style={styles.form}>
              <TextInput mode="outlined" label="Full name" value={displayName} onChangeText={setDisplayName} left={<TextInput.Icon icon="account-outline" />} />
              <TextInput
                mode="outlined"
                label="Institutional email"
                placeholder="you@my.richfield.ac.za"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={(value) => { setEmail(value); if (error) setError(''); }}
                left={<TextInput.Icon icon="email-outline" />}
              />
              <HelperText type="info" visible={!error}>
                Accepted: @my.richfield.ac.za, @richfield.ac.za, @my.aaa.ac.za, @aaa.ac.za
              </HelperText>
              <TextInput mode="outlined" label="Password (8+ characters)" secureTextEntry value={password} onChangeText={setPassword} left={<TextInput.Icon icon="lock-outline" />} />
              {error ? <HelperText type="error" visible accessibilityRole="alert">{error}</HelperText> : null}
              <Button mode="contained" icon="account-plus" loading={busy} disabled={busy} onPress={() => void submit()} contentStyle={styles.buttonContent}>
                Register
              </Button>
            </Card.Content>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 460 },
  form: { gap: 10, paddingVertical: 8 },
  buttonContent: { paddingVertical: 6 },
});
