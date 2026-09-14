import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Avatar, Card, List, ProgressBar, Text, useTheme } from 'react-native-paper';

export function AlumniEmailLinkPendingScreen() {
  const theme = useTheme();
  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Check your email"
          subtitle="Step 2 of 2 · confirm it's you"
          titleVariant="titleLarge"
          left={(props) => <Avatar.Icon {...props} icon="email-fast-outline" style={{ backgroundColor: theme.colors.secondary }} />}
        />
        <ProgressBar progress={1} style={styles.progress} color={theme.colors.secondary} />
        <Card.Content style={styles.body}>
          <Text variant="bodyLarge" style={{ lineHeight: 24 }}>
            If your details match an eligible alumni record, we've sent a secure sign-in link to your personal email.
          </Text>
          <List.Item title="Open the link on this device" left={(props) => <List.Icon {...props} icon="cellphone-link" />} style={styles.item} />
          <List.Item title="Your alumni account is created and verified" left={(props) => <List.Icon {...props} icon="account-check-outline" />} style={styles.item} />
          <List.Item title="Build your profile and join career pathways" left={(props) => <List.Icon {...props} icon="map-marker-path" />} style={styles.item} />
          <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
            For security, this screen never reveals whether a registry record matched.
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480 },
  progress: { marginHorizontal: 16 },
  body: { gap: 4, paddingVertical: 12 },
  item: { paddingVertical: 0 },
  note: { marginTop: 8, fontStyle: 'italic' },
});
