import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, HelperText, List, ProgressBar, Snackbar, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import { savePortfolio, extractCvFromText } from '../../profile/profileService';
import { ListEditor } from '../../components/ListEditor';
import { VisibilityEditor } from '../../components/VisibilityEditor';
import {
  ACTIVITY_TYPES,
  CAMPUS_LOCATIONS,
  defaultVisibility,
  normaliseVisibility,
} from '../../types/portfolio';
import type {
  Achievement, Activity, CampusLocation, Certification, DigitalBadge,
  EditablePortfolioProfile, LeadershipRole, PortfolioProfile, ProjectLink,
  Qualification, VentureExperience, WorkExperience,
} from '../../types/portfolio';

type SectionKey = 'identity' | 'skills' | 'experience' | 'academic' | 'projects' | 'activities' | 'links' | 'company' | 'cv' | 'visibility';

const csv = (value: string) => Array.from(new Set(value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)));

// Section and field components live at module scope: defining them inside the
// screen would give them a new identity every render, remounting each input and
// dropping focus after every keystroke.

function Section({ id, title, hint, icon, open, onToggle, children }: {
  id: SectionKey; title: string; hint?: string; icon: string;
  open: SectionKey | null; onToggle: (id: SectionKey) => void; children: React.ReactNode;
}) {
  const theme = useTheme();
  const expanded = open === id;
  return (
    <Card mode="outlined" style={styles.section}>
      <List.Item
        title={title}
        titleStyle={styles.sectionTitle}
        description={hint}
        onPress={() => onToggle(id)}
        left={(props) => <List.Icon {...props} icon={icon} color={theme.colors.primary} />}
        right={(props) => <List.Icon {...props} icon={expanded ? 'chevron-up' : 'chevron-down'} />}
      />
      {expanded ? (
        <>
          <Divider />
          <Card.Content style={styles.sectionBody}>{children}</Card.Content>
        </>
      ) : null}
    </Card>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, numeric }: {
  label: string; value?: string | number; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; numeric?: boolean;
}) {
  return (
    <TextInput
      mode="outlined"
      label={label}
      style={styles.field}
      value={value === undefined || value === null ? '' : String(value)}
      onChangeText={(v) => onChangeText(numeric ? v.replace(/[^0-9]/g, '') : v)}
      placeholder={placeholder}
      multiline={multiline}
      numberOfLines={multiline ? 4 : undefined}
      keyboardType={numeric ? 'number-pad' : 'default'}
      autoCapitalize={placeholder?.startsWith('http') ? 'none' : 'sentences'}
    />
  );
}

/** Keeps the raw text while typing so commas and spaces survive; the parsed list is sent up. */
function CsvField({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) {
  const [text, setText] = useState(values.join(', '));
  return (
    <>
      <TextInput
        mode="outlined"
        label={label}
        style={styles.field}
        value={text}
        placeholder={placeholder}
        autoCapitalize="none"
        onChangeText={(next) => { setText(next); onChange(csv(next)); }}
        onBlur={() => setText(csv(text).join(', '))}
      />
      {values.length ? (
        <View style={[styles.chips, styles.csvChips]}>
          {values.map((value) => <Chip key={value} compact>{value}</Chip>)}
        </View>
      ) : null}
    </>
  );
}

/** Rough completeness, mirroring what employers and matching rely on most. */
function strength(form: EditablePortfolioProfile): { score: number; missing: string[] } {
  const checks: Array<[boolean, string]> = [
    [Boolean(form.headline?.trim()), 'headline'],
    [(form.summary?.trim().length ?? 0) >= 60, 'summary'],
    [form.skills.length >= 3, 'three skills'],
    [Boolean(form.programmeOfStudy?.trim() || form.fieldOfWork?.trim()), 'programme'],
    [form.workExperience.length + form.entrepreneurialExperience.length > 0, 'experience'],
    [form.gitHubProjects.length + form.deployedProjects.length > 0, 'a project'],
    [form.qualifications.length + form.certifications.length > 0, 'a qualification'],
    [Boolean(form.linkedInUrl?.trim() || form.gitHubUrl?.trim()), 'a profile link'],
  ];
  return {
    score: checks.filter(([ok]) => ok).length / checks.length,
    missing: checks.filter(([ok]) => !ok).map(([, label]) => label),
  };
}

export function PortfolioScreen() {
  const { firebaseUser, profile } = useAuth();
  const theme = useTheme();
  const source = profile as unknown as PortfolioProfile | null;
  const isBusiness = source?.role === 'business';
  const isAlumni = source?.role === 'alumni';

  const [open, setOpen] = useState<SectionKey | null>('identity');
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [cvText, setCvText] = useState('');
  const [cvError, setCvError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [cvVersion, setCvVersion] = useState(0);

  const [form, setForm] = useState<EditablePortfolioProfile>(() => ({
    displayName: source?.displayName ?? '',
    headline: source?.headline ?? '',
    summary: source?.summary ?? '',
    campusLocation: source?.campusLocation ?? 'Distance Learning',
    studentNumber: source?.studentNumber,
    programmeOfStudy: source?.programmeOfStudy ?? '',
    fieldOfWork: source?.fieldOfWork ?? '',
    yearOfEnrolment: source?.yearOfEnrolment,
    graduationYear: source?.graduationYear,
    skills: source?.skills ?? [],
    qualifications: source?.qualifications ?? [],
    certifications: source?.certifications ?? [],
    workExperience: source?.workExperience ?? [],
    entrepreneurialExperience: source?.entrepreneurialExperience ?? [],
    gitHubProjects: source?.gitHubProjects ?? [],
    deployedProjects: source?.deployedProjects ?? [],
    digitalBadges: source?.digitalBadges ?? [],
    achievements: source?.achievements ?? [],
    leadershipRoles: source?.leadershipRoles ?? [],
    activities: source?.activities ?? [],
    careerInterests: source?.careerInterests ?? [],
    careerAspirations: source?.careerAspirations ?? '',
    gitHubUrl: source?.gitHubUrl ?? '',
    linkedInUrl: source?.linkedInUrl ?? '',
    portfolioUrl: source?.portfolioUrl ?? '',
    credlyUrl: source?.credlyUrl ?? '',
    avatarUrl: source?.avatarUrl ?? '',
    resumeUrl: source?.resumeUrl ?? '',
    companyName: source?.companyName ?? '',
    industry: source?.industry ?? '',
    companyDescription: source?.companyDescription ?? '',
    companyLocation: source?.companyLocation ?? '',
    companyWebsite: source?.companyWebsite ?? '',
    talentSought: source?.talentSought ?? '',
    visibility: source?.visibility ? normaliseVisibility(source.visibility) : defaultVisibility(),
  }));

  const set = <K extends keyof EditablePortfolioProfile>(key: K, value: EditablePortfolioProfile[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const toggle = (id: SectionKey) => setOpen((current) => (current === id ? null : id));
  const sectionProps = { open, onToggle: toggle };
  const { score, missing } = strength(form);

  const save = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await savePortfolio(firebaseUser.uid, form);
      setDirty(false);
      setNotice('Profile saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const analyseCv = async () => {
    setExtracting(true); setCvError('');
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
      setDirty(true);
      setCvVersion((v) => v + 1);
      setNotice(`CV analysed with ${(result.confidence * 100).toFixed(0)}% confidence. Review the fields, then save.`);
      setOpen('identity');
    } catch (error) {
      setCvError(error instanceof Error ? error.message : 'Could not analyse this CV. Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="headlineSmall" style={styles.title}>Your portfolio</Text>
        <Text variant="bodyMedium" style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>
          This is what employers and fellow members see. You control who sees every section.
        </Text>

        {!isBusiness ? (
          <Card mode="contained" style={[styles.strength, { backgroundColor: theme.colors.primaryContainer }]}>
            <Card.Content>
              <View style={styles.strengthHead}>
                <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>Profile strength</Text>
                <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>{Math.round(score * 100)}%</Text>
              </View>
              <ProgressBar progress={score} style={styles.strengthBar} />
              <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                {missing.length ? `Add ${missing.slice(0, 3).join(', ')} to stand out in employer matching.` : 'Complete — you appear strongly in matching and searches.'}
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        <Section id="cv" icon="file-document-edit-outline" title="Build from your CV" hint="Paste your CV and let the AI extract the structure" {...sectionProps}>
          <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
            Paste the text of your CV. The assistant extracts your headline, summary, skills, qualifications and
            experience. It never invents anything, and nothing is saved until you press Save.
          </Text>
          <TextInput
            mode="outlined"
            label="CV text"
            style={[styles.field, styles.cvInput]}
            value={cvText}
            onChangeText={setCvText}
            multiline
            placeholder="Paste your CV text here (at least 80 characters)…"
          />
          {cvError ? <HelperText type="error">{cvError}</HelperText> : null}
          <Button mode="contained-tonal" icon="creation" loading={extracting} disabled={extracting || cvText.trim().length < 80} onPress={() => void analyseCv()}>
            Analyse CV with AI
          </Button>
        </Section>

        <Section id="identity" icon="account-outline" title="Professional identity" hint="Name, headline, summary and programme" {...sectionProps}>
          <View key={cvVersion}>
            <Field label="Full name" value={form.displayName} onChangeText={(v) => set('displayName', v)} />
            <Field label="Professional headline" value={form.headline} placeholder="e.g. Final-year IT student | React Native" onChangeText={(v) => set('headline', v)} />
            <Field label="Professional summary" value={form.summary} multiline placeholder="A short paragraph on who you are and where you're heading." onChangeText={(v) => set('summary', v)} />
            <Field label="Profile photograph URL" value={form.avatarUrl} placeholder="https://…" onChangeText={(v) => set('avatarUrl', v)} />
          </View>

          <Text variant="labelLarge" style={styles.label}>Campus</Text>
          <View style={[styles.chips, styles.block]}>
            {CAMPUS_LOCATIONS.map((campus) => (
              <Chip key={campus} selected={form.campusLocation === campus} onPress={() => set('campusLocation', campus as CampusLocation)}>{campus}</Chip>
            ))}
          </View>

          {isAlumni
            ? <Field label="Current field of work" value={form.fieldOfWork} placeholder="e.g. Financial services engineering" onChangeText={(v) => set('fieldOfWork', v)} />
            : <Field label="Programme of study" value={form.programmeOfStudy} placeholder="e.g. BSc Information Technology" onChangeText={(v) => set('programmeOfStudy', v)} />}
          <HelperText type="info" style={styles.info}>Your programme drives opportunity matching and how you appear in alumni career pathways.</HelperText>

          <View style={styles.pair}>
            <View style={styles.pairItem}><Field label="Year of enrolment" numeric value={form.yearOfEnrolment} onChangeText={(v) => set('yearOfEnrolment', v ? Number(v) : undefined)} /></View>
            <View style={styles.pairItem}><Field label="Graduation year" numeric value={form.graduationYear} onChangeText={(v) => set('graduationYear', v ? Number(v) : undefined)} /></View>
          </View>
        </Section>

        <Section id="skills" icon="lightning-bolt-outline" title="Skills and career direction" hint="What you can do, and where you want to go" {...sectionProps}>
          <CsvField key={`skills-${cvVersion}`} label="Skills (comma separated)" values={form.skills} placeholder="react native, typescript, firebase" onChange={(v) => set('skills', v)} />
          <CsvField label="Career interests (comma separated)" values={form.careerInterests ?? []} placeholder="mobile engineering, fintech, devops" onChange={(v) => set('careerInterests', v)} />
          <Field label="Career aspirations" value={form.careerAspirations} multiline placeholder="What are you working towards?" onChangeText={(v) => set('careerAspirations', v)} />
        </Section>

        <Section id="experience" icon="briefcase-outline" title="Experience" hint="Employment, internships and ventures" {...sectionProps}>
          <ListEditor<WorkExperience>
            title="Work experience, internships and placements"
            items={form.workExperience}
            onChange={(next) => set('workExperience', next)}
            blank={() => ({ company: '', role: '', startDate: '', endDate: '', description: '' })}
            addLabel="Add experience"
            fields={[
              { key: 'company', label: 'Organisation', half: true },
              { key: 'role', label: 'Role', half: true },
              { key: 'startDate', label: 'Start (YYYY-MM)', placeholder: '2025-01', half: true },
              { key: 'endDate', label: 'End (blank if current)', placeholder: '2026-06', half: true },
              { key: 'description', label: 'What you did', multiline: true },
            ]}
          />
          <ListEditor<VentureExperience>
            title="Entrepreneurial experience"
            description="Businesses founded, start-ups, freelance work, innovations and ventures."
            items={form.entrepreneurialExperience}
            onChange={(next) => set('entrepreneurialExperience', next)}
            blank={() => ({ name: '', role: '', description: '', startYear: new Date().getFullYear() })}
            addLabel="Add venture"
            fields={[
              { key: 'name', label: 'Venture name', half: true },
              { key: 'role', label: 'Your role', half: true },
              { key: 'startYear', label: 'Start year', numeric: true, half: true },
              { key: 'endYear', label: 'End year', numeric: true, half: true },
              { key: 'url', label: 'Website (optional)', placeholder: 'https://…' },
              { key: 'description', label: 'What it does', multiline: true },
            ]}
          />
        </Section>

        <Section id="academic" icon="school-outline" title="Academic record" hint="Qualifications, certifications, awards" {...sectionProps}>
          <ListEditor<Qualification>
            title="Qualifications"
            items={form.qualifications}
            onChange={(next) => set('qualifications', next)}
            blank={() => ({ title: '', institution: '', yearCompleted: new Date().getFullYear() })}
            addLabel="Add qualification"
            fields={[
              { key: 'title', label: 'Qualification' },
              { key: 'institution', label: 'Institution', half: true },
              { key: 'yearCompleted', label: 'Year completed', numeric: true, half: true },
            ]}
          />
          <ListEditor<Certification>
            title="Professional certifications"
            items={form.certifications}
            onChange={(next) => set('certifications', next)}
            blank={() => ({ name: '', issuer: '', year: new Date().getFullYear() })}
            addLabel="Add certification"
            fields={[
              { key: 'name', label: 'Certification' },
              { key: 'issuer', label: 'Issuer', half: true },
              { key: 'year', label: 'Year', numeric: true, half: true },
              { key: 'credentialUrl', label: 'Credential URL (optional)', placeholder: 'https://…' },
            ]}
          />
          <ListEditor<Achievement>
            title="Achievements, scholarships and awards"
            items={form.achievements}
            onChange={(next) => set('achievements', next)}
            blank={() => ({ title: '', year: new Date().getFullYear() })}
            addLabel="Add achievement"
            fields={[
              { key: 'title', label: 'Achievement' },
              { key: 'issuer', label: 'Awarded by', half: true },
              { key: 'year', label: 'Year', numeric: true, half: true },
              { key: 'description', label: 'Detail (optional)', multiline: true },
            ]}
          />
        </Section>

        <Section id="projects" icon="code-braces" title="Projects and badges" hint="Repositories, live apps, digital badges" {...sectionProps}>
          <ListEditor<ProjectLink>
            title="GitHub projects"
            description="Link each repository you want employers to look at."
            items={form.gitHubProjects}
            onChange={(next) => set('gitHubProjects', next)}
            blank={() => ({ name: '', url: '' })}
            max={30}
            addLabel="Add repository"
            fields={[
              { key: 'name', label: 'Project name', half: true },
              { key: 'url', label: 'Repository URL', placeholder: 'https://github.com/…', half: true },
              { key: 'description', label: 'What it does (optional)', multiline: true },
            ]}
          />
          <ListEditor<ProjectLink>
            title="Websites and applications"
            description="Anything you have deployed, with a live URL."
            items={form.deployedProjects}
            onChange={(next) => set('deployedProjects', next)}
            blank={() => ({ name: '', url: '' })}
            max={30}
            addLabel="Add application"
            fields={[
              { key: 'name', label: 'Name', half: true },
              { key: 'url', label: 'Live URL', placeholder: 'https://…', half: true },
              { key: 'description', label: 'What it does (optional)', multiline: true },
            ]}
          />
          <ListEditor<DigitalBadge>
            title="Digital badges"
            items={form.digitalBadges}
            onChange={(next) => set('digitalBadges', next)}
            blank={() => ({ name: '', issuer: '' })}
            max={30}
            addLabel="Add badge"
            fields={[
              { key: 'name', label: 'Badge', half: true },
              { key: 'issuer', label: 'Issuer', half: true },
              { key: 'issuedYear', label: 'Year', numeric: true, half: true },
              { key: 'url', label: 'Badge URL', placeholder: 'https://…', half: true },
            ]}
          />
          <Field label="Credly profile" value={form.credlyUrl} placeholder="https://credly.com/users/…" onChangeText={(v) => set('credlyUrl', v)} />
        </Section>

        <Section id="activities" icon="account-group-outline" title="Leadership and activities" hint="SRC, societies, hackathons, volunteering" {...sectionProps}>
          <ListEditor<LeadershipRole>
            title="Leadership roles"
            description="SRC, class representative, mentor, student ambassador and similar."
            items={form.leadershipRoles}
            onChange={(next) => set('leadershipRoles', next)}
            blank={() => ({ role: '', organisation: '', startYear: new Date().getFullYear() })}
            addLabel="Add leadership role"
            fields={[
              { key: 'role', label: 'Role', half: true },
              { key: 'organisation', label: 'Organisation', half: true },
              { key: 'startYear', label: 'From', numeric: true, half: true },
              { key: 'endYear', label: 'To', numeric: true, half: true },
              { key: 'description', label: 'Detail (optional)', multiline: true },
            ]}
          />
          <ListEditor<Activity>
            title="Clubs, societies and competitions"
            description="Hackathons, innovation challenges, entrepreneurship hubs, volunteering and community work."
            items={form.activities}
            onChange={(next) => set('activities', next)}
            blank={() => ({ name: '', type: 'club' })}
            max={30}
            addLabel="Add activity"
            fields={[
              { key: 'name', label: 'Name' },
              { key: 'type', label: 'Type', options: ACTIVITY_TYPES },
              { key: 'year', label: 'Year', numeric: true, half: true },
              { key: 'description', label: 'Detail (optional)', multiline: true },
            ]}
          />
        </Section>

        <Section id="links" icon="link-variant" title="Links and CV" hint="GitHub, LinkedIn, portfolio, CV" {...sectionProps}>
          <Field label="GitHub profile" value={form.gitHubUrl} placeholder="https://github.com/…" onChangeText={(v) => set('gitHubUrl', v)} />
          <Field label="LinkedIn profile" value={form.linkedInUrl} placeholder="https://linkedin.com/in/…" onChangeText={(v) => set('linkedInUrl', v)} />
          <Field label="Personal website or portfolio" value={form.portfolioUrl} placeholder="https://…" onChangeText={(v) => set('portfolioUrl', v)} />
          <Field label="CV link" value={form.resumeUrl} placeholder="https://…" onChangeText={(v) => set('resumeUrl', v)} />
        </Section>

        {isBusiness ? (
          <Section id="company" icon="domain" title="Company profile" hint="What your organisation does and who you're hiring" {...sectionProps}>
            <Field label="Organisation name" value={form.companyName} onChangeText={(v) => set('companyName', v)} />
            <Field label="Industry" value={form.industry} onChangeText={(v) => set('industry', v)} />
            <Field label="Company description" value={form.companyDescription} multiline onChangeText={(v) => set('companyDescription', v)} />
            <Field label="Location" value={form.companyLocation} onChangeText={(v) => set('companyLocation', v)} />
            <Field label="Website" value={form.companyWebsite} placeholder="https://…" onChangeText={(v) => set('companyWebsite', v)} />
            <Field label="Graduates, skills or talent you are seeking" value={form.talentSought} multiline onChangeText={(v) => set('talentSought', v)} />
          </Section>
        ) : null}

        <Section id="visibility" icon="shield-lock-outline" title="Who can see what" hint="Per-section privacy controls" {...sectionProps}>
          <VisibilityEditor visibility={form.visibility} onChange={(next) => set('visibility', next)} />
        </Section>
      </ScrollView>

      <Surface elevation={3} style={[styles.saveBar, { backgroundColor: theme.colors.surface }]}>
        <Text variant="bodySmall" style={[styles.saveHint, { color: theme.colors.onSurfaceVariant }]}>
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </Text>
        <Button mode="contained" icon="content-save-outline" loading={saving} disabled={saving || !dirty} onPress={() => void save()}>
          Save profile
        </Button>
      </Surface>

      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={4000}>{notice}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 96, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontWeight: '700' },
  sub: { marginBottom: 14, lineHeight: 20 },
  strength: { marginBottom: 12 },
  strengthHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  strengthBar: { marginBottom: 8, height: 6, borderRadius: 3 },
  section: { marginBottom: 10, overflow: 'hidden' },
  sectionTitle: { fontWeight: '600' },
  sectionBody: { paddingTop: 14, paddingBottom: 16 },
  field: { marginBottom: 10 },
  cvInput: { minHeight: 150 },
  label: { marginTop: 4, marginBottom: 6 },
  helper: { lineHeight: 18, marginBottom: 10 },
  info: { marginTop: -6, marginBottom: 6, paddingHorizontal: 0 },
  pair: { flexDirection: 'row', gap: 10 },
  pairItem: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  block: { marginBottom: 12 },
  csvChips: { marginTop: -4, marginBottom: 12 },
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  saveHint: { flex: 1, textAlign: 'right' },
});
