import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function AlumniEmailLinkPendingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.body}>
        If your details match an eligible alumni record, Firebase has sent a sign-in link. Open it on this device to complete identity verification and create your alumni account.
      </Text>
      <Text style={styles.note}>For security, this screen does not reveal whether a registry record matched.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 28, fontWeight: '900' },
  body: { fontSize: 16, lineHeight: 24, color: '#4B5563' },
  note: { fontSize: 13, color: '#64748B' },
});
