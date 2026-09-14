import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, HelperText, ProgressBar, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { beginAlumniVerification } from '../auth/authService';

type Attribute = 'nationalId' | 'birthdate';

export function AlumniVerifyScreen({ navigation }: any) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [attribute, setAttribute] = useState<Attribute>('nationalId');
  const [nationalId, setNationalId] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const secondFactor = attribute === 'nationalId' ? nationalId.trim() : birthdate.trim();
    if (!email.trim() || !studentNumber.trim() || !secondFactor) {
      setError(`Enter your email, student number and ${attribute === 'nationalId' ? 'national ID' : 'birthdate'}.`);
      return;
    }
    if (attribute === 'birthdate' && !/^\d{4}-\d{2}-\d{2}$/.test(secondFactor)) {
      setError('Enter your birthdate as YYYY-MM-DD.');
      return;
    }

    setBusy(true); setError('');
    try {
      await beginAlumniVerification(
        email.trim(),
        studentNumber.trim().toUpperCase(),
        attribute === 'nationalId' ? secondFactor : '',
        attribute === 'birthdate' ? secondFactor : '',
      );
      // The response is identical whether or not a registry record matched, so
      // the next screen never reveals which details were correct.
      navigation.replace('AlumniPending');
    } catch (e) {
      // A failure here is a transport or validation problem, not a registry
      // mismatch, so it is shown rather than papered over.
      setError(e instanceof Error ? e.message : 'We could not start verification. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Alumni verification"
          subtitle="Step 1 of 2 · match your student record"
          titleVariant="titleLarge"
          left={(props) => <Avatar.Icon {...props} icon="account-star" />}
        />
        <ProgressBar progress={0.5} style={styles.progress} />
        <Card.Content style={styles.form}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 21 }}>
            We check your former student number and one identity attribute against the Richfield graduate registry,
            then email you a secure sign-in link.
          </Text>

          <TextInput mode="outlined" label="Personal email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} left={<TextInput.Icon icon="email-outline" />} />
          <TextInput mode="outlined" label="Former student number" placeholder="e.g. ST1001" autoCapitalize="characters" value={studentNumber} onChangeText={setStudentNumber} left={<TextInput.Icon icon="card-account-details-outline" />} />

          <Text variant="labelLarge" style={styles.label}>Verify with</Text>
          <SegmentedButtons
            value={attribute}
            onValueChange={(value) => { setAttribute(value as Attribute); setError(''); }}
            buttons={[
              { value: 'nationalId', label: 'National ID', icon: 'badge-account-horizontal-outline' },
              { value: 'birthdate', label: 'Birthdate', icon: 'cake-variant-outline' },
            ]}
          />
          {attribute === 'nationalId' ? (
            <TextInput mode="outlined" label="South African ID number" keyboardType="number-pad" value={nationalId} onChangeText={(v) => setNationalId(v.replace(/[^0-9]/g, ''))} maxLength={13} />
          ) : (
            <TextInput mode="outlined" label="Birthdate" placeholder="YYYY-MM-DD" value={birthdate} onChangeText={setBirthdate} maxLength={10} />
          )}

          <View style={[styles.privacy, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Avatar.Icon size={28} icon="shield-lock-outline" />
            <Text variant="bodySmall" style={[styles.privacyText, { color: theme.colors.onSurfaceVariant }]}>
              Registry details are checked server-side and never sent back to the app. We don't reveal whether a record matched.
            </Text>
          </View>

          {error ? <HelperText type="error" visible accessibilityRole="alert">{error}</HelperText> : null}
          <Button mode="contained" icon="arrow-right" loading={busy} disabled={busy} onPress={() => void submit()} contentStyle={styles.buttonContent}>
            Continue
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480 },
  progress: { marginHorizontal: 16 },
  form: { gap: 10, paddingVertical: 12 },
  label: { marginTop: 4 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10 },
  privacyText: { flex: 1, lineHeight: 18 },
  buttonContent: { flexDirection: 'row-reverse', paddingVertical: 6 },
});
