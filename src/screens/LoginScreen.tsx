import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { login } from '../auth/authService';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (e) {
      // Errors are rendered inline rather than through Alert: react-native-web
      // implements Alert.alert as an empty function, so an alert here would
      // fail silently and the form would look like it did nothing.
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Richfield Connect</Text>
        <Text style={styles.subtitle}>Professional networking for the Richfield / AAA community.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@my.richfield.ac.za"
          placeholderTextColor="#98a2b3"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={(value) => { setEmail(value); if (error) setError(''); }}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Your password"
          placeholderTextColor="#98a2b3"
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={(value) => { setPassword(value); if (error) setError(''); }}
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
        />

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

        <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={() => void submit()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>

        <Pressable style={styles.link} onPress={() => navigation.navigate('RegisterChoice')}>
          <Text style={styles.linkText}>Create an account</Text>
        </Pressable>

        <Text style={styles.footnote}>Administrator accounts are provisioned by Richfield staff and cannot be created here.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f6f8fa' },
  // The form is capped and centred so it does not stretch the full width of a
  // desktop browser window when running under react-native-web.
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f6f8fa' },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e4e7ec', padding: 24, gap: 8 },
  title: { fontSize: 30, fontWeight: '900' },
  subtitle: { fontSize: 15, color: '#667085', marginBottom: 12, lineHeight: 21 },
  label: { fontWeight: '700', marginTop: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#fff' },
  error: { color: '#b42318', marginTop: 10, lineHeight: 20 },
  button: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', marginTop: 16 },
  buttonBusy: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '800' },
  link: { alignItems: 'center', paddingVertical: 12 },
  linkText: { fontWeight: '700' },
  footnote: { color: '#98a2b3', fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
