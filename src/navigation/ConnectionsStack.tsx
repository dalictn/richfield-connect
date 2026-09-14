import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InboxBell } from '../notifications/NotificationCenter';
import { ConnectionsScreen } from '../screens/social/ConnectionsScreen';
import { DirectoryScreen } from '../screens/social/DirectoryScreen';
import { ProfileViewScreen } from '../screens/profile/ProfileViewScreen';

/**
 * Connections tab: your network, plus the directory used to grow it.
 *
 * The directory is pushed rather than given its own tab so the shell keeps the
 * same tab count. Discovery and your existing connections belong together.
 */
export type ConnectionsStackParamList = {
  ConnectionsHome: undefined;
  Directory: undefined;
  Profile: { targetUid: string; title?: string };
};

const Stack = createNativeStackNavigator<ConnectionsStackParamList>();

export function ConnectionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerRight: () => <InboxBell /> }}>
      <Stack.Screen name="ConnectionsHome" component={ConnectionsScreen} options={{ title: 'Connections' }} />
      <Stack.Screen name="Directory" component={DirectoryScreen} options={{ title: 'Find people' }} />
      <Stack.Screen name="Profile" options={({ route }) => ({ title: route.params.title || 'Profile' })}>
        {({ route, navigation }) => (
          <ProfileViewScreen targetUid={route.params.targetUid} onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
