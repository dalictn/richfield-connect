import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';

export function PendingApprovalScreen() {
  const { profile, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" />
        <Text style={styles.title}>Pending Admin Approval</Text>
        <Text style={styles.body}>
          {profile?.companyName ?? 'Your organisation'} is registered successfully. A Richfield administrator must approve the business account before platform access is granted.
        </Text>
        <Text style={styles.status}>Live approval status: awaiting review</Text>
        <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
          <Text style={styles.secondaryText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F5F7FA' },
  card: { padding: 28, borderRadius: 18, backgroundColor: '#FFF', gap: 16, elevation: 2 },
  title: { fontSize: 25, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 24, color: '#4B5563' },
  status: { fontSize: 14, fontWeight: '700' },
  secondaryButton: { padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryText: { fontWeight: '700' },
});
