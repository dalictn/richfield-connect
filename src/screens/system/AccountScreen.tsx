import React from 'react';
import { Button, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';

export function AccountScreen() {
  const { profile, logout } = useAuth();
  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>Account</Text>
      <Text>{profile?.displayName}</Text>
      <Text>{profile?.email}</Text>
      <Text>Role: {profile?.role}</Text>
      <Button title="Sign out" onPress={() => void logout()} />
    </View>
  );
}
