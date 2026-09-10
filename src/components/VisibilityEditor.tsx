import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PROFILE_SECTIONS, SECTION_LABELS } from '../types/portfolio';
import type { ProfileSection, ProfileVisibility, SectionAudience } from '../types/portfolio';

const AUDIENCES: Array<{ key: keyof SectionAudience; label: string; hint: string }> = [
  { key: 'public', label: 'Everyone', hint: 'Any signed-in member of the platform' },
  { key: 'connections', label: 'Connections', hint: 'People you have accepted' },
  { key: 'students', label: 'Students', hint: 'Currently enrolled students' },
  { key: 'alumni', label: 'Alumni', hint: 'Richfield and AAA graduates' },
  { key: 'business', label: 'Employers', hint: 'Verified recruiters' },
];

/**
 * Per-section audience control, as the brief requires: a member decides which
 * audiences see each section of their profile.
 *
 * Turning on "Everyone" makes the narrower audiences redundant, so they are
 * shown as covered rather than being silently ignored — the effective state is
 * always what the row displays.
 */
export function VisibilityEditor({
  visibility,
  onChange,
}: {
  visibility: ProfileVisibility;
  onChange: (next: ProfileVisibility) => void;
}) {
  const toggle = (section: ProfileSection, audience: keyof SectionAudience) => {
    const current = visibility[section];
    onChange({ ...visibility, [section]: { ...current, [audience]: !current[audience] } });
  };

  return (
    <View>
      <Text style={styles.intro}>
        Each section of your profile is hidden unless you share it. Administrators can always see your
        profile for moderation, and your student number never leaves the server.
      </Text>

      <View style={styles.legend}>
        {AUDIENCES.map((audience) => (
          <Text key={audience.key} style={styles.legendItem}>
            <Text style={styles.legendLabel}>{audience.label}</Text> — {audience.hint}
          </Text>
        ))}
      </View>

      {PROFILE_SECTIONS.map((section) => {
        const row = visibility[section];
        const everyone = row.public;
        return (
          <View key={section} style={styles.row}>
            <Text style={styles.section}>{SECTION_LABELS[section]}</Text>
            <View style={styles.toggles}>
              {AUDIENCES.map((audience) => {
                const on = row[audience.key];
                const covered = everyone && audience.key !== 'public';
                return (
                  <Pressable
                    key={audience.key}
                    onPress={() => toggle(section, audience.key)}
                    style={[styles.toggle, on && styles.toggleOn, covered && !on && styles.toggleCovered]}
                  >
                    <Text style={on ? styles.toggleOnText : covered ? styles.toggleCoveredText : styles.toggleText}>
                      {audience.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {everyone ? <Text style={styles.note}>Visible to everyone — the narrower audiences below are already covered.</Text> : null}
            {!everyone && !row.connections && !row.students && !row.alumni && !row.business
              ? <Text style={styles.private}>Private — only you and administrators.</Text>
              : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: '#667085', lineHeight: 20, marginBottom: 14 },
  legend: { backgroundColor: '#f2f4f7', borderRadius: 10, padding: 12, marginBottom: 16, gap: 4 },
  legendItem: { fontSize: 12, color: '#475467', lineHeight: 17 },
  legendLabel: { fontWeight: '800', color: '#111827' },
  row: { borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: '#fff' },
  section: { fontWeight: '800', marginBottom: 9 },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#d0d5dd' },
  toggleOn: { backgroundColor: '#111827', borderColor: '#111827' },
  toggleCovered: { borderStyle: 'dashed', backgroundColor: '#f9fafb' },
  toggleText: { fontSize: 12 },
  toggleOnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  toggleCoveredText: { fontSize: 12, color: '#98a2b3' },
  note: { fontSize: 12, color: '#667085', marginTop: 8, fontStyle: 'italic' },
  private: { fontSize: 12, color: '#98a2b3', marginTop: 8, fontStyle: 'italic' },
});
