import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { notify } from '../../ui/alert';
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

export function PortfolioScreen() {
  const { firebaseUser, profile } = useAuth();
  const source = profile as unknown as PortfolioProfile | null;
  const isBusiness = source?.role === 'business';
  const isAlumni = source?.role === 'alumni';

  const [open, setOpen] = useState<SectionKey>('identity');
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [cvText, setCvText] = useState('');
  const [notice, setNotice] = useState('');

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

  const set = <K extends keyof EditablePortfolioProfile>(key: K, value: EditablePortfolioProfile[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const skillsText = useMemo(() => form.skills.join(', '), [form.skills]);
  const interestsText = useMemo(() => (form.careerInterests ?? []).join(', '), [form.careerInterests]);

  const save = async () => {
    if (!firebaseUser) return;
    setSaving(true); setNotice('');
    try {
      await savePortfolio(firebaseUser.uid, form);
      setNotice('Profile saved.');
    } catch (error) {
      notify('Could not save', error instanceof Error ? error.message : 'Please try again.');
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
      setNotice(`CV analysed with ${(result.confidence * 100).toFixed(0)}% confidence. Review the fields, then save.`);
    } catch (error) {
      notify('Could not analyse CV', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  const Section = ({ id, title, hint, children }: { id: SectionKey; title: string; hint?: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Pressable onPress={() => setOpen(open === id ? ('identity' as SectionKey) : id)} style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
        </View>
        <Text style={styles.caret}>{open === id ? '▾' : '▸'}</Text>
      </Pressable>
      {open === id ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );

  const Field = ({ label, value, onChangeText, placeholder, multiline, numeric }: {
    label: string; value?: string | number; onChangeText: (v: string) => void;
    placeholder?: string; multiline?: boolean; numeric?: boolean;
  }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value === undefined || value === null ? '' : String(value)}
        onChangeText={(v) => onChangeText(numeric ? v.replace(/[^0-9]/g, '') : v)}
        placeholder={placeholder}
        placeholderTextColor="#98a2b3"
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your portfolio</Text>
      <Text style={styles.sub}>This is what employers and fellow members see. You control every section.</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Section id="identity" title="Professional identity" hint="Name, headline, summary and programme">
        <Field label="Full name" value={form.displayName} onChangeText={(v) => set('displayName', v)} />
        <Field label="Professional headline" value={form.headline} placeholder="e.g. Final-year IT student | React Native" onChangeText={(v) => set('headline', v)} />
        <Field label="Professional summary" value={form.summary} multiline placeholder="A short paragraph on who you are and where you're heading." onChangeText={(v) => set('summary', v)} />
        <Field label="Profile photograph URL" value={form.avatarUrl} placeholder="https://…" onChangeText={(v) => set('avatarUrl', v)} />

        <Text style={styles.label}>Campus</Text>
        <View style={styles.chips}>
          {CAMPUS_LOCATIONS.map((campus) => {
            const active = form.campusLocation === campus;
            return (
              <Pressable key={campus} onPress={() => set('campusLocation', campus as CampusLocation)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={active ? styles.chipActiveText : styles.chipText}>{campus}</Text>
              </Pressable>
            );
          })}
        </View>

        {isAlumni
          ? <Field label="Current field of work" value={form.fieldOfWork} placeholder="e.g. Financial services engineering" onChangeText={(v) => set('fieldOfWork', v)} />
          : <Field label="Programme of study" value={form.programmeOfStudy} placeholder="e.g. BSc Information Technology" onChangeText={(v) => set('programmeOfStudy', v)} />}
        <Text style={styles.helper}>Your programme drives opportunity matching and how you appear in the alumni career pathways.</Text>

        <View style={styles.pair}>
          <View style={styles.pairItem}><Field label="Year of enrolment" numeric value={form.yearOfEnrolment} onChangeText={(v) => set('yearOfEnrolment', v ? Number(v) : undefined)} /></View>
          <View style={styles.pairItem}><Field label="Graduation year" numeric value={form.graduationYear} onChangeText={(v) => set('graduationYear', v ? Number(v) : undefined)} /></View>
        </View>
      </Section>

      <Section id="skills" title="Skills and career direction" hint="What you can do, and where you want to go">
        <Field label="Skills (comma separated)" value={skillsText} multiline placeholder="react native, typescript, firebase" onChangeText={(v) => set('skills', csv(v))} />
        <Field label="Career interests (comma separated)" value={interestsText} placeholder="mobile engineering, fintech, devops" onChangeText={(v) => set('careerInterests', csv(v))} />
        <Field label="Career aspirations" value={form.careerAspirations} multiline placeholder="What are you working towards?" onChangeText={(v) => set('careerAspirations', v)} />
      </Section>

      <Section id="experience" title="Experience" hint="Employment, internships and ventures">
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

      <Section id="academic" title="Academic record" hint="Qualifications, certifications, awards">
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

      <Section id="projects" title="Projects and badges" hint="Repositories, live apps, digital badges">
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

      <Section id="activities" title="Leadership and activities" hint="SRC, societies, hackathons, volunteering">
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

      <Section id="links" title="Links and CV" hint="GitHub, LinkedIn, portfolio, CV">
        <Field label="GitHub profile" value={form.gitHubUrl} placeholder="https://github.com/…" onChangeText={(v) => set('gitHubUrl', v)} />
        <Field label="LinkedIn profile" value={form.linkedInUrl} placeholder="https://linkedin.com/in/…" onChangeText={(v) => set('linkedInUrl', v)} />
        <Field label="Personal website or portfolio" value={form.portfolioUrl} placeholder="https://…" onChangeText={(v) => set('portfolioUrl', v)} />
        <Field label="CV link" value={form.resumeUrl} placeholder="https://…" onChangeText={(v) => set('resumeUrl', v)} />
      </Section>

      {isBusiness ? (
        <Section id="company" title="Company profile" hint="What your organisation does and who you're hiring">
          <Field label="Organisation name" value={form.companyName} onChangeText={(v) => set('companyName', v)} />
          <Field label="Industry" value={form.industry} onChangeText={(v) => set('industry', v)} />
          <Field label="Company description" value={form.companyDescription} multiline onChangeText={(v) => set('companyDescription', v)} />
          <Field label="Location" value={form.companyLocation} onChangeText={(v) => set('companyLocation', v)} />
          <Field label="Website" value={form.companyWebsite} placeholder="https://…" onChangeText={(v) => set('companyWebsite', v)} />
          <Field label="Graduates, skills or talent you are seeking" value={form.talentSought} multiline onChangeText={(v) => set('talentSought', v)} />
        </Section>
      ) : null}

      <Section id="cv" title="Build from your CV" hint="Paste your CV and let the assistant extract the structure">
        <Text style={styles.helper}>
          Paste the text of your CV. The assistant extracts your headline, summary, skills, qualifications and
          experience — it never invents anything, and nothing is saved until you press Save.
        </Text>
        <TextInput
          style={[styles.input, styles.multiline, { minHeight: 150 }]}
          value={cvText}
          onChangeText={setCvText}
          multiline
          placeholder="Paste your CV text here (at least 80 characters)…"
          placeholderTextColor="#98a2b3"
        />
        <Pressable onPress={() => void analyseCv()} disabled={extracting} style={[styles.secondary, extracting && styles.disabled]}>
          {extracting ? <ActivityIndicator /> : <Text style={styles.secondaryText}>Analyse CV</Text>}
        </Pressable>
      </Section>

      <Section id="visibility" title="Who can see what" hint="Per-section privacy controls">
        <VisibilityEditor visibility={form.visibility} onChange={(next) => set('visibility', next)} />
      </Section>

      <Pressable onPress={() => void save()} disabled={saving} style={[styles.primary, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save profile</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8fa' },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800' },
  sub: { color: '#667085', marginBottom: 16, lineHeight: 20 },
  notice: { color: '#166534', marginBottom: 12 },
  section: { borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 14, marginBottom: 12, backgroundColor: '#fff', overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionHint: { color: '#667085', marginTop: 2, fontSize: 12 },
  caret: { fontSize: 18, color: '#98a2b3' },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#f2f4f7', paddingTop: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#475467', marginBottom: 4 },
  helper: { color: '#667085', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, minHeight: 42, backgroundColor: '#fff' },
  multiline: { minHeight: 86, textAlignVertical: 'top' },
  pair: { flexDirection: 'row', gap: 10 },
  pairItem: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#d0d5dd' },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 12 },
  chipActiveText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  primary: { backgroundColor: '#111827', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { borderWidth: 1, borderColor: '#111827', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  secondaryText: { fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
