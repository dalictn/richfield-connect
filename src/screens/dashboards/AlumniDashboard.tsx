import React from 'react';
import { Button, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';

export function AlumniDashboard() {
  const { logout, profile } = useAuth();
  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text>Alumni Dashboard</Text>
      <Text>Authenticated role: {profile?.role ?? 'unknown'}</Text>
      <Button title="Sign out" onPress={logout} />
    </View>
  );
}
