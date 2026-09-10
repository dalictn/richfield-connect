import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  const update = (index: number, key: Extract<keyof T, string>, value: unknown) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}

      {items.map((item, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIndex}>{index + 1}</Text>
            <Pressable onPress={() => onChange(items.filter((_, i) => i !== index))} hitSlop={8}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>

          <View style={styles.fields}>
            {fields.map((field) => {
              const value = (item as Record<string, unknown>)[field.key];
              if (field.options) {
                return (
                  <View key={field.key} style={styles.full}>
                    <Text style={styles.label}>{field.label}</Text>
                    <View style={styles.chips}>
                      {field.options.map((option) => {
                        const active = String(value ?? '') === option;
                        return (
                          <Pressable key={option} onPress={() => update(index, field.key, option)} style={[styles.chip, active && styles.chipActive]}>
                            <Text style={active ? styles.chipActiveText : styles.chipText}>{option}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              }
              return (
                <View key={field.key} style={field.half ? styles.half : styles.full}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, field.multiline && styles.multiline]}
                    value={value === undefined || value === null ? '' : String(value)}
                    placeholder={field.placeholder}
                    placeholderTextColor="#98a2b3"
                    multiline={field.multiline}
                    keyboardType={field.numeric ? 'number-pad' : 'default'}
                    onChangeText={(next) => update(index, field.key, field.numeric ? (next.replace(/[^0-9]/g, '') || undefined) : next)}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {items.length < max ? (
        <Pressable onPress={() => onChange([...items, blank()])} style={styles.add}>
          <Text style={styles.addText}>+ {addLabel}</Text>
        </Pressable>
      ) : (
        <Text style={styles.limit}>Maximum of {max} entries reached.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 22 },
  title: { fontSize: 17, fontWeight: '800' },
  description: { color: '#667085', marginTop: 3, marginBottom: 10, lineHeight: 19 },
  card: { borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: '#fff' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardIndex: { fontWeight: '800', color: '#98a2b3' },
  remove: { color: '#b42318', fontWeight: '700' },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  full: { width: '100%' },
  half: { flexGrow: 1, flexBasis: 130 },
  label: { fontSize: 12, fontWeight: '700', color: '#475467', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, minHeight: 40, backgroundColor: '#fff' },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#d0d5dd' },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 12 },
  chipActiveText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  add: { paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: '#111827', borderStyle: 'dashed', alignItems: 'center' },
  addText: { fontWeight: '700' },
  limit: { color: '#98a2b3', fontStyle: 'italic' },
});
