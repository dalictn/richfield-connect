import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { registerBusiness } from '../auth/authService';

export function BusinessRegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await registerBusiness(email, password, { companyName, industry, description, location, website, contactName, contactPhone });
    } catch (error) {
      Alert.alert('Registration failed', error instanceof Error ? error.message : 'Please check your details.');
    } finally {
      setBusy(false);
    }
  }

  const fields = [
    ['Email', email, setEmail, false],
    ['Password', password, setPassword, true],
    ['Company name', companyName, setCompanyName, false],
    ['Industry', industry, setIndustry, false],
    ['Company description', description, setDescription, false],
    ['Location', location, setLocation, false],
    ['Website', website, setWebsite, false],
    ['Contact name', contactName, setContactName, false],
    ['Contact phone', contactPhone, setContactPhone, false],
  ] as const;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Business user registration</Text>
      <Text style={styles.body}>Business accounts are created in a locked state and must be approved by a Richfield administrator.</Text>
      {fields.map(([label, value, setter, secure]) => (
        <TextInput
          key={label}
          style={styles.input}
          placeholder={label}
          secureTextEntry={secure}
          autoCapitalize={label === 'Email' ? 'none' : 'sentences'}
          value={value}
          onChangeText={setter}
        />
      ))}
      <Pressable style={styles.button} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Register for approval</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 10 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 4 },
  body: { color: '#4B5563', lineHeight: 22, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14 },
  button: { minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', marginTop: 6 },
  buttonText: { color: '#FFF', fontWeight: '800' },
});
