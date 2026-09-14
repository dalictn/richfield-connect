import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Avatar, Card, List, Text, useTheme } from 'react-native-paper';

const CHOICES = [
  { route: 'StudentRegister', title: 'Student', description: 'Register with your Richfield or AAA institutional email', icon: 'school' },
  { route: 'AlumniVerify', title: 'Alumni', description: 'Verify your former student record, then confirm by email link', icon: 'account-star' },
  { route: 'BusinessRegister', title: 'Employer', description: 'Register your company; an administrator approves access', icon: 'domain' },
];

export function RegisterChoiceScreen({ navigation }: any) {
  const theme = useTheme();
  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <Text variant="headlineMedium" style={styles.title}>Join Richfield Connect</Text>
      <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        Every account is verified. Choose how you're joining.
      </Text>
      {CHOICES.map((choice) => (
        <Card key={choice.route} mode="outlined" style={styles.card} onPress={() => navigation.navigate(choice.route)}>
          <Card.Title
            title={choice.title}
            subtitle={choice.description}
            subtitleNumberOfLines={2}
            titleVariant="titleMedium"
            left={(props) => <Avatar.Icon {...props} icon={choice.icon} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </Card>
      ))}
      <Text variant="bodySmall" style={[styles.footnote, { color: theme.colors.onSurfaceVariant }]}>
        Administrator accounts are provisioned by Richfield staff and cannot self-register.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 4, marginBottom: 16 },
  card: { marginBottom: 12 },
  footnote: { marginTop: 8, textAlign: 'center' },
});
