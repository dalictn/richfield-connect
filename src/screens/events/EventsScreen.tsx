import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, HelperText, Snackbar, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../auth/AuthProvider';
import {
  eventTypeLabel,
  EVENT_TYPES,
  formatEventTime,
  isAttending,
  subscribePublishedEvents,
  toggleEventRsvp,
  type InstitutionalEvent,
} from '../../events/eventsService';

/**
 * Institutional event listings (brief §2.5). Every member sees published events;
 * only administrators can create or publish them.
 */
export function EventsScreen() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const theme = useTheme();
  const [events, setEvents] = useState<InstitutionalEvent[]>([]);
  const [attending, setAttending] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => subscribePublishedEvents(
    (items) => { setEvents(items); setLoading(false); },
    (e) => { setError(e.message); setLoading(false); },
  ), []);

  const ids = events.map((event) => event.id).join('|');
  useEffect(() => {
    if (!uid || !ids) return undefined;
    let alive = true;
    Promise.all(events.map(async (event) => [event.id, await isAttending(event.id, uid).catch(() => false)] as const))
      .then((pairs) => { if (alive) setAttending(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [uid, ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = Date.now();
  const upcoming = useMemo(() => events.filter((event) => Date.parse(event.startsAt) >= now - 3600000), [events, now]);
  const past = useMemo(() => events.filter((event) => Date.parse(event.startsAt) < now - 3600000).reverse(), [events, now]);

  async function rsvp(event: InstitutionalEvent) {
    setBusyId(event.id); setError('');
    try {
      const result = await toggleEventRsvp(event.id);
      setAttending((current) => ({ ...current, [event.id]: result.attending }));
      setNotice(result.attending ? `You're going to ${event.title}.` : `RSVP cancelled for ${event.title}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update your RSVP.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <ActivityIndicator style={styles.loading} />;

  const renderEvent = (event: InstitutionalEvent, isPast = false) => {
    const going = attending[event.id];
    const full = Boolean(event.capacity && event.attendeeCount >= event.capacity && !going);
    const icon = EVENT_TYPES.find((item) => item.value === event.type)?.icon ?? 'calendar';
    return (
      <Card key={event.id} mode="outlined" style={[styles.card, isPast && styles.past]}>
        <Card.Title
          title={event.title}
          titleNumberOfLines={2}
          subtitle={`${formatEventTime(event.startsAt)} · ${event.location}`}
          subtitleNumberOfLines={2}
          left={(props) => <Chip {...props} compact icon={icon} style={styles.typeChip}>{eventTypeLabel(event.type)}</Chip>}
          leftStyle={styles.leftSlot}
        />
        <Card.Content>
          <Text variant="bodyMedium" style={styles.description}>{event.description}</Text>
          <View style={styles.tags}>
            {[...event.programmeTags, ...event.interestTags].slice(0, 6).map((tag) => <Chip key={tag} compact>{tag}</Chip>)}
          </View>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {event.attendeeCount} going{event.capacity ? ` · ${event.capacity} places` : ''}
          </Text>
        </Card.Content>
        {!isPast ? (
          <Card.Actions>
            <Button
              mode={going ? 'outlined' : 'contained'}
              icon={going ? 'check' : 'calendar-plus'}
              loading={busyId === event.id}
              disabled={busyId === event.id || full}
              onPress={() => void rsvp(event)}
            >
              {full ? 'Full' : going ? 'Going' : 'RSVP'}
            </Button>
          </Card.Actions>
        ) : null}
      </Card>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <HelperText type="error">{error}</HelperText> : null}
        <Text variant="titleMedium" style={styles.heading}>Upcoming</Text>
        {upcoming.length ? upcoming.map((event) => renderEvent(event)) : (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No upcoming events yet.</Text>
        )}
        {past.length ? <Text variant="titleMedium" style={styles.heading}>Past events</Text> : null}
        {past.map((event) => renderEvent(event, true))}
      </ScrollView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={3000}>{notice}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  loading: { marginTop: 40 },
  heading: { marginTop: 8, marginBottom: 8 },
  card: { marginBottom: 12 },
  past: { opacity: 0.65 },
  leftSlot: { width: 'auto', marginRight: 12 },
  typeChip: { alignSelf: 'center' },
  description: { marginBottom: 10, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  empty: { paddingVertical: 16 },
});
