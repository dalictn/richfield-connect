import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { applyToOpportunity, createOpportunity, recordOpportunityView, subscribeApprovedOpportunities, subscribeMyMatches } from '../../opportunities/opportunityService';
import type { Opportunity, OpportunityMatch } from '../../types/opportunity';

export function OpportunityBoardScreen() {
  const { firebaseUser, profile } = useAuth();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [title, setTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => subscribeApprovedOpportunities(setItems, (error) => setMessage(error.message)), []);
  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'student') return undefined;
    return subscribeMyMatches(firebaseUser.uid, setMatches, (error) => setMessage(error.message));
  }, [firebaseUser, profile?.role]);

  async function post() {
    try {
      await createOpportunity({
        title,
        description,
        type: 'graduate',
        location: 'South Africa',
        remote: false,
        requiredSkills: skills.split(',').map((item) => item.trim()).filter(Boolean),
        programmeTags: [],
        companyName: profile?.companyName ?? '',
      });
      setTitle(''); setSkills(''); setDescription('');
      setMessage('Opportunity submitted for administrator approval.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create opportunity.');
    }
  }

  async function apply(item: Opportunity) {
    try {
      await recordOpportunityView(item.id);
      await applyToOpportunity(item.id);
      setMessage('Application submitted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to apply.');
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 10 }}>Opportunities</Text>
      {profile?.role === 'business' ? (
        <View style={{ marginBottom: 18 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Opportunity title" style={styles.input} />
          <TextInput value={skills} onChangeText={setSkills} placeholder="Required skills, comma separated" style={styles.input} />
          <TextInput value={description} onChangeText={setDescription} placeholder="Description" multiline style={[styles.input, { minHeight: 70 }]} />
          <Pressable onPress={post} style={styles.primary}><Text style={styles.primaryText}>Submit for approval</Text></Pressable>
        </View>
      ) : null}
      {message ? <Text style={{ marginBottom: 8 }}>{message}</Text> : null}
      {profile?.role === 'student' && matches.length ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Matched to you</Text>
          {matches.slice(0, 5).map((match) => <Text key={match.id}>• {match.id}: {(match.score * 100).toFixed(0)}% match</Text>)}
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text>No approved opportunities yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={{ fontSize: 18, fontWeight: '800' }}>{item.title}</Text>
            <Text>{item.companyName} · {item.type}</Text>
            <Text style={{ marginVertical: 6 }}>{item.description}</Text>
            <Text>Skills: {item.requiredSkills.join(', ')}</Text>
            {profile?.role === 'student' ? (
              <Pressable onPress={() => void apply(item)} style={[styles.primary, { marginTop: 8 }]}>
                <Text style={styles.primaryText}>View & apply</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = {
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 8 },
  primary: { padding: 12, backgroundColor: '#111827', borderRadius: 8, alignItems: 'center' as const },
  primaryText: { color: '#fff', textAlign: 'center' as const, fontWeight: '700' as const },
  card: { padding: 14, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 10 },
};
