import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Avatar, Button, Card, List, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { useTutorial } from '../../tutorial/TutorialHost';
import { initials, ROLE_LABELS } from '../../members/memberService';

export function AccountScreen() {
  const { profile, logout } = useAuth();
  const { start } = useTutorial();
  const theme = useTheme();
  const name = profile?.displayName || 'Richfield member';

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title={name}
          subtitle={profile?.email}
          titleVariant="titleLarge"
          left={(props) => <Avatar.Text {...props} label={initials(name)} />}
        />
        <Card.Content>
          <List.Item title="Role" description={ROLE_LABELS[profile?.role ?? ''] ?? profile?.role} left={(props) => <List.Icon {...props} icon="badge-account-outline" />} />
          {profile?.companyName ? (
            <List.Item title="Company" description={profile.companyName} left={(props) => <List.Icon {...props} icon="domain" />} />
          ) : null}
          <List.Item
            title="Account status"
            description={profile?.role === 'business' && !profile.isApproved ? 'Awaiting administrator approval' : 'Active'}
            left={(props) => <List.Icon {...props} icon="shield-check-outline" />}
          />
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <List.Item
          title="Replay the guided tour"
          description="Walk through the key screens with your AI assistant again"
          left={(props) => <List.Icon {...props} icon="map-marker-path" color={theme.colors.primary} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={start}
        />
      </Card>

      <Button mode="outlined" icon="logout" onPress={() => void logout()} style={styles.signOut} textColor={theme.colors.error}>
        Sign out
      </Button>
      <Text variant="bodySmall" style={[styles.footnote, { color: theme.colors.onSurfaceVariant }]}>
        Richfield Connect · your data is handled in line with POPIA.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: { marginBottom: 12 },
  signOut: { marginTop: 8, alignSelf: 'flex-start' },
  footnote: { marginTop: 16 },
});
