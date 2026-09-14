import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Badge, Button, Card, Chip, HelperText, IconButton, List, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { endorseSkill, getVisibleProfile, removeRecommendation, writeRecommendation } from '../../profile/profileService';
import { recordProfileView } from '../../analyticsService';
import { reportContent } from '../../social/socialService';
import { RELATIONSHIPS } from '../../types/portfolio';
import type { Recommendation, VisibleProfile } from '../../types/portfolio';
import { initials, ROLE_LABELS } from '../../members/memberService';

/**
 * Someone else's profile. Everything arrives already redacted by the server, so
 * this screen has no filtering logic: a section the member hasn't shared with
 * this viewer simply isn't returned.
 */
export function ProfileViewScreen({ targetUid, onBack }: { targetUid: string; onBack?: () => void }) {
  const { firebaseUser } = useAuth();
  const theme = useTheme();
  const [profile, setProfile] = useState<VisibleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busySkill, setBusySkill] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [relationship, setRelationship] = useState<string>(RELATIONSHIPS[0]);
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setProfile(await getVisibleProfile(targetUid));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load this profile.');
    } finally {
      setLoading(false);
    }
  }, [targetUid]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (targetUid && targetUid !== firebaseUser?.uid) void recordProfileView(targetUid).catch(() => undefined);
  }, [targetUid, firebaseUser?.uid]);

  const isSelf = Boolean((profile as { isSelf?: boolean } | null)?.isSelf);
  const recommendations = (profile?.recommendations ?? []) as Recommendation[];
  const mine = recommendations.find((item) => item.authorUid === firebaseUser?.uid);
  const endorsementsFor = (skill: string) =>
    (profile?.endorsements ?? []).filter((item) => item.skill?.toLowerCase() === skill.toLowerCase()).length;

  async function endorse(skill: string) {
    setBusySkill(skill); setError('');
    try {
      const before = endorsementsFor(skill);
      await endorseSkill(targetUid, skill);
      await load();
      setNotice(before === endorsementsFor(skill) ? `You've already endorsed ${skill}.` : `Endorsed ${skill}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to endorse this skill.');
    } finally {
      setBusySkill(null);
    }
  }

  async function submitRecommendation() {
    setWriting(true); setError('');
    try {
      const result = await writeRecommendation(targetUid, relationship, body);
      setBody('');
      await load();
      setNotice(result.updated ? 'Your recommendation was updated.' : 'Recommendation published.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save this recommendation.');
    } finally {
      setWriting(false);
    }
  }

  async function report(item: Recommendation) {
    try {
      await reportContent({ contentType: 'recommendation', contentId: item.authorUid, parentId: targetUid, reason: 'Reported from a profile' });
      setNotice('Reported to the moderation team.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to report this recommendation.');
    }
  }

  if (loading) return <ActivityIndicator style={styles.loading} />;
  if (!profile) return <View style={styles.center}><HelperText type="error">{error || 'Profile unavailable.'}</HelperText></View>;

  const name = profile.displayName || 'Richfield member';
  const links = [
    { label: 'GitHub', icon: 'github', url: profile.gitHubUrl },
    { label: 'LinkedIn', icon: 'linkedin', url: profile.linkedInUrl },
    { label: 'Portfolio', icon: 'web', url: profile.portfolioUrl },
    { label: 'Credly', icon: 'certificate-outline', url: profile.credlyUrl },
    { label: 'CV', icon: 'file-account-outline', url: profile.resumeUrl },
  ].filter((link) => link.url);

  const Section = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <Card mode="outlined" style={styles.card}>
      <Card.Title title={title} titleVariant="titleMedium" left={(props) => <List.Icon {...props} icon={icon} color={theme.colors.primary} />} />
      <Card.Content>{children}</Card.Content>
    </Card>
  );

  const Timeline = ({ rows }: { rows: Array<{ key: string; title: string; description: string; icon: string; onPress?: () => void }> }) => (
    <>{rows.map((row) => (
      <List.Item
        key={row.key}
        title={row.title}
        titleNumberOfLines={2}
        description={row.description}
        descriptionNumberOfLines={4}
        onPress={row.onPress}
        left={(props) => <List.Icon {...props} icon={row.icon} />}
        style={styles.row}
      />
    ))}</>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack ? <Button icon="arrow-left" onPress={onBack} style={styles.back}>Back</Button> : null}

        <Card mode="elevated" style={styles.card}>
          <Card.Title
            title={name}
            titleVariant="headlineSmall"
            subtitle={[ROLE_LABELS[profile.role] ?? profile.role, profile.programmeOfStudy || profile.fieldOfWork, profile.campusLocation].filter(Boolean).join(' · ')}
            subtitleNumberOfLines={2}
            left={(props) => <Avatar.Text {...props} size={48} label={initials(name)} />}
            leftStyle={styles.avatarSlot}
          />
          <Card.Content>
            {profile.headline ? <Text variant="titleMedium" style={styles.headline}>{profile.headline}</Text> : null}
            {profile.summary ? <Text variant="bodyMedium" style={[styles.summary, { color: theme.colors.onSurfaceVariant }]}>{profile.summary}</Text> : null}
            {links.length ? (
              <View style={styles.chips}>
                {links.map((link) => <Chip key={link.label} icon={link.icon} onPress={() => void Linking.openURL(link.url!)}>{link.label}</Chip>)}
              </View>
            ) : null}
            {profile.email ? <Text variant="labelMedium" style={[styles.contact, { color: theme.colors.onSurfaceVariant }]}>{profile.email}</Text> : null}
          </Card.Content>
        </Card>

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Section title="Skills" icon="lightning-bolt-outline">
          {(profile.skills ?? []).length ? (
            <>
              <View style={styles.chips}>
                {(profile.skills ?? []).map((skill) => {
                  const count = endorsementsFor(skill);
                  return (
                    <View key={skill}>
                      <Chip icon={isSelf ? undefined : 'thumb-up-outline'} disabled={isSelf || busySkill === skill} onPress={() => void endorse(skill)}>{skill}</Chip>
                      {count ? <Badge size={18} style={styles.endorseBadge}>{count}</Badge> : null}
                    </View>
                  );
                })}
              </View>
              {!isSelf ? <Text variant="labelSmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>Tap a skill to endorse it.</Text> : null}
            </>
          ) : <Text style={{ color: theme.colors.onSurfaceVariant }}>No skills shared with you.</Text>}
        </Section>

        {(profile.workExperience ?? []).length ? (
          <Section title="Experience" icon="briefcase-outline">
            <Timeline rows={(profile.workExperience ?? []).map((w, i) => ({ key: `w${i}`, title: `${w.role} · ${w.company}`, description: `${w.startDate}${w.endDate ? ` – ${w.endDate}` : ' – present'}${w.description ? `\n${w.description}` : ''}`, icon: 'briefcase-outline' }))} />
          </Section>
        ) : null}

        {(profile.entrepreneurialExperience ?? []).length ? (
          <Section title="Ventures" icon="rocket-launch-outline">
            <Timeline rows={(profile.entrepreneurialExperience ?? []).map((v, i) => ({ key: `v${i}`, title: `${v.name} · ${v.role}`, description: `${v.startYear}${v.endYear ? ` – ${v.endYear}` : ' – present'}${v.description ? `\n${v.description}` : ''}`, icon: 'rocket-launch-outline' }))} />
          </Section>
        ) : null}

        {[...(profile.gitHubProjects ?? []), ...(profile.deployedProjects ?? [])].length ? (
          <Section title="Projects" icon="code-braces">
            <Timeline rows={[
              ...(profile.gitHubProjects ?? []).map((p, i) => ({ key: `g${i}`, title: p.name, description: p.description || p.url, icon: 'github', onPress: () => void Linking.openURL(p.url) })),
              ...(profile.deployedProjects ?? []).map((p, i) => ({ key: `d${i}`, title: p.name, description: p.description || p.url, icon: 'web', onPress: () => void Linking.openURL(p.url) })),
            ]} />
          </Section>
        ) : null}

        {[...(profile.qualifications ?? []), ...(profile.certifications ?? []), ...(profile.digitalBadges ?? []), ...(profile.achievements ?? [])].length ? (
          <Section title="Credentials & achievements" icon="school-outline">
            <Timeline rows={[
              ...(profile.qualifications ?? []).map((q, i) => ({ key: `q${i}`, title: q.title, description: `${q.institution} · ${q.yearCompleted}`, icon: 'school-outline' })),
              ...(profile.certifications ?? []).map((c, i) => ({ key: `c${i}`, title: c.name, description: `${c.issuer} · ${c.year}`, icon: 'certificate-outline' })),
              ...(profile.digitalBadges ?? []).map((b, i) => ({ key: `b${i}`, title: b.name, description: `${b.issuer}${b.issuedYear ? ` · ${b.issuedYear}` : ''}`, icon: 'shield-star-outline' })),
              ...(profile.achievements ?? []).map((a, i) => ({ key: `a${i}`, title: a.title, description: `${a.issuer ? `${a.issuer} · ` : ''}${a.year}`, icon: 'trophy-outline' })),
            ]} />
          </Section>
        ) : null}

        {[...(profile.leadershipRoles ?? []), ...(profile.activities ?? [])].length ? (
          <Section title="Leadership & activities" icon="account-group-outline">
            <Timeline rows={[
              ...(profile.leadershipRoles ?? []).map((l, i) => ({ key: `l${i}`, title: `${l.role} · ${l.organisation}`, description: `${l.startYear}${l.endYear ? ` – ${l.endYear}` : ' – present'}`, icon: 'star-circle-outline' })),
              ...(profile.activities ?? []).map((a, i) => ({ key: `ac${i}`, title: a.name, description: `${a.type}${a.year ? ` · ${a.year}` : ''}`, icon: 'flag-variant-outline' })),
            ]} />
          </Section>
        ) : null}

        {(profile.careerInterests ?? []).length || profile.careerAspirations ? (
          <Section title="Career interests" icon="compass-outline">
            <View style={styles.chips}>{(profile.careerInterests ?? []).map((item) => <Chip key={item} compact>{item}</Chip>)}</View>
            {profile.careerAspirations ? <Text variant="bodyMedium" style={styles.aspirations}>{profile.careerAspirations}</Text> : null}
          </Section>
        ) : null}

        {profile.companyName ? (
          <Section title="Company" icon="domain">
            <Text variant="titleMedium">{profile.companyName}</Text>
            {profile.industry ? <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{profile.industry}{profile.companyLocation ? ` · ${profile.companyLocation}` : ''}</Text> : null}
            {profile.companyDescription ? <Text variant="bodyMedium" style={styles.aspirations}>{profile.companyDescription}</Text> : null}
            {profile.talentSought ? <Text variant="bodyMedium" style={styles.aspirations}>Seeking: {profile.talentSought}</Text> : null}
          </Section>
        ) : null}

        <Section title={`Recommendations${recommendations.length ? ` (${recommendations.length})` : ''}`} icon="star-outline">
          {recommendations.length === 0 ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>No recommendations yet.</Text>
          ) : recommendations.map((item) => (
            <Card key={item.id} mode="contained" style={[styles.recommendation, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Card.Title
                title={item.authorName}
                subtitle={[item.relationship, item.authorHeadline].filter(Boolean).join(' · ')}
                subtitleNumberOfLines={2}
                left={(props) => <Avatar.Text {...props} size={36} label={initials(item.authorName)} />}
                right={() => (item.authorUid === firebaseUser?.uid || isSelf) ? (
                  <IconButton icon="delete-outline" onPress={async () => { await removeRecommendation(targetUid, item.authorUid); await load(); }} accessibilityLabel="Remove recommendation" />
                ) : (
                  <IconButton icon="flag-outline" onPress={() => void report(item)} accessibilityLabel="Report recommendation" />
                )}
              />
              <Card.Content><Text variant="bodyMedium" style={styles.recommendationBody}>“{item.body}”</Text></Card.Content>
            </Card>
          ))}
        </Section>

        {!isSelf ? (
          <Section title={mine ? 'Update your recommendation' : 'Write a recommendation'} icon="pencil-outline">
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>How do you know {name.split(' ')[0]}?</Text>
            <View style={styles.chips}>
              {RELATIONSHIPS.map((option) => <Chip key={option} selected={relationship === option} onPress={() => setRelationship(option)}>{option}</Chip>)}
            </View>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder={mine ? mine.body : 'A short, specific testimonial (at least 40 characters)'}
              value={body}
              onChangeText={setBody}
              style={styles.recommendationInput}
            />
            <Button mode="contained" icon="send" loading={writing} disabled={writing || body.trim().length < 40} onPress={() => void submitRecommendation()} style={styles.publish}>
              {mine ? 'Update recommendation' : 'Publish recommendation'}
            </Button>
          </Section>
        ) : null}
      </ScrollView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={3000}>{notice}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  back: { alignSelf: 'flex-start', marginBottom: 4 },
  card: { marginBottom: 12 },
  avatarSlot: { marginRight: 24 },
  headline: { marginBottom: 6 },
  summary: { lineHeight: 21, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  contact: { marginTop: 10 },
  endorseBadge: { position: 'absolute', top: -6, right: -6 },
  helper: { marginTop: 8 },
  row: { paddingLeft: 0 },
  aspirations: { marginTop: 8, lineHeight: 21 },
  recommendation: { marginBottom: 8 },
  recommendationBody: { fontStyle: 'italic', lineHeight: 21 },
  recommendationInput: { marginTop: 10 },
  publish: { marginTop: 10, alignSelf: 'flex-start' },
});
