import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Chip, Divider, HelperText, List, ProgressBar, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { completeOnboarding, savePortfolio, sendProfileAssistantMessage } from '../../profile/profileService';
import { CAMPUS_LOCATIONS, defaultVisibility, normaliseVisibility } from '../../types/portfolio';
import type { CampusLocation, EditablePortfolioProfile, PortfolioProfile } from '../../types/portfolio';

const steps = [
  { title: 'Start with your professional identity', icon: 'account-tie-outline', hint: 'A headline says what you do and where you are going. It is the first thing an employer reads.' },
  { title: 'Where you study', icon: 'school-outline', hint: 'Your programme and campus decide which opportunities are matched to you and where you appear in alumni career pathways.' },
  { title: 'Tell employers what you can do', icon: 'lightning-bolt-outline', hint: 'Add three or more real skills you can demonstrate. Profiles with no skills do not appear in employer searches.' },
  { title: 'Show evidence', icon: 'file-certificate-outline', hint: 'A short summary plus at least one link. You can add projects, certifications and everything else from your portfolio afterwards.' },
  { title: 'Review', icon: 'check-decagram-outline', hint: 'You can change anything later, and you control who sees each section. Nothing is published by the assistant without your approval.' },
];

const parseSkills = (value: string) => Array.from(new Set(value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)));

function ReviewRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  const theme = useTheme();
  return (
    <List.Item
      title={label}
      description={value || 'Not added'}
      descriptionNumberOfLines={3}
      descriptionStyle={value ? undefined : { color: theme.colors.error, fontStyle: 'italic' }}
      left={(props) => <List.Icon {...props} icon={value ? 'check-circle' : icon} color={value ? theme.colors.secondary : theme.colors.onSurfaceVariant} />}
      style={styles.reviewRow}
    />
  );
}

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { profile } = useAuth();
  const theme = useTheme();
  const source = profile as unknown as PortfolioProfile | null;
  const isAlumni = source?.role === 'alumni';
  const isBusiness = source?.role === 'business';

  const [step, setStep] = useState(0);
  const [headline, setHeadline] = useState(source?.headline ?? '');
  const [programme, setProgramme] = useState(source?.programmeOfStudy ?? '');
  const [fieldOfWork, setFieldOfWork] = useState(source?.fieldOfWork ?? '');
  const [campus, setCampus] = useState<CampusLocation>(source?.campusLocation ?? 'Distance Learning');
  const [yearOfEnrolment, setYearOfEnrolment] = useState(source?.yearOfEnrolment ? String(source.yearOfEnrolment) : '');
  const [skills, setSkills] = useState(source?.skills?.join(', ') ?? '');
  const [summary, setSummary] = useState(source?.summary ?? '');
  const [linkedInUrl, setLinkedInUrl] = useState(source?.linkedInUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantFeedback, setAssistantFeedback] = useState('');

  const skillList = parseSkills(skills);
  const current = steps[step];

  const askAssistant = async () => {
    if (!source || assistantLoading) return;
    setAssistantLoading(true);
    try {
      // Nothing is saved yet, so the draft is sent with the question; otherwise
      // the assistant would only see the empty stored profile.
      const draft = [
        `Headline: ${headline || '(none)'}`,
        isBusiness ? '' : `${isAlumni ? 'Field of work' : 'Programme'}: ${(isAlumni ? fieldOfWork : programme) || '(none)'}`,
        `Campus: ${campus}`,
        `Skills: ${skillList.join(', ') || '(none)'}`,
        `Summary: ${summary || '(none)'}`,
        `LinkedIn: ${linkedInUrl ? 'added' : '(none)'}`,
      ].filter(Boolean).join('\n');
      const answer = await sendProfileAssistantMessage(
        source.uid,
        `I'm finishing onboarding. This is my draft profile, not yet saved:\n${draft}\n\nGive me the three highest-impact improvements to make before I publish it. Be specific to my draft and keep it brief.`,
        [],
      );
      setAssistantFeedback(answer.content);
    } catch (e) {
      setAssistantFeedback(e instanceof Error ? e.message : 'The profile assistant is unavailable right now.');
    } finally {
      setAssistantLoading(false);
    }
  };

  const finish = async () => {
    if (!source) return;
    // Carry every existing field through: this patch replaces the stored profile,
    // so omitting a list here would wipe it.
    const patch: EditablePortfolioProfile = {
      displayName: source.displayName,
      headline: headline.trim(),
      summary: summary.trim(),
      campusLocation: campus,
      studentNumber: source.studentNumber,
      programmeOfStudy: isAlumni ? (source.programmeOfStudy ?? '') : programme.trim(),
      fieldOfWork: isAlumni ? fieldOfWork.trim() : (source.fieldOfWork ?? ''),
      yearOfEnrolment: yearOfEnrolment ? Number(yearOfEnrolment) : source.yearOfEnrolment,
      graduationYear: source.graduationYear,
      skills: skillList,
      qualifications: source.qualifications ?? [],
      certifications: source.certifications ?? [],
      workExperience: source.workExperience ?? [],
      entrepreneurialExperience: source.entrepreneurialExperience ?? [],
      gitHubProjects: source.gitHubProjects ?? [],
      deployedProjects: source.deployedProjects ?? [],
      digitalBadges: source.digitalBadges ?? [],
      achievements: source.achievements ?? [],
      leadershipRoles: source.leadershipRoles ?? [],
      activities: source.activities ?? [],
      careerInterests: source.careerInterests ?? [],
      careerAspirations: source.careerAspirations ?? '',
      gitHubUrl: source.gitHubUrl ?? '',
      linkedInUrl: linkedInUrl.trim(),
      portfolioUrl: source.portfolioUrl ?? '',
      credlyUrl: source.credlyUrl ?? '',
      avatarUrl: source.avatarUrl ?? '',
      resumeUrl: source.resumeUrl ?? '',
      companyName: source.companyName ?? '',
      industry: source.industry ?? '',
      companyDescription: source.companyDescription ?? '',
      companyLocation: source.companyLocation ?? '',
      companyWebsite: source.companyWebsite ?? '',
      talentSought: source.talentSought ?? '',
      visibility: source.visibility ? normaliseVisibility(source.visibility) : defaultVisibility(),
    };

    setSaving(true); setError('');
    try {
      await savePortfolio(source.uid, patch);
      await completeOnboarding();
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete onboarding. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.body}>
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Step {step + 1} of {steps.length}</Text>
          <ProgressBar progress={(step + 1) / steps.length} style={styles.progress} />

          <View style={styles.heading}>
            <Avatar.Icon size={44} icon={current.icon} />
            <Text variant="headlineSmall" style={styles.title}>{current.title}</Text>
          </View>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 21 }}>{current.hint}</Text>

          {step === 0 && (
            <TextInput mode="outlined" label="Professional headline" value={headline} onChangeText={setHeadline} placeholder="e.g. Software Engineering Student | React Native" />
          )}

          {step === 1 && (
            <View style={styles.group}>
              {isBusiness ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Your company details are already on file. You can refine them from your portfolio at any time.</Text>
              ) : (
                <>
                  <TextInput
                    mode="outlined"
                    label={isAlumni ? 'Current field of work' : 'Programme of study'}
                    value={isAlumni ? fieldOfWork : programme}
                    onChangeText={isAlumni ? setFieldOfWork : setProgramme}
                    placeholder={isAlumni ? 'e.g. Financial services engineering' : 'e.g. BSc Information Technology'}
                  />
                  {!isAlumni && (
                    <TextInput mode="outlined" label="Year of enrolment" value={yearOfEnrolment} onChangeText={(v) => setYearOfEnrolment(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="2024" />
                  )}
                </>
              )}
              <Text variant="labelLarge">Campus</Text>
              <View style={styles.chips}>
                {CAMPUS_LOCATIONS.map((option) => (
                  <Chip key={option} selected={campus === option} onPress={() => setCampus(option)}>{option}</Chip>
                ))}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.group}>
              <TextInput mode="outlined" label="Skills (comma separated)" value={skills} onChangeText={setSkills} placeholder="React Native, TypeScript, Firebase" autoCapitalize="none" />
              {skillList.length ? (
                <View style={styles.chips}>{skillList.map((skill) => <Chip key={skill} compact icon="check">{skill}</Chip>)}</View>
              ) : null}
              <HelperText type={skillList.length >= 3 ? 'info' : 'error'} visible={skills.length > 0}>
                {skillList.length >= 3 ? `${skillList.length} skills — great.` : `Add ${3 - skillList.length} more to appear in employer searches.`}
              </HelperText>
            </View>
          )}

          {step === 3 && (
            <View style={styles.group}>
              <TextInput mode="outlined" label="Professional summary" value={summary} onChangeText={setSummary} multiline numberOfLines={5} placeholder="Write a concise professional summary…" />
              <TextInput mode="outlined" label="LinkedIn profile" value={linkedInUrl} onChangeText={setLinkedInUrl} placeholder="https://linkedin.com/in/…" autoCapitalize="none" left={<TextInput.Icon icon="linkedin" />} />
            </View>
          )}

          {step === 4 && (
            <View>
              <ReviewRow label="Headline" icon="account-tie-outline" value={headline} />
              {!isBusiness && <ReviewRow label={isAlumni ? 'Field of work' : 'Programme'} icon="school-outline" value={isAlumni ? fieldOfWork : programme} />}
              <ReviewRow label="Campus" icon="map-marker-outline" value={campus} />
              <ReviewRow label="Skills" icon="lightning-bolt-outline" value={skillList.join(', ')} />
              <ReviewRow label="Summary" icon="text" value={summary ? 'Added' : ''} />
              <ReviewRow label="LinkedIn" icon="linkedin" value={linkedInUrl ? 'Added' : ''} />
            </View>
          )}

          {step >= 3 && (
            <Card mode="contained" style={{ backgroundColor: theme.colors.secondaryContainer }}>
              <Card.Title
                title="AI profile coach"
                subtitle="Feedback on your draft before you finish"
                left={(props) => <Avatar.Icon {...props} icon="robot-happy-outline" style={{ backgroundColor: theme.colors.secondary }} />}
              />
              <Card.Content style={styles.group}>
                {assistantFeedback ? <Text variant="bodyMedium" style={{ lineHeight: 21 }}>{assistantFeedback}</Text> : null}
                <Button mode="contained-tonal" icon="creation" loading={assistantLoading} disabled={assistantLoading} onPress={() => void askAssistant()} style={styles.coachButton}>
                  {assistantFeedback ? 'Ask again' : 'Ask AI for feedback'}
                </Button>
              </Card.Content>
            </Card>
          )}

          {error ? <HelperText type="error">{error}</HelperText> : null}
        </Card.Content>
        <Divider />
        <Card.Actions style={styles.actions}>
          {step > 0 ? <Button onPress={() => setStep(step - 1)}>Back</Button> : null}
          {step < steps.length - 1 ? (
            <Button mode="contained" icon="arrow-right" contentStyle={styles.reverse} onPress={() => setStep(step + 1)}>Continue</Button>
          ) : (
            <Button mode="contained" icon="check" loading={saving} disabled={saving} onPress={() => void finish()}>Finish onboarding</Button>
          )}
        </Card.Actions>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 560 },
  body: { gap: 12, paddingTop: 8 },
  progress: { height: 6, borderRadius: 3 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  title: { flex: 1, fontWeight: '700' },
  group: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reviewRow: { paddingVertical: 0 },
  coachButton: { alignSelf: 'flex-start' },
  actions: { padding: 12 },
  reverse: { flexDirection: 'row-reverse' },
});
