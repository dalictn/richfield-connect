import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { registerStudent } from '../auth/authService';

export function StudentRegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await registerStudent(email, password, displayName);
      setSent(true);
    } catch (error) {
      Alert.alert('Registration failed', error instanceof Error ? error.message : 'Please check your details.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Verify your institutional email</Text>
        <Text style={styles.body}>We sent a verification email to {email.trim().toLowerCase()}. Open it, then return to the app to finish provisioning your student profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Student registration</Text>
      <Text style={styles.body}>Use an email ending exactly in @richfield.ac.za or @aaa.ac.za.</Text>
      <TextInput style={styles.input} placeholder="Full name" value={displayName} onChangeText={setDisplayName} />
      <TextInput style={styles.input} placeholder="Institutional email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password (8+ characters)" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={styles.button} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Register</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 28, fontWeight: '900' },
  body: { color: '#4B5563', lineHeight: 23 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14 },
  button: { minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  buttonText: { color: '#FFF', fontWeight: '800' },
});
