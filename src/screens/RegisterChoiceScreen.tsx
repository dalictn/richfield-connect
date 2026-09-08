import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function RegisterChoiceScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose account type</Text>
      <Pressable style={styles.card} onPress={() => navigation.navigate('StudentRegister')}>
        <Text style={styles.cardTitle}>Student</Text>
        <Text>Institutional Richfield / AAA email required.</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => navigation.navigate('AlumniVerify')}>
        <Text style={styles.cardTitle}>Alumni</Text>
        <Text>Verify your former student identity, then authenticate by email link.</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => navigation.navigate('BusinessRegister')}>
        <Text style={styles.cardTitle}>Business User</Text>
        <Text>Register a company account for administrator approval.</Text>
      </Pressable>
      <Text style={styles.admin}>Administrator accounts are provisioned separately and cannot self-register.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 30, fontWeight: '900' },
  card: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, padding: 18, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  admin: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 8 },
});
