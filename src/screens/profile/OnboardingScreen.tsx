import React, { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { notify } from '../../ui/alert';
import { completeOnboarding, savePortfolio, sendProfileAssistantMessage } from '../../profile/profileService';
import type { EditablePortfolioProfile, PortfolioProfile } from '../../types/portfolio';

const steps = [
  { title: 'Start with your professional identity', hint: 'Use a headline that says what you do and where you are going.' },
  { title: 'Tell employers what you can do', hint: 'Add three or more real skills you can demonstrate.' },
  { title: 'Show evidence', hint: 'Add a short summary and at least one portfolio, GitHub or LinkedIn link.' },
  { title: 'Review your profile', hint: 'You can change anything later. Nothing is published by the assistant without your approval.' },
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { profile } = useAuth();
  const source = profile as PortfolioProfile | null;
  const [step, setStep] = useState(0);
  const [headline, setHeadline] = useState(source?.headline ?? '');
  const [skills, setSkills] = useState(source?.skills?.join(', ') ?? '');
  const [summary, setSummary] = useState(source?.summary ?? '');
  const [saving, setSaving] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantFeedback, setAssistantFeedback] = useState('');

  const askAssistant = async () => {
    if (!source || assistantLoading) return;
    setAssistantLoading(true);
    try {
      const answer = await sendProfileAssistantMessage(source.uid, 'Review my current onboarding profile. Give me the three highest-impact improvements I should make before I publish it.', []);
      setAssistantFeedback(answer.content);
    } catch (error) {
      setAssistantFeedback(error instanceof Error ? error.message : 'The profile assistant is unavailable right now.');
    } finally {
      setAssistantLoading(false);
    }
  };

  const finish = async () => {
    if (!source) return;
    const patch: EditablePortfolioProfile = {
      displayName: source.displayName,
      headline: headline.trim(), summary: summary.trim(), campusLocation: source.campusLocation ?? 'Distance Learning',
      studentNumber: source.studentNumber, companyName: source.companyName, industry: source.industry,
      skills: skills.split(',').map((x) => x.trim()).filter(Boolean), qualifications: source.qualifications ?? [], workExperience: source.workExperience ?? [],
      gitHubUrl: source.gitHubUrl, linkedInUrl: source.linkedInUrl, portfolioUrl: source.portfolioUrl, avatarUrl: source.avatarUrl ?? '', resumeUrl: source.resumeUrl,
      visibility: source.visibility ?? { skills: 'public', experience: 'connections', contactInfo: 'connections', academicRecords: 'connections' },
    };
    setSaving(true);
    try {
      await savePortfolio(source.uid, patch);
      await completeOnboarding();
      onComplete();
    } catch (error) {
      notify('Could not complete onboarding', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  return <View style={styles.root}><View style={styles.card}><Text style={styles.step}>Step {step + 1} of {steps.length}</Text><Text style={styles.title}>{steps[step].title}</Text><Text style={styles.hint}>{steps[step].hint}</Text>
    {step === 0 && <TextInput style={styles.input} value={headline} onChangeText={setHeadline} placeholder="e.g. Software Engineering Student | React Native" />}
    {step === 1 && <TextInput style={styles.input} value={skills} onChangeText={setSkills} placeholder="React Native, TypeScript, Firebase" />}
    {step === 2 && <TextInput style={[styles.input, styles.multiline]} value={summary} onChangeText={setSummary} multiline placeholder="Write a concise professional summary…" />}
    {step === 3 && <View><Text>Headline: {headline || 'Not added'}</Text><Text>Skills: {skills || 'Not added'}</Text><Text>Summary: {summary ? 'Added' : 'Not added'}</Text></View>}
    {step >= 2 && <View style={styles.aiBox}><Text style={styles.aiTitle}>AI profile coach</Text><Text style={styles.hint}>Get contextual feedback before you finish onboarding.</Text><Button title={assistantLoading ? 'Thinking…' : 'Ask AI for feedback'} onPress={() => void askAssistant()} disabled={assistantLoading} />{assistantFeedback ? <Text style={styles.aiText}>{assistantFeedback}</Text> : null}</View>}
    <View style={styles.actions}>{step > 0 && <Button title="Back" onPress={() => setStep(step - 1)} />}{step < steps.length - 1 ? <Button title="Continue" onPress={() => setStep(step + 1)} /> : <Button title={saving ? 'Saving…' : 'Finish onboarding'} onPress={() => void finish()} disabled={saving} />}</View>
  </View></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f6f8fa' }, card: { backgroundColor: '#fff', borderRadius: 18, padding: 22, gap: 14, elevation: 2 }, step: { fontWeight: '700', color: '#66717d' }, title: { fontSize: 26, fontWeight: '800' }, hint: { color: '#66717d', lineHeight: 20 }, input: { borderWidth: 1, borderColor: '#cbd2d9', borderRadius: 10, padding: 12 }, multiline: { minHeight: 150, textAlignVertical: 'top' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, aiBox: { marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: '#f0f4f8', gap: 8 }, aiTitle: { fontWeight: '800' }, aiText: { lineHeight: 20 },
});
