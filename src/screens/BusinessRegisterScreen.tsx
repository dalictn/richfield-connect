import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Divider, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { registerBusiness } from '../auth/authService';

export function BusinessRegisterScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    try {
      await registerBusiness(email, password, { companyName, industry, description, location, website, contactName, contactPhone });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please check your details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Employer registration"
          subtitle="Reviewed by a Richfield administrator"
          titleVariant="titleLarge"
          left={(props) => <Avatar.Icon {...props} icon="domain" />}
        />
        <Card.Content style={styles.form}>
          <Card mode="contained" style={{ backgroundColor: theme.colors.tertiaryContainer }}>
            <Card.Content style={styles.notice}>
              <Avatar.Icon size={32} icon="shield-check-outline" style={{ backgroundColor: theme.colors.tertiary }} />
              <Text variant="bodyMedium" style={[styles.noticeText, { color: theme.colors.onTertiaryContainer }]}>
                Employer accounts start locked. You can post opportunities and search talent once an administrator approves your organisation.
              </Text>
            </Card.Content>
          </Card>

          <Text variant="titleSmall" style={styles.group}>Sign-in details</Text>
          <TextInput mode="outlined" label="Work email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} left={<TextInput.Icon icon="email-outline" />} />
          <TextInput
            mode="outlined"
            label="Password (8+ characters)"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            left={<TextInput.Icon icon="lock-outline" />}
            right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword((v) => !v)} />}
          />

          <Divider style={styles.divider} />
          <Text variant="titleSmall" style={styles.group}>Organisation</Text>
          <TextInput mode="outlined" label="Company name" value={companyName} onChangeText={setCompanyName} left={<TextInput.Icon icon="office-building-outline" />} />
          <View style={styles.pair}>
            <TextInput mode="outlined" label="Industry" value={industry} onChangeText={setIndustry} style={styles.half} />
            <TextInput mode="outlined" label="Location" value={location} onChangeText={setLocation} style={styles.half} />
          </View>
          <TextInput mode="outlined" label="What your company does" multiline numberOfLines={3} value={description} onChangeText={setDescription} />
          <TextInput mode="outlined" label="Website" autoCapitalize="none" placeholder="https://…" value={website} onChangeText={setWebsite} left={<TextInput.Icon icon="web" />} />

          <Divider style={styles.divider} />
          <Text variant="titleSmall" style={styles.group}>Contact person</Text>
          <View style={styles.pair}>
            <TextInput mode="outlined" label="Full name" value={contactName} onChangeText={setContactName} style={styles.half} />
            <TextInput mode="outlined" label="Phone" keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} style={styles.half} />
          </View>

          {error ? <HelperText type="error" visible accessibilityRole="alert">{error}</HelperText> : null}
          <Button mode="contained" icon="send-check-outline" loading={busy} disabled={busy} onPress={() => void submit()} contentStyle={styles.buttonContent} style={styles.submit}>
            Register for approval
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 560 },
  form: { gap: 10, paddingVertical: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noticeText: { flex: 1, lineHeight: 20 },
  group: { marginTop: 6 },
  divider: { marginTop: 6 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  half: { flexGrow: 1, flexBasis: 180 },
  submit: { marginTop: 6 },
  buttonContent: { paddingVertical: 6 },
});
