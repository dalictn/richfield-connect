import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Badge, Button, Divider, IconButton, List, Modal, Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../auth/AuthProvider';
import { markAllRead, markRead, subscribeInbox, timeAgo, type InboxItem } from './inboxService';

const ICONS: Record<string, string> = {
  connection_request: 'account-plus',
  connection_accepted: 'account-check',
  direct_message: 'message-text',
  opportunity_match: 'briefcase-check',
  event: 'calendar-star',
  announcement: 'bullhorn',
  admin_broadcast: 'bullhorn',
};

interface NotificationCenterState {
  unread: number;
  open: () => void;
}

const NotificationCenterContext = createContext<NotificationCenterState | undefined>(undefined);

/**
 * One inbox subscription for the whole app. The bell in each header only reads
 * this context, so there is a single listener and a single toast no matter how
 * many headers are mounted.
 */
export function NotificationCenterProvider({ children }: React.PropsWithChildren) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const theme = useTheme();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<InboxItem | null>(null);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    setItems([]);
    known.current = null;
    if (!uid) return undefined;
    return subscribeInbox(
      uid,
      (next) => {
        // The first snapshot is history; only notifications that arrive after it
        // should pop a toast.
        if (known.current) {
          const fresh = next.find((item) => !item.read && !known.current!.has(item.id));
          if (fresh) setToast(fresh);
        }
        known.current = new Set(next.map((item) => item.id));
        setItems(next);
      },
      (error) => console.warn('Notification inbox unavailable', error),
    );
  }, [uid]);

  const unread = items.filter((item) => !item.read).length;
  const value = useMemo<NotificationCenterState>(() => ({ unread, open: () => setVisible(true) }), [unread]);

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      <Portal>
        <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text variant="titleLarge">Notifications</Text>
            <Button compact disabled={!unread || !uid} onPress={() => uid && void markAllRead(uid, items)}>Mark all read</Button>
          </View>
          <Divider />
          <ScrollView style={styles.list}>
            {items.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>You're all caught up.</Text>
            ) : items.map((item) => (
              <List.Item
                key={item.id}
                title={item.title}
                description={item.body}
                descriptionNumberOfLines={3}
                onPress={() => uid && !item.read && void markRead(uid, item.id)}
                style={!item.read ? { backgroundColor: theme.colors.primaryContainer } : undefined}
                left={(props) => <List.Icon {...props} icon={ICONS[item.data?.type ?? ''] ?? 'bell-outline'} />}
                right={() => <Text variant="labelSmall" style={styles.time}>{timeAgo(item.createdAt)}</Text>}
              />
            ))}
          </ScrollView>
          <Button onPress={() => setVisible(false)}>Close</Button>
        </Modal>
        <Snackbar
          visible={Boolean(toast)}
          onDismiss={() => setToast(null)}
          duration={5000}
          action={{ label: 'View', onPress: () => setVisible(true) }}
        >
          {toast ? `${toast.title} — ${toast.body}` : ''}
        </Snackbar>
      </Portal>
    </NotificationCenterContext.Provider>
  );
}

export function InboxBell() {
  const center = useContext(NotificationCenterContext);
  if (!center) return null;
  return (
    <View style={styles.bell}>
      <IconButton icon={center.unread ? 'bell-ring' : 'bell-outline'} onPress={center.open} accessibilityLabel="Open notifications" />
      {center.unread ? <Badge size={18} style={styles.badge}>{center.unread > 9 ? '9+' : center.unread}</Badge> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { alignSelf: 'center', width: '92%', maxWidth: 520, maxHeight: '80%', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  list: { marginVertical: 8 },
  empty: { textAlign: 'center', padding: 24 },
  time: { alignSelf: 'center', marginLeft: 8 },
  bell: { marginRight: 4 },
  badge: { position: 'absolute', top: 6, right: 6 },
});
