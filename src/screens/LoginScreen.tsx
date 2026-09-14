import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { login } from '../auth/authService';

export function LoginScreen({ navigation }: any) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      // Inline rather than a dialog: react-native-web implements Alert.alert as
      // an empty function, so a dialog would fail silently on web.
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  const clearError = () => { if (error) setError(''); };

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <View style={styles.brand}>
        <Avatar.Icon size={64} icon="school" style={{ backgroundColor: theme.colors.primary }} />
        <Text variant="headlineMedium" style={styles.title}>Richfield Connect</Text>
        <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          The verified professional network for the Richfield and AAA community.
        </Text>
      </View>

      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.form}>
          <TextInput
            mode="outlined"
            label="Email"
            placeholder="you@my.richfield.ac.za"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            left={<TextInput.Icon icon="email-outline" />}
            value={email}
            onChangeText={(value) => { setEmail(value); clearError(); }}
          />
          <TextInput
            mode="outlined"
            label="Password"
            secureTextEntry={!showPassword}
            textContentType="password"
            left={<TextInput.Icon icon="lock-outline" />}
            right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword((v) => !v)} />}
            value={password}
            onChangeText={(value) => { setPassword(value); clearError(); }}
            onSubmitEditing={() => void submit()}
            returnKeyType="go"
          />
          {error ? <HelperText type="error" visible accessibilityRole="alert">{error}</HelperText> : null}
          <Button mode="contained" icon="login" loading={busy} disabled={busy} onPress={() => void submit()} contentStyle={styles.buttonContent}>
            Sign in
          </Button>
          <Button mode="text" onPress={() => navigation.navigate('RegisterChoice')}>Create an account</Button>
        </Card.Content>
      </Card>

      <Text variant="bodySmall" style={[styles.footnote, { color: theme.colors.onSurfaceVariant }]}>
        Administrator accounts are provisioned by Richfield staff and cannot be created here.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 20, maxWidth: 420 },
  title: { marginTop: 12, fontWeight: '700' },
  subtitle: { textAlign: 'center', marginTop: 4 },
  card: { width: '100%', maxWidth: 420 },
  form: { gap: 12, paddingVertical: 8 },
  buttonContent: { paddingVertical: 6 },
  footnote: { marginTop: 16, textAlign: 'center', maxWidth: 420 },
});
