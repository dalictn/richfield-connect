import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Avatar, Button, Card, Chip, List, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../auth/AuthProvider';

export function PendingApprovalScreen() {
  const { profile, logout } = useAuth();
  const theme = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.body}>
          <Avatar.Icon size={64} icon="timer-sand" style={{ backgroundColor: theme.colors.tertiary }} />
          <Text variant="headlineSmall" style={styles.title}>Awaiting administrator approval</Text>
          <Chip icon="clock-outline" style={[styles.chip, { backgroundColor: theme.colors.tertiaryContainer }]}>Under review</Chip>
          <Text variant="bodyLarge" style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            {profile?.companyName ?? 'Your organisation'} is registered. A Richfield administrator reviews every employer before granting access.
          </Text>
          <List.Section style={styles.list}>
            <List.Item title="Registration received" left={(props) => <List.Icon {...props} icon="check-circle" color={theme.colors.secondary} />} />
            <List.Item title="Administrator review" left={(props) => <List.Icon {...props} icon="progress-clock" color={theme.colors.tertiary} />} />
            <List.Item title="Post opportunities and search talent" left={(props) => <List.Icon {...props} icon="lock-outline" />} />
          </List.Section>
        </Card.Content>
        <Card.Actions>
          <Button icon="logout" onPress={() => void logout()}>Sign out</Button>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480 },
  body: { alignItems: 'center', gap: 12, paddingTop: 24 },
  title: { textAlign: 'center', fontWeight: '700' },
  chip: { alignSelf: 'center' },
  text: { textAlign: 'center', lineHeight: 24 },
  list: { alignSelf: 'stretch', marginBottom: 0 },
});
