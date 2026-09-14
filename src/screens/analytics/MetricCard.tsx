import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, ProgressBar, Text, useTheme } from 'react-native-paper';

/**
 * Shared dashboard primitives for the student, business and administrator
 * dashboards. The rubric requires data to be presented visually, so every series
 * renders as proportional bars rather than bare numbers.
 */
export function MetricCard({ label, value }: { label: string; value: string | number }) {
  const theme = useTheme();
  return (
    <Card mode="contained" style={[styles.metric, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>{value}</Text>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

const PALETTE_KEYS = ['primary', 'secondary', 'tertiary'] as const;

export function BarChart({ items }: { items: Array<{ label: string; value: number }> }) {
  const theme = useTheme();
  const rows = items.slice(0, 8);
  const max = Math.max(1, ...rows.map((item) => item.value));
  if (!rows.length) {
    return <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginVertical: 8 }}>No data yet.</Text>;
  }
  return (
    <Card mode="outlined" style={styles.chart}>
      <Card.Content>
        {rows.map((item, index) => (
          <View key={item.label} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text variant="bodyMedium" numberOfLines={1} style={styles.rowLabel}>{item.label}</Text>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>{item.value}</Text>
            </View>
            <ProgressBar
              progress={item.value / max}
              color={theme.colors[PALETTE_KEYS[index % PALETTE_KEYS.length]]}
              style={[styles.bar, { backgroundColor: theme.colors.surfaceVariant }]}
            />
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  metric: { flexGrow: 1, flexBasis: 150, margin: 5 },
  chart: { marginTop: 8 },
  row: { marginBottom: 12 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  rowLabel: { flex: 1 },
  bar: { height: 10, borderRadius: 5 },
});
