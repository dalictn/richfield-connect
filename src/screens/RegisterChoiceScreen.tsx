import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function RegisterChoiceScreen({ navigation }: any) {
  return (
    <View style={styles.page}>
      <View style={styles.container}>
        <Text style={styles.title}>Choose account type</Text>
        <Pressable style={styles.card} onPress={() => navigation.navigate('StudentRegister')}>
          <Text style={styles.cardTitle}>Student</Text>
          <Text style={styles.cardBody}>Institutional Richfield / AAA email required.</Text>
        </Pressable>
        <Pressable style={styles.card} onPress={() => navigation.navigate('AlumniVerify')}>
          <Text style={styles.cardTitle}>Alumni</Text>
          <Text style={styles.cardBody}>Verify your former student identity, then authenticate by email link.</Text>
        </Pressable>
        <Pressable style={styles.card} onPress={() => navigation.navigate('BusinessRegister')}>
          <Text style={styles.cardTitle}>Business User</Text>
          <Text style={styles.cardBody}>Register a company account for administrator approval.</Text>
        </Pressable>
        <Text style={styles.admin}>Administrator accounts are provisioned separately and cannot self-register.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Capped and centred so the cards do not span the full width of a desktop
  // browser window under react-native-web.
  page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f6f8fa' },
  container: { width: '100%', maxWidth: 460, gap: 14 },
  title: { fontSize: 30, fontWeight: '900' },
  card: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 18, gap: 6, backgroundColor: '#fff' },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardBody: { color: '#667085', lineHeight: 20 },
  admin: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
