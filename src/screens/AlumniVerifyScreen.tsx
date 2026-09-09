import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { beginAlumniVerification } from '../auth/authService';
import { notify } from '../ui/alert';

export function AlumniVerifyScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const accepted = await beginAlumniVerification(email, studentNumber, nationalId, birthdate);
      navigation.replace('AlumniPending');
      if (!accepted) {
        notify('Check your email', 'If your details match an eligible alumni record, a verification link will be sent shortly.');
      }
    } catch (error) {
      notify('Verification unavailable', error instanceof Error ? error.message : 'Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alumni verification</Text>
      <Text style={styles.body}>Step 1 of 2. Enter your former student number and one additional identity attribute.</Text>
      <TextInput style={styles.input} placeholder="Personal email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Former student number" value={studentNumber} onChangeText={setStudentNumber} />
      <TextInput style={styles.input} placeholder="National ID (or use birthdate below)" value={nationalId} onChangeText={setNationalId} />
      <TextInput style={styles.input} placeholder="Birthdate (YYYY-MM-DD)" value={birthdate} onChangeText={setBirthdate} />
      <Text style={styles.note}>National ID or birthdate is required. Your registry details are never exposed to the app.</Text>
      <Pressable style={styles.button} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Continue</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '900' },
  body: { color: '#4B5563', lineHeight: 22 },
  note: { color: '#64748B', fontSize: 13 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14 },
  button: { minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  buttonText: { color: '#FFF', fontWeight: '800' },
});
