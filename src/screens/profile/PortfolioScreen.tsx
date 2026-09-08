import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { savePortfolio, extractCvFromText } from '../../profile/profileService';
import type { EditablePortfolioProfile, PortfolioProfile, VisibilityLevel } from '../../types/portfolio';

const CAMPUSES: PortfolioProfile['campusLocation'][] = ['Durban', 'Johannesburg', 'Cape Town', 'Pretoria', 'Distance Learning'];

function splitSkills(value: string): string[] {
  return Array.from(new Set(value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

export function PortfolioScreen() {
  const { firebaseUser, profile } = useAuth();
  const source = profile as PortfolioProfile | null;
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [cvText, setCvText] = useState('');
  const [form, setForm] = useState<EditablePortfolioProfile>(() => ({
    displayName: source?.displayName ?? '',
    headline: source?.headline ?? '',
    summary: source?.summary ?? '',
    campusLocation: source?.campusLocation ?? 'Distance Learning',
    studentNumber: source?.studentNumber,
    companyName: source?.companyName,
    industry: source?.industry,
    skills: source?.skills ?? [],
    qualifications: source?.qualifications ?? [],
    workExperience: source?.workExperience ?? [],
    gitHubUrl: source?.gitHubUrl,
    linkedInUrl: source?.linkedInUrl,
    portfolioUrl: source?.portfolioUrl,
    avatarUrl: source?.avatarUrl ?? '',
    resumeUrl: source?.resumeUrl,
    visibility: source?.visibility ?? { skills: 'public', experience: 'connections', contactInfo: 'connections', academicRecords: 'connections' },
  }));

  const skillsText = useMemo(() => form.skills.join(', '), [form.skills]);
  const setField = <K extends keyof EditablePortfolioProfile>(key: K, value: EditablePortfolioProfile[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setVisibility = (field: keyof EditablePortfolioProfile['visibility'], value: VisibilityLevel) => setForm((current) => ({ ...current, visibility: { ...current.visibility, [field]: value } }));

  const save = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await savePortfolio(firebaseUser.uid, form);
      Alert.alert('Profile saved', 'Your portfolio changes are live.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const analyseCv = async () => {
    setExtracting(true);
    try {
      const result = await extractCvFromText(cvText);
      setForm((current) => ({
        ...current,
        headline: result.headline || current.headline,
        summary: result.summary || current.summary,
        skills: result.skills.length ? result.skills : current.skills,
        qualifications: result.qualifications.length ? result.qualifications : current.qualifications,
        workExperience: result.workExperience.length ? result.workExperience : current.workExperience,
      }));
      Alert.alert('CV analysed', `The assistant extracted profile suggestions with ${Math.round(result.confidence * 100)}% extraction confidence. Review everything before saving.`);
    } catch (error) {
      Alert.alert('CV analysis failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  if (!source) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Professional Portfolio</Text>
      <Text style={styles.subtitle}>Build the profile recruiters see. AI suggestions are always editable before publication.</Text>

      <Field label="Full name" value={form.displayName} onChangeText={(v) => setField('displayName', v)} />
      <Field label="Professional headline" value={form.headline} onChangeText={(v) => setField('headline', v)} placeholder="e.g. Junior Network Engineer | Cloud & Security" />
      <Field label="Professional summary" value={form.summary} onChangeText={(v) => setField('summary', v)} multiline placeholder="What can you contribute? What are you building toward?" />
      <Field label="Skills (comma separated)" value={skillsText} onChangeText={(v) => setField('skills', splitSkills(v))} />
      <Field label="GitHub URL" value={form.gitHubUrl ?? ''} onChangeText={(v) => setField('gitHubUrl', v)} autoCapitalize="none" />
      <Field label="LinkedIn URL" value={form.linkedInUrl ?? ''} onChangeText={(v) => setField('linkedInUrl', v)} autoCapitalize="none" />
      <Field label="Portfolio URL" value={form.portfolioUrl ?? ''} onChangeText={(v) => setField('portfolioUrl', v)} autoCapitalize="none" />

      <Text style={styles.section}>Campus</Text>
      <View style={styles.chips}>{CAMPUSES.map((campus) => <Button key={campus} title={campus} onPress={() => setField('campusLocation', campus)} disabled={form.campusLocation === campus} />)}</View>

      <Text style={styles.section}>Profile visibility</Text>
      <VisibilityRow label="Skills" value={form.visibility.skills} onChange={(value) => setVisibility('skills', value)} />
      <VisibilityRow label="Experience" value={form.visibility.experience} onChange={(value) => setVisibility('experience', value)} />
      <VisibilityRow label="Contact information" value={form.visibility.contactInfo} onChange={(value) => setVisibility('contactInfo', value)} />
      <VisibilityRow label="Academic records" value={form.visibility.academicRecords} onChange={(value) => setVisibility('academicRecords', value)} />

      <Text style={styles.section}>CV → portfolio extraction</Text>
      <Text style={styles.help}>Paste CV text here. The secure Cloud Function extracts skills, qualifications, experience, headline and summary. It does not automatically publish anything.</Text>
      <TextInput value={cvText} onChangeText={setCvText} multiline style={[styles.input, styles.cv]} placeholder="Paste your CV text..." />
      <Button title={extracting ? 'Analysing…' : 'Analyse CV with AI'} onPress={analyseCv} disabled={extracting || cvText.trim().length < 80} />

      <View style={styles.save}><Button title={saving ? 'Saving…' : 'Save Portfolio'} onPress={save} disabled={saving} /></View>
    </ScrollView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} style={[styles.input, props.multiline ? styles.multiline : undefined]} /></View>;
}

function VisibilityRow({ label, value, onChange }: { label: string; value: VisibilityLevel; onChange: (value: VisibilityLevel) => void }) {
  const levels: VisibilityLevel[] = ['public', 'connections', 'private'];
  const next = levels[(levels.indexOf(value) + 1) % levels.length];
  return <View style={styles.visibilityRow}><View><Text style={styles.label}>{label}</Text><Text style={styles.help}>{value}</Text></View><Switch value={value === 'public'} onValueChange={() => onChange(next)} /></View>;
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 }, title: { fontSize: 28, fontWeight: '800' }, subtitle: { color: '#5b6470', marginBottom: 8 },
  field: { gap: 6 }, label: { fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#cbd2d9', borderRadius: 10, padding: 12, backgroundColor: '#fff' }, multiline: { minHeight: 120, textAlignVertical: 'top' }, cv: { minHeight: 180, textAlignVertical: 'top' }, section: { fontSize: 18, fontWeight: '800', marginTop: 12 }, help: { color: '#66717d', fontSize: 13 }, chips: { gap: 6 }, visibilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }, save: { marginTop: 12, marginBottom: 24 },
});
