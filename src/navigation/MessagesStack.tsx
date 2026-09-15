import React from 'react';
import { theme } from '../ui/theme';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InboxBell } from '../notifications/NotificationCenter';
import { MessagesScreen } from '../screens/social/MessagesScreen';
import { ConversationScreen } from '../screens/social/ConversationScreen';

/**
 * Messaging is two screens, so the Messages tab hosts its own stack: the
 * conversation list pushes an individual thread and gets a back affordance for
 * free. ConversationScreen stays a plain presentational component — the route
 * params are unpacked here rather than inside it.
 */
export type MessagesStackParamList = {
  MessagesList: undefined;
  Conversation: { conversationId: string; targetUid: string; title?: string };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerRight: () => <InboxBell />, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="MessagesList" component={MessagesScreen} options={{ title: 'Messages' }} />
      <Stack.Screen
        name="Conversation"
        options={({ route }) => ({ title: route.params.title || 'Conversation' })}
      >
        {({ route }) => (
          <ConversationScreen conversationId={route.params.conversationId} targetUid={route.params.targetUid} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
