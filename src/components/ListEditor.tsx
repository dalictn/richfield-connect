import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';

export interface FieldSpec<T> {
  key: Extract<keyof T, string>;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  /** Renders a chip picker instead of a text input. */
  options?: readonly string[];
  /** Lay this field beside the previous one. */
  half?: boolean;
}

/**
 * Editor for a repeatable list of structured entries — work experience,
 * certifications, projects and so on.
 *
 * The portfolio has eleven such lists. Without a shared editor each would be
 * fifty lines of near-identical form code, and they would drift apart.
 */
export function ListEditor<T extends object>({
  title,
  description,
  items,
  fields,
  blank,
  onChange,
  max = 20,
  addLabel = 'Add entry',
}: {
  title: string;
  description?: string;
  items: T[];
  fields: FieldSpec<T>[];
  blank: () => T;
  onChange: (next: T[]) => void;
  max?: number;
  addLabel?: string;
}) {
  const theme = useTheme();
  const update = (index: number, key: Extract<keyof T, string>, value: unknown) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  return (
    <View style={styles.root}>
      <Text variant="titleMedium">{title}</Text>
      {description ? <Text variant="bodySmall" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>{description}</Text> : null}

      {items.map((item, index) => (
        <Card key={index} mode="outlined" style={styles.card}>
          <View style={styles.cardHead}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>#{index + 1}</Text>
            <IconButton icon="delete-outline" size={20} iconColor={theme.colors.error} onPress={() => onChange(items.filter((_, i) => i !== index))} accessibilityLabel={`Remove entry ${index + 1}`} />
          </View>
          <Card.Content style={styles.fields}>
            {fields.map((field) => {
              const value = (item as Record<string, unknown>)[field.key];
              if (field.options) {
                return (
                  <View key={field.key} style={styles.full}>
                    <Text variant="labelMedium" style={styles.label}>{field.label}</Text>
                    <View style={styles.chips}>
                      {field.options.map((option) => (
                        <Chip key={option} compact selected={String(value ?? '') === option} onPress={() => update(index, field.key, option)}>{option}</Chip>
                      ))}
                    </View>
                  </View>
                );
              }
              return (
                <TextInput
                  key={field.key}
                  mode="outlined"
                  dense
                  label={field.label}
                  style={field.half ? styles.half : styles.full}
                  value={value === undefined || value === null ? '' : String(value)}
                  placeholder={field.placeholder}
                  multiline={field.multiline}
                  keyboardType={field.numeric ? 'number-pad' : 'default'}
                  onChangeText={(next) => update(index, field.key, field.numeric ? (next.replace(/[^0-9]/g, '') ? Number(next.replace(/[^0-9]/g, '')) : undefined) : next)}
                />
              );
            })}
          </Card.Content>
        </Card>
      ))}

      {items.length < max ? (
        <Button mode="outlined" icon="plus" onPress={() => onChange([...items, blank()])} style={styles.add}>{addLabel}</Button>
      ) : (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}>Maximum of {max} entries reached.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 22 },
  description: { marginTop: 2, marginBottom: 8, lineHeight: 18 },
  card: { marginTop: 8, marginBottom: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 14 },
  full: { width: '100%' },
  half: { flexGrow: 1, flexBasis: 140 },
  label: { marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  add: { marginTop: 10, borderStyle: 'dashed' },
});
