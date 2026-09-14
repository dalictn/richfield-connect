import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, IconButton, Portal, ProgressBar, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../auth/AuthProvider';
import { callFunction } from '../firebaseApi';
import { sendProfileAssistantMessage } from '../profile/profileService';
import { navigateToTab } from '../navigation/navigationRef';
import { ROLE_NAMES, SHELL_FOR_ROLE, stepsFor } from './tutorialSteps';

interface TutorialState {
  start: () => void;
}

const TutorialContext = createContext<TutorialState>({ start: () => undefined });

export const useTutorial = () => useContext(TutorialContext);

/**
 * Interactive first-time tour (brief §2.6).
 *
 * It moves the member through their role's key screens, and at each step the AI
 * assistant writes the explanation from that member's live profile, so the tour
 * is conversational rather than a fixed script. The member can also ask a
 * question at any step. Finishing or skipping is recorded server-side so it only
 * appears once, and it can be replayed from the Account tab.
 */
export function TutorialHost({ children }: React.PropsWithChildren) {
  const { firebaseUser, profile } = useAuth();
  const theme = useTheme();
  const role = profile?.role;
  const steps = useMemo(() => (role ? stepsFor(role) : []), [role]);

  const eligible = Boolean(
    firebaseUser && profile && role
      && (role === 'administrator' || profile.onboardingComplete === true)
      && !(role === 'business' && !profile.isApproved),
  );
  const completed = (profile as { tutorialCompleted?: boolean } | null)?.tutorialCompleted === true;

  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [explaining, setExplaining] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (eligible && !completed && !dismissed) setActive(true);
  }, [eligible, completed, dismissed]);

  useEffect(() => {
    setDismissed(false);
    setIndex(0);
    setExplanations({});
  }, [firebaseUser?.uid]);

  const step = steps[index];

  // Move to the screen being explained. Short delay so the role shell has mounted
  // on first sign-in before navigating into it.
  useEffect(() => {
    if (!active || !step || !role) return undefined;
    const timer = setTimeout(() => navigateToTab(SHELL_FOR_ROLE[role], step.tab), 250);
    return () => clearTimeout(timer);
  }, [active, step, role]);

  useEffect(() => {
    if (!active || !step || !role || !firebaseUser || explanations[index] !== undefined) return undefined;
    let alive = true;
    setExplaining(true);
    const prompt = `Give me a quick guided tour. I'm on the "${step.title}" screen of Richfield Connect, which ${step.purpose}. `
      + `In no more than two short sentences, tell me what this screen does for me as a ${ROLE_NAMES[role]} `
      + `and the single most useful thing to do here first, using my profile to be specific. No greeting.`;
    sendProfileAssistantMessage(firebaseUser.uid, prompt, [])
      .then((reply) => { if (alive) setExplanations((current) => ({ ...current, [index]: reply.content })); })
      .catch(() => { if (alive) setExplanations((current) => ({ ...current, [index]: `This screen ${step.purpose}.` })); })
      .finally(() => { if (alive) setExplaining(false); });
    return () => { alive = false; };
  }, [active, index, step, role, firebaseUser, explanations]);

  useEffect(() => { setQuestion(''); setAnswer(''); }, [index]);

  async function ask() {
    const text = question.trim();
    if (!text || !firebaseUser || !step || asking) return;
    setAsking(true);
    try {
      const reply = await sendProfileAssistantMessage(firebaseUser.uid, `I'm on the "${step.title}" screen, which ${step.purpose}. ${text}`, []);
      setAnswer(reply.content);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : 'The assistant is unavailable right now.');
    } finally {
      setAsking(false);
    }
  }

  async function finish() {
    setActive(false);
    setDismissed(true);
    try {
      await callFunction<Record<string, never>, { ok: boolean }>('completeTutorial', {});
    } catch (error) {
      console.warn('Could not record tour completion', error);
    }
  }

  const value = useMemo<TutorialState>(() => ({
    start: () => {
      setIndex(0);
      setExplanations({});
      setDismissed(false);
      setActive(true);
    },
  }), []);

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {active && step ? (
        <Portal>
          <View style={styles.layer} pointerEvents="box-none">
            <Card mode="elevated" style={styles.card}>
              <Card.Title
                title={step.title}
                subtitle={`Guided tour · step ${index + 1} of ${steps.length}`}
                left={(props) => <Avatar.Icon {...props} icon={step.icon} />}
                right={() => <IconButton icon="close" onPress={() => void finish()} accessibilityLabel="Skip tour" />}
              />
              <ProgressBar progress={(index + 1) / steps.length} style={styles.progress} />
              <Card.Content style={styles.body}>
                {explaining && explanations[index] === undefined ? (
                  <View style={styles.thinking}>
                    <ActivityIndicator size="small" />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Your assistant is tailoring this step…</Text>
                  </View>
                ) : (
                  <Text variant="bodyLarge">{explanations[index]}</Text>
                )}
                <View style={styles.askRow}>
                  <TextInput
                    mode="outlined"
                    dense
                    placeholder="Ask about this screen…"
                    value={question}
                    onChangeText={setQuestion}
                    onSubmitEditing={() => void ask()}
                    style={styles.askInput}
                  />
                  <IconButton icon="send" mode="contained-tonal" disabled={!question.trim() || asking} onPress={() => void ask()} />
                </View>
                {asking ? <ActivityIndicator size="small" /> : answer ? (
                  <Text variant="bodyMedium" style={[styles.answer, { backgroundColor: theme.colors.surfaceVariant }]}>{answer}</Text>
                ) : null}
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => void finish()}>Skip tour</Button>
                <Button disabled={index === 0} onPress={() => setIndex((i) => Math.max(0, i - 1))}>Back</Button>
                {index < steps.length - 1 ? (
                  <Button mode="contained" icon="arrow-right" contentStyle={styles.nextContent} onPress={() => setIndex((i) => i + 1)}>Next</Button>
                ) : (
                  <Button mode="contained" icon="check" onPress={() => void finish()}>Finish</Button>
                )}
              </Card.Actions>
            </Card>
          </View>
        </Portal>
      ) : null}
    </TutorialContext.Provider>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 72, paddingHorizontal: 12 },
  card: { width: '100%', maxWidth: 520 },
  progress: { marginHorizontal: 16 },
  body: { gap: 10, paddingTop: 12 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  askInput: { flex: 1 },
  answer: { padding: 10, borderRadius: 8 },
  nextContent: { flexDirection: 'row-reverse' },
});
