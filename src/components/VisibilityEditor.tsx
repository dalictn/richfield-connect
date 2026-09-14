import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text, useTheme } from 'react-native-paper';
import { PROFILE_SECTIONS, SECTION_LABELS } from '../types/portfolio';
import type { ProfileSection, ProfileVisibility, SectionAudience } from '../types/portfolio';

const AUDIENCES: Array<{ key: keyof SectionAudience; label: string; icon: string; hint: string }> = [
  { key: 'public', label: 'Everyone', icon: 'earth', hint: 'Any signed-in member of the platform' },
  { key: 'connections', label: 'Connections', icon: 'account-multiple-check', hint: 'People you have accepted' },
  { key: 'students', label: 'Students', icon: 'school', hint: 'Currently enrolled students' },
  { key: 'alumni', label: 'Alumni', icon: 'account-star', hint: 'Richfield and AAA graduates' },
  { key: 'business', label: 'Employers', icon: 'domain', hint: 'Verified recruiters' },
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
  const theme = useTheme();
  const toggle = (section: ProfileSection, audience: keyof SectionAudience) => {
    const current = visibility[section];
    onChange({ ...visibility, [section]: { ...current, [audience]: !current[audience] } });
  };

  return (
    <View>
      <Text variant="bodyMedium" style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}>
        Each section of your profile is hidden unless you share it. Administrators can always see your
        profile for moderation, and your student number never leaves the server.
      </Text>

      <Card mode="contained" style={[styles.legend, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content style={styles.legendBody}>
          {AUDIENCES.map((audience) => (
            <Text key={audience.key} variant="bodySmall">
              <Text variant="labelMedium">{audience.label}</Text> — {audience.hint}
            </Text>
          ))}
        </Card.Content>
      </Card>

      {PROFILE_SECTIONS.map((section) => {
        const row = visibility[section];
        const everyone = row.public;
        const hidden = !everyone && !row.connections && !row.students && !row.alumni && !row.business;
        return (
          <Card key={section} mode="outlined" style={styles.row}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.section}>{SECTION_LABELS[section]}</Text>
              <View style={styles.toggles}>
                {AUDIENCES.map((audience) => {
                  const on = row[audience.key];
                  const covered = everyone && audience.key !== 'public';
                  return (
                    <Chip
                      key={audience.key}
                      compact
                      icon={on || covered ? 'check' : audience.icon}
                      selected={on}
                      showSelectedCheck={false}
                      mode={on ? 'flat' : 'outlined'}
                      style={on ? { backgroundColor: theme.colors.secondaryContainer } : covered ? styles.covered : undefined}
                      onPress={() => toggle(section, audience.key)}
                    >
                      {audience.label}
                    </Chip>
                  );
                })}
              </View>
              {everyone ? (
                <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>Visible to everyone, so the narrower audiences are already covered.</Text>
              ) : hidden ? (
                <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>Private — only you and administrators.</Text>
              ) : null}
            </Card.Content>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { lineHeight: 20, marginBottom: 12 },
  legend: { marginBottom: 14 },
  legendBody: { gap: 4 },
  row: { marginBottom: 10 },
  section: { marginBottom: 8 },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  covered: { opacity: 0.55 },
  note: { marginTop: 8, fontStyle: 'italic' },
});
