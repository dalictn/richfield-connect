import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { notify } from '../../ui/alert';
import { completeOnboarding, savePortfolio, sendProfileAssistantMessage } from '../../profile/profileService';
import { CAMPUS_LOCATIONS, defaultVisibility, normaliseVisibility } from '../../types/portfolio';
import type { CampusLocation, EditablePortfolioProfile, PortfolioProfile } from '../../types/portfolio';

const steps = [
  { title: 'Start with your professional identity', hint: 'A headline says what you do and where you are going. It is the first thing an employer reads.' },
  { title: 'Where you study', hint: 'Your programme and campus decide which opportunities are matched to you and where you appear in alumni career pathways.' },
  { title: 'Tell employers what you can do', hint: 'Add three or more real skills you can demonstrate. Profiles with no skills do not appear in employer searches.' },
  { title: 'Show evidence', hint: 'A short summary plus at least one link. You can add projects, certifications and everything else from your portfolio afterwards.' },
  { title: 'Review', hint: 'You can change anything later, and you control who sees each section. Nothing is published by the assistant without your approval.' },
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { profile } = useAuth();
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
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantFeedback, setAssistantFeedback] = useState('');

  const askAssistant = async () => {
    if (!source || assistantLoading) return;
    setAssistantLoading(true);
    try {
      const answer = await sendProfileAssistantMessage(
        source.uid,
        'Review my current onboarding profile. Give me the three highest-impact improvements I should make before I publish it.',
        [],
      );
      setAssistantFeedback(answer.content);
    } catch (error) {
      setAssistantFeedback(error instanceof Error ? error.message : 'The profile assistant is unavailable right now.');
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
      skills: skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
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

    setSaving(true);
    try {
      await savePortfolio(source.uid, patch);
      await completeOnboarding();
      onComplete();
    } catch (error) {
      notify('Could not complete onboarding', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.step}>Step {step + 1} of {steps.length}</Text>
        <View style={styles.progress}>
          {steps.map((_, index) => <View key={index} style={[styles.bar, index <= step && styles.barOn]} />)}
        </View>
        <Text style={styles.title}>{steps[step].title}</Text>
        <Text style={styles.hint}>{steps[step].hint}</Text>

        {step === 0 && (
          <TextInput style={styles.input} value={headline} onChangeText={setHeadline} placeholder="e.g. Software Engineering Student | React Native" placeholderTextColor="#98a2b3" />
        )}

        {step === 1 && (
          <View>
            {isBusiness ? (
              <Text style={styles.hint}>Your company details are already on file. You can refine them from your portfolio at any time.</Text>
            ) : (
              <>
                <Text style={styles.label}>{isAlumni ? 'Current field of work' : 'Programme of study'}</Text>
                <TextInput
                  style={styles.input}
                  value={isAlumni ? fieldOfWork : programme}
                  onChangeText={isAlumni ? setFieldOfWork : setProgramme}
                  placeholder={isAlumni ? 'e.g. Financial services engineering' : 'e.g. BSc Information Technology'}
                  placeholderTextColor="#98a2b3"
                />
                {!isAlumni && (
                  <>
                    <Text style={styles.label}>Year of enrolment</Text>
                    <TextInput style={styles.input} value={yearOfEnrolment} onChangeText={(v) => setYearOfEnrolment(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="2024" placeholderTextColor="#98a2b3" />
                  </>
                )}
              </>
            )}
            <Text style={styles.label}>Campus</Text>
            <View style={styles.chips}>
              {CAMPUS_LOCATIONS.map((option) => {
                const active = campus === option;
                return (
                  <Pressable key={option} onPress={() => setCampus(option)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={active ? styles.chipActiveText : styles.chipText}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 2 && (
          <TextInput style={styles.input} value={skills} onChangeText={setSkills} placeholder="React Native, TypeScript, Firebase" placeholderTextColor="#98a2b3" />
        )}

        {step === 3 && (
          <View>
            <Text style={styles.label}>Professional summary</Text>
            <TextInput style={[styles.input, styles.multiline]} value={summary} onChangeText={setSummary} multiline placeholder="Write a concise professional summary…" placeholderTextColor="#98a2b3" />
            <Text style={styles.label}>LinkedIn profile</Text>
            <TextInput style={styles.input} value={linkedInUrl} onChangeText={setLinkedInUrl} placeholder="https://linkedin.com/in/…" placeholderTextColor="#98a2b3" autoCapitalize="none" />
          </View>
        )}

        {step === 4 && (
          <View style={styles.review}>
            <ReviewRow label="Headline" value={headline} />
            {!isBusiness && <ReviewRow label={isAlumni ? 'Field of work' : 'Programme'} value={isAlumni ? fieldOfWork : programme} />}
            <ReviewRow label="Campus" value={campus} />
            <ReviewRow label="Skills" value={skills} />
            <ReviewRow label="Summary" value={summary ? 'Added' : ''} />
            <ReviewRow label="LinkedIn" value={linkedInUrl ? 'Added' : ''} />
          </View>
        )}

        {step >= 3 && (
          <View style={styles.aiBox}>
            <Text style={styles.aiTitle}>AI profile coach</Text>
            <Text style={styles.hint}>Get contextual feedback before you finish.</Text>
            <Pressable onPress={() => void askAssistant()} disabled={assistantLoading} style={[styles.secondary, assistantLoading && styles.disabled]}>
              {assistantLoading ? <ActivityIndicator /> : <Text style={styles.secondaryText}>Ask AI for feedback</Text>}
            </Pressable>
            {assistantFeedback ? <Text style={styles.aiText}>{assistantFeedback}</Text> : null}
          </View>
        )}

        <View style={styles.actions}>
          {step > 0 && (
            <Pressable onPress={() => setStep(step - 1)} style={styles.secondary}><Text style={styles.secondaryText}>Back</Text></Pressable>
          )}
          {step < steps.length - 1 ? (
            <Pressable onPress={() => setStep(step + 1)} style={styles.primary}><Text style={styles.primaryText}>Continue</Text></Pressable>
          ) : (
            <Pressable onPress={() => void finish()} disabled={saving} style={[styles.primary, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Finish onboarding</Text>}
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={value ? styles.reviewValue : styles.reviewMissing}>{value || 'Not added'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8fa' },
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e4e7ec', padding: 22, gap: 10 },
  step: { fontWeight: '700', color: '#667085', fontSize: 12 },
  progress: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e4e7ec' },
  barOn: { backgroundColor: '#111827' },
  title: { fontSize: 24, fontWeight: '800' },
  hint: { color: '#667085', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#475467', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cbd2d9', borderRadius: 10, padding: 12, minHeight: 46 },
  multiline: { minHeight: 130, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#d0d5dd' },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 12 },
  chipActiveText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  review: { gap: 8, marginTop: 4 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f2f4f7' },
  reviewLabel: { fontWeight: '700', color: '#475467' },
  reviewValue: { flexShrink: 1, textAlign: 'right' },
  reviewMissing: { color: '#98a2b3', fontStyle: 'italic' },
  aiBox: { marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: '#f2f4f7', gap: 8 },
  aiTitle: { fontWeight: '800' },
  aiText: { lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  primary: { backgroundColor: '#111827', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, alignItems: 'center', minWidth: 120 },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: '#d0d5dd', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  secondaryText: { fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
