import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { completeStudentRegistration } from '../../auth/authService';
import { useAuth } from '../../auth/AuthProvider';

export function AccountProvisioningScreen({ error }: { error: string | null }) {
  const { firebaseUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    setBusy(true);
    try {
      await firebaseUser?.reload();
      await completeStudentRegistration();
    } catch (err) {
      Alert.alert('Account setup', err instanceof Error ? err.message : 'Unable to complete account setup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finish account verification</Text>
      <Text style={styles.body}>
        Your Firebase identity exists, but the Richfield profile has not been activated yet.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {firebaseUser?.emailVerified === false ? (
        <Text style={styles.body}>Check your institutional inbox, verify your email, then return here.</Text>
      ) : null}
      <Pressable style={styles.button} onPress={() => void complete()} disabled={busy}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>I've verified my email</Text>}
      </Pressable>
      <Pressable style={styles.link} onPress={() => void logout()}>
        <Text>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 24, color: '#4B5563' },
  error: { color: '#B91C1C' },
  button: { minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  buttonText: { color: '#FFF', fontWeight: '800' },
  link: { alignItems: 'center', padding: 12 },
});
