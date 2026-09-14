import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, List, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthProvider';
import { calculateProfileCompleteness } from '../../profile/profileService';
import type { ProfileCompleteness } from '../../types/portfolio';
import { initials } from '../../members/memberService';

const ACTIONS = [
  { tab: 'Feed', title: 'Share your career story', description: 'Help current students choose their path', icon: 'bullhorn-outline' },
  { tab: 'Opportunities', title: 'Explore career pathways and events', description: 'See where classmates ended up and what’s on campus', icon: 'map-marker-path' },
  { tab: 'Connections', title: 'Reconnect and mentor', description: 'Find classmates and support current students', icon: 'account-group-outline' },
  { tab: 'Portfolio', title: 'Update your career history', description: 'Your journey appears in the pathway explorer', icon: 'card-account-details-outline' },
];

/** Alumni home: profile strength plus the actions that matter most to graduates. */
export function AlumniDashboard() {
  const { firebaseUser, profile } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const [completeness, setCompleteness] = useState<ProfileCompleteness | null>(null);
  const name = profile?.displayName || 'Richfield graduate';

  useEffect(() => {
    if (!firebaseUser) return;
    calculateProfileCompleteness(firebaseUser.uid).then(setCompleteness).catch(() => undefined);
  }, [firebaseUser]);

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Card mode="contained" style={[styles.card, { backgroundColor: theme.colors.primaryContainer }]}>
        <Card.Title
          title={`Welcome back, ${name.split(' ')[0]}`}
          subtitle={profile?.headline || 'Richfield alumni network'}
          titleVariant="titleLarge"
          titleStyle={{ color: theme.colors.onPrimaryContainer }}
          subtitleStyle={{ color: theme.colors.onPrimaryContainer }}
          left={(props) => <Avatar.Text {...props} label={initials(name)} />}
        />
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Profile strength</Text>
          {completeness ? (
            <>
              <Text variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>{completeness.score}%</Text>
              <ProgressBar progress={completeness.score / 100} style={styles.bar} />
              {completeness.missing.slice(0, 3).map((item) => (
                <List.Item key={item} title={`Add ${item.toLowerCase()}`} left={(props) => <List.Icon {...props} icon="plus-circle-outline" />} style={styles.suggestion} />
              ))}
            </>
          ) : <ActivityIndicator style={styles.loading} />}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.section}>Get involved</Text>
      <View style={styles.actions}>
        {ACTIONS.map((action) => (
          <Card key={action.tab} mode="outlined" style={styles.action} onPress={() => navigation.navigate(action.tab)}>
            <Card.Title
              title={action.title}
              titleNumberOfLines={2}
              subtitle={action.description}
              subtitleNumberOfLines={2}
              left={(props) => <Avatar.Icon {...props} icon={action.icon} />}
            />
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 860, alignSelf: 'center' },
  card: { marginBottom: 12 },
  bar: { height: 10, borderRadius: 5, marginVertical: 8 },
  suggestion: { paddingVertical: 0 },
  loading: { marginVertical: 16 },
  section: { marginTop: 8, marginBottom: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { flexGrow: 1, flexBasis: 300 },
});
