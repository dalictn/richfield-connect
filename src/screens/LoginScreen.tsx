import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { login } from '../auth/authService';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert('Sign-in failed', error instanceof Error ? error.message : 'Please check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Richfield Connect</Text>
      <Text style={styles.subtitle}>Professional networking for the Richfield / AAA community.</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={styles.button} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.navigate('RegisterChoice')}>
        <Text style={styles.linkText}>Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 32, fontWeight: '900' },
  subtitle: { fontSize: 16, color: '#4B5563', marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14 },
  button: { minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  buttonText: { color: '#FFF', fontWeight: '800' },
  link: { alignItems: 'center', padding: 12 },
  linkText: { fontWeight: '700' },
});
