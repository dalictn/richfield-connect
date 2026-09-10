import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { notify } from '../../ui/alert';
import { endorseSkill, getVisibleProfile, removeRecommendation, writeRecommendation } from '../../profile/profileService';
import { recordProfileView } from '../../analyticsService';
import { reportContent } from '../../social/socialService';
import { RELATIONSHIPS } from '../../types/portfolio';
import type { Recommendation, VisibleProfile } from '../../types/portfolio';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student', alumni: 'Alumnus', business: 'Employer', administrator: 'Richfield staff',
};

/**
 * Someone else's profile.
 *
 * Everything here arrives already redacted from getVisibleProfile — the client
 * never sees a field the subject has not shared with this viewer, so there is no
 * filtering logic in this screen. A section simply renders empty when it is
 * hidden, and the screen says so rather than pretending it does not exist.
 */
export function ProfileViewScreen({ targetUid, onBack }: { targetUid: string; onBack?: () => void }) {
  const { firebaseUser } = useAuth();
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
    // Fire and forget: a failed view count must never block the profile.
    if (targetUid && targetUid !== firebaseUser?.uid) {
      void recordProfileView(targetUid).catch(() => undefined);
    }
  }, [targetUid, firebaseUser?.uid]);

  const isSelf = Boolean((profile as { isSelf?: boolean } | null)?.isSelf);
  const recommendations: Recommendation[] = (profile?.recommendations ?? []) as Recommendation[];
  const endorsementsFor = (skill: string) =>
    (profile?.endorsements ?? []).filter((e) => e.skill?.toLowerCase() === skill.toLowerCase()).length;

  async function endorse(skill: string) {
    setBusySkill(skill); setNotice(''); setError('');
    try {
      const before = endorsementsFor(skill);
      await endorseSkill(targetUid, skill);
      await load();
      setNotice(before === endorsementsFor(skill) ? `You have already endorsed ${skill}.` : `Endorsed ${skill}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to endorse this skill.');
    } finally {
      setBusySkill(null);
    }
  }

  async function submitRecommendation() {
    setWriting(true); setNotice(''); setError('');
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

  async function report(rec: Recommendation) {
    try {
      await reportContent({ contentType: 'recommendation', contentId: rec.authorUid, parentId: targetUid, reason: 'Reported from a profile' });
      setNotice('Reported to the moderation team.');
    } catch (e) {
      notify('Could not report', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!profile) return <View style={styles.center}><Text style={styles.error}>{error || 'Profile unavailable.'}</Text></View>;

  const link = (label: string, url?: string) => url ? (
    <Pressable key={label} onPress={() => void Linking.openURL(url)} style={styles.linkChip}>
      <Text style={styles.linkChipText}>{label}</Text>
    </Pressable>
  ) : null;

  const mine = recommendations.find((r) => r.authorUid === firebaseUser?.uid);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {onBack ? <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable> : null}

      <View style={styles.header}>
        <Text style={styles.name}>{profile.displayName || 'Richfield member'}</Text>
        <Text style={styles.meta}>
          {ROLE_LABEL[profile.role] ?? profile.role}
          {profile.programmeOfStudy ? ` · ${profile.programmeOfStudy}` : ''}
          {profile.fieldOfWork ? ` · ${profile.fieldOfWork}` : ''}
          {profile.campusLocation ? ` · ${profile.campusLocation}` : ''}
        </Text>
        {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}
        {profile.summary ? <Text style={styles.summary}>{profile.summary}</Text> : null}
        <View style={styles.links}>
          {link('GitHub', profile.gitHubUrl)}
          {link('LinkedIn', profile.linkedInUrl)}
          {link('Portfolio', profile.portfolioUrl)}
          {link('Credly', profile.credlyUrl)}
          {link('CV', profile.resumeUrl)}
        </View>
        {profile.email ? <Text style={styles.contact}>{profile.email}</Text> : null}
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Block title="Skills" empty="No skills shared with you.">
        {(profile.skills ?? []).length ? (
          <View style={styles.skills}>
            {(profile.skills ?? []).map((skill) => {
              const count = endorsementsFor(skill);
              return (
                <Pressable
                  key={skill}
                  disabled={isSelf || busySkill === skill}
                  onPress={() => void endorse(skill)}
                  style={[styles.skill, isSelf && styles.skillStatic]}
                >
                  <Text style={styles.skillText}>{skill}</Text>
                  {count > 0 ? <Text style={styles.skillCount}>{count}</Text> : null}
                  {!isSelf ? <Text style={styles.endorseHint}>{busySkill === skill ? '…' : '+'}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {!isSelf && (profile.skills ?? []).length ? <Text style={styles.helper}>Tap a skill to endorse it.</Text> : null}
      </Block>

      <ListBlock title="Work experience" items={profile.workExperience ?? []} render={(w) => (
        <>
          <Text style={styles.itemTitle}>{w.role} · {w.company}</Text>
          <Text style={styles.itemMeta}>{w.startDate}{w.endDate ? ` – ${w.endDate}` : ' – present'}</Text>
          {w.description ? <Text style={styles.itemBody}>{w.description}</Text> : null}
        </>
      )} />

      <ListBlock title="Entrepreneurial experience" items={profile.entrepreneurialExperience ?? []} render={(v) => (
        <>
          <Text style={styles.itemTitle}>{v.name} · {v.role}</Text>
          <Text style={styles.itemMeta}>{v.startYear}{v.endYear ? ` – ${v.endYear}` : ' – present'}</Text>
          {v.description ? <Text style={styles.itemBody}>{v.description}</Text> : null}
        </>
      )} />

      <ListBlock title="GitHub projects" items={profile.gitHubProjects ?? []} render={(p) => (
        <>
          <Pressable onPress={() => void Linking.openURL(p.url)}><Text style={styles.itemLink}>{p.name}</Text></Pressable>
          {p.description ? <Text style={styles.itemBody}>{p.description}</Text> : null}
        </>
      )} />

      <ListBlock title="Websites and applications" items={profile.deployedProjects ?? []} render={(p) => (
        <>
          <Pressable onPress={() => void Linking.openURL(p.url)}><Text style={styles.itemLink}>{p.name}</Text></Pressable>
          {p.description ? <Text style={styles.itemBody}>{p.description}</Text> : null}
        </>
      )} />

      <ListBlock title="Qualifications" items={profile.qualifications ?? []} render={(q) => (
        <Text style={styles.itemTitle}>{q.title} · {q.institution} ({q.yearCompleted})</Text>
      )} />

      <ListBlock title="Certifications" items={profile.certifications ?? []} render={(c) => (
        <Text style={styles.itemTitle}>{c.name} · {c.issuer} ({c.year})</Text>
      )} />

      <ListBlock title="Digital badges" items={profile.digitalBadges ?? []} render={(b) => (
        <Text style={styles.itemTitle}>{b.name} · {b.issuer}{b.issuedYear ? ` (${b.issuedYear})` : ''}</Text>
      )} />

      <ListBlock title="Achievements and awards" items={profile.achievements ?? []} render={(a) => (
        <>
          <Text style={styles.itemTitle}>{a.title} ({a.year})</Text>
          {a.issuer ? <Text style={styles.itemMeta}>{a.issuer}</Text> : null}
          {a.description ? <Text style={styles.itemBody}>{a.description}</Text> : null}
        </>
      )} />

      <ListBlock title="Leadership" items={profile.leadershipRoles ?? []} render={(l) => (
        <>
          <Text style={styles.itemTitle}>{l.role} · {l.organisation}</Text>
          <Text style={styles.itemMeta}>{l.startYear}{l.endYear ? ` – ${l.endYear}` : ' – present'}</Text>
        </>
      )} />

      <ListBlock title="Clubs, societies and competitions" items={profile.activities ?? []} render={(a) => (
        <>
          <Text style={styles.itemTitle}>{a.name}</Text>
          <Text style={styles.itemMeta}>{a.type}{a.year ? ` · ${a.year}` : ''}</Text>
        </>
      )} />

      {(profile.careerInterests ?? []).length || profile.careerAspirations ? (
        <Block title="Career interests">
          <View style={styles.skills}>
            {(profile.careerInterests ?? []).map((interest) => (
              <View key={interest} style={styles.skillStatic}><Text style={styles.skillText}>{interest}</Text></View>
            ))}
          </View>
          {profile.careerAspirations ? <Text style={styles.itemBody}>{profile.careerAspirations}</Text> : null}
        </Block>
      ) : null}

      {profile.companyName ? (
        <Block title="Company">
          <Text style={styles.itemTitle}>{profile.companyName}</Text>
          {profile.industry ? <Text style={styles.itemMeta}>{profile.industry}{profile.companyLocation ? ` · ${profile.companyLocation}` : ''}</Text> : null}
          {profile.companyDescription ? <Text style={styles.itemBody}>{profile.companyDescription}</Text> : null}
          {profile.talentSought ? <Text style={styles.itemBody}>Seeking: {profile.talentSought}</Text> : null}
        </Block>
      ) : null}

      <Block title="Recommendations" empty="No recommendations yet.">
        {recommendations.map((rec) => (
          <View key={rec.id} style={styles.item}>
            <Text style={styles.itemTitle}>{rec.authorName}</Text>
            <Text style={styles.itemMeta}>{rec.relationship}{rec.authorHeadline ? ` · ${rec.authorHeadline}` : ''}</Text>
            <Text style={styles.itemBody}>{rec.body}</Text>
            <View style={styles.recActions}>
              {(rec.authorUid === firebaseUser?.uid || isSelf) ? (
                <Pressable onPress={async () => { await removeRecommendation(targetUid, rec.authorUid); await load(); }}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => void report(rec)}><Text style={styles.reportText}>⚑ Report</Text></Pressable>
              )}
            </View>
          </View>
        ))}
      </Block>

      {!isSelf ? (
        <Block title={mine ? 'Update your recommendation' : 'Write a recommendation'}>
          <Text style={styles.helper}>How do you know {profile.displayName || 'this member'}?</Text>
          <View style={styles.skills}>
            {RELATIONSHIPS.map((option) => {
              const active = relationship === option;
              return (
                <Pressable key={option} onPress={() => setRelationship(option)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={active ? styles.chipActiveText : styles.chipText}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.textarea}
            value={body}
            onChangeText={setBody}
            multiline
            placeholder={mine ? mine.body : 'Write a short, specific testimonial (at least 40 characters).'}
            placeholderTextColor="#98a2b3"
          />
          <Pressable onPress={() => void submitRecommendation()} disabled={writing} style={[styles.primary, writing && styles.disabled]}>
            {writing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mine ? 'Update recommendation' : 'Publish recommendation'}</Text>}
          </Pressable>
        </Block>
      ) : null}
    </ScrollView>
  );
}

function Block({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: string }) {
  const hasChildren = React.Children.toArray(children).some(Boolean);
  if (!hasChildren && !empty) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {hasChildren ? children : <Text style={styles.emptyText}>{empty}</Text>}
    </View>
  );
}

function ListBlock<T>({ title, items, render }: { title: string; items: T[]; render: (item: T) => React.ReactNode }) {
  if (!items.length) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {items.map((item, index) => <View key={index} style={styles.item}>{render(item)}</View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8fa' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  back: { paddingVertical: 8 },
  backText: { fontWeight: '700', color: '#475467' },
  header: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e4e7ec', padding: 18, marginBottom: 12 },
  name: { fontSize: 24, fontWeight: '800' },
  meta: { color: '#667085', marginTop: 4 },
  headline: { marginTop: 10, fontWeight: '600', lineHeight: 21 },
  summary: { marginTop: 8, lineHeight: 21, color: '#344054' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  linkChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#111827' },
  linkChipText: { fontSize: 12, fontWeight: '700' },
  contact: { marginTop: 10, color: '#667085', fontSize: 12 },
  notice: { color: '#166534', marginBottom: 10 },
  error: { color: '#b42318', marginBottom: 10 },
  block: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e4e7ec', padding: 16, marginBottom: 12 },
  blockTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  emptyText: { color: '#98a2b3', fontStyle: 'italic' },
  helper: { color: '#667085', fontSize: 12, marginBottom: 8 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f2f4f7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  skillStatic: { backgroundColor: '#f2f4f7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  skillText: { fontSize: 13 },
  skillCount: { fontSize: 11, fontWeight: '800', color: '#111827' },
  endorseHint: { fontSize: 13, color: '#667085', fontWeight: '800' },
  item: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f2f4f7' },
  itemTitle: { fontWeight: '700' },
  itemMeta: { color: '#667085', marginTop: 2, fontSize: 12 },
  itemBody: { marginTop: 6, lineHeight: 20, color: '#344054' },
  itemLink: { fontWeight: '700', color: '#175cd3' },
  recActions: { flexDirection: 'row', gap: 14, marginTop: 8 },
  removeText: { color: '#b42318', fontWeight: '700', fontSize: 12 },
  reportText: { color: '#667085', fontSize: 12 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#d0d5dd' },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 12 },
  chipActiveText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  textarea: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, padding: 10, minHeight: 110, textAlignVertical: 'top', marginTop: 10 },
  primary: { backgroundColor: '#111827', paddingVertical: 13, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
