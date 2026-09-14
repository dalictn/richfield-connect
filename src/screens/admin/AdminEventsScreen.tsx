import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, HelperText, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import {
  eventTypeLabel,
  EVENT_TYPES,
  formatEventTime,
  setEventStatus,
  subscribeAllEvents,
  upsertEvent,
  type EventStatus,
  type EventType,
  type InstitutionalEvent,
} from '../../events/eventsService';

interface Draft {
  eventId?: string;
  title: string;
  description: string;
  type: EventType;
  location: string;
  when: string;
  capacity: string;
  programmeTags: string;
  interestTags: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function blankDraft(): Draft {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(10, 0, 0, 0);
  return { title: '', description: '', type: 'career-fair', location: '', when: toLocalInput(d.toISOString()), capacity: '', programmeTags: '', interestTags: '' };
}

const csv = (value: string) => Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));

const STATUS_COLOUR: Record<EventStatus, string> = { draft: '#B45309', published: '#0F766E', cancelled: '#B42318' };

/**
 * Administrator event management (brief §2.2): only administrators create, edit
 * and publish institutional events. Publishing notifies the students whose
 * programme or interests match the event's tags.
 */
export function AdminEventsScreen() {
  const theme = useTheme();
  const [events, setEvents] = useState<InstitutionalEvent[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => subscribeAllEvents(setEvents, (e) => setError(e.message)), []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function edit(event: InstitutionalEvent) {
    setDraft({
      eventId: event.id,
      title: event.title,
      description: event.description,
      type: event.type,
      location: event.location,
      when: toLocalInput(event.startsAt),
      capacity: event.capacity ? String(event.capacity) : '',
      programmeTags: event.programmeTags.join(', '),
      interestTags: event.interestTags.join(', '),
    });
    setEditing(true);
  }

  async function save(status: EventStatus) {
    setError('');
    const startsAt = new Date(draft.when.trim().replace(' ', 'T'));
    if (Number.isNaN(startsAt.getTime())) {
      setError('Enter the start time as YYYY-MM-DD HH:MM, for example 2026-09-22 10:00.');
      return;
    }
    setSaving(true);
    try {
      const result = await upsertEvent({
        eventId: draft.eventId,
        title: draft.title,
        description: draft.description,
        type: draft.type,
        location: draft.location,
        startsAt: startsAt.toISOString(),
        capacity: draft.capacity ? Number(draft.capacity) : null,
        programmeTags: csv(draft.programmeTags),
        interestTags: csv(draft.interestTags),
        status,
      });
      setNotice(result.status === 'published' ? 'Event published — matching students are being notified.' : 'Draft saved.');
      setDraft(blankDraft());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save this event.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(event: InstitutionalEvent, status: EventStatus) {
    setBusyId(event.id); setError('');
    try {
      await setEventStatus(event.id, status);
      setNotice(status === 'published' ? `"${event.title}" is live.` : `"${event.title}" is now ${status}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to change the event status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall">Institutional events</Text>
        <Text variant="bodyMedium" style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>
          Only administrators can create and publish events. Tag a programme or interest to notify only the students it's relevant to.
        </Text>

        {!editing ? (
          <Button mode="contained" icon="calendar-plus" onPress={() => { setDraft(blankDraft()); setEditing(true); }} style={styles.newButton}>
            New event
          </Button>
        ) : (
          <Card mode="outlined" style={styles.card}>
            <Card.Title title={draft.eventId ? 'Edit event' : 'New event'} />
            <Card.Content style={styles.form}>
              <TextInput mode="outlined" label="Title" value={draft.title} onChangeText={(v) => set('title', v)} />
              <View style={styles.chips}>
                {EVENT_TYPES.map((type) => (
                  <Chip key={type.value} icon={type.icon} selected={draft.type === type.value} onPress={() => set('type', type.value)}>{type.label}</Chip>
                ))}
              </View>
              <TextInput mode="outlined" label="Starts (YYYY-MM-DD HH:MM)" value={draft.when} onChangeText={(v) => set('when', v)} />
              <TextInput mode="outlined" label="Location" value={draft.location} onChangeText={(v) => set('location', v)} />
              <TextInput mode="outlined" label="Description" value={draft.description} onChangeText={(v) => set('description', v)} multiline numberOfLines={4} />
              <TextInput mode="outlined" label="Capacity (optional)" value={draft.capacity} keyboardType="number-pad" onChangeText={(v) => set('capacity', v.replace(/[^0-9]/g, ''))} />
              <TextInput mode="outlined" label="Programmes (comma separated)" placeholder="BSc Information Technology" value={draft.programmeTags} onChangeText={(v) => set('programmeTags', v)} />
              <TextInput mode="outlined" label="Career interests (comma separated)" placeholder="fintech, cloud" value={draft.interestTags} onChangeText={(v) => set('interestTags', v)} />
              <HelperText type="info">Leave both tag fields empty to notify every student.</HelperText>
              {error ? <HelperText type="error">{error}</HelperText> : null}
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => { setEditing(false); setError(''); }}>Cancel</Button>
              <Button mode="outlined" loading={saving} disabled={saving} onPress={() => void save('draft')}>Save draft</Button>
              <Button mode="contained" icon="send" loading={saving} disabled={saving} onPress={() => void save('published')}>Publish</Button>
            </Card.Actions>
          </Card>
        )}

        {!editing && error ? <HelperText type="error">{error}</HelperText> : null}
        <Divider style={styles.divider} />

        {events.length === 0 ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>No events yet.</Text>
        ) : events.map((event) => (
          <Card key={event.id} mode="outlined" style={styles.card}>
            <Card.Title
              title={event.title}
              subtitle={`${eventTypeLabel(event.type)} · ${formatEventTime(event.startsAt)} · ${event.location}`}
              subtitleNumberOfLines={2}
              right={() => (
                <Chip compact textStyle={{ color: '#fff' }} style={[styles.status, { backgroundColor: STATUS_COLOUR[event.status] }]}>
                  {event.status}
                </Chip>
              )}
            />
            <Card.Content>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {event.attendeeCount} going{event.status === 'published' ? ` · ${event.notifiedCount ?? 0} students notified` : ''}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button icon="pencil" onPress={() => edit(event)}>Edit</Button>
              {event.status !== 'published' ? (
                <Button mode="contained" icon="send" loading={busyId === event.id} disabled={busyId === event.id} onPress={() => void changeStatus(event, 'published')}>Publish</Button>
              ) : (
                <Button mode="outlined" icon="close" loading={busyId === event.id} disabled={busyId === event.id} onPress={() => void changeStatus(event, 'cancelled')}>Cancel event</Button>
              )}
            </Card.Actions>
          </Card>
        ))}
      </ScrollView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={4000}>{notice}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  sub: { marginTop: 4, marginBottom: 16 },
  newButton: { alignSelf: 'flex-start', marginBottom: 8 },
  card: { marginBottom: 12 },
  form: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  divider: { marginVertical: 16 },
  status: { marginRight: 12 },
});
