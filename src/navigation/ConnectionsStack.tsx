import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConnectionsScreen } from '../screens/social/ConnectionsScreen';
import { DirectoryScreen } from '../screens/social/DirectoryScreen';

/**
 * Connections tab: your network, plus the directory used to grow it.
 *
 * The directory is pushed rather than given its own tab so the shell keeps the
 * same tab count. Discovery and your existing connections belong together.
 */
export type ConnectionsStackParamList = {
  ConnectionsHome: undefined;
  Directory: undefined;
};

const Stack = createNativeStackNavigator<ConnectionsStackParamList>();

export function ConnectionsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ConnectionsHome" component={ConnectionsScreen} options={{ title: 'Connections' }} />
      <Stack.Screen name="Directory" component={DirectoryScreen} options={{ title: 'Find people' }} />
    </Stack.Navigator>
  );
}
