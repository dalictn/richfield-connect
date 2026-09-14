import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';
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
      + `In at most two short sentences (under 45 words), explain what this screen lets me do as a ${ROLE_NAMES[role]} `
      + `and the most useful thing to try here first, drawing on my profile where it's relevant. `
      + `Talk about this screen, not general profile advice. No greeting.`;
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
      const reply = await sendProfileAssistantMessage(firebaseUser.uid, `I'm on the "${step.title}" screen, which ${step.purpose}. Answer briefly: ${text}`, []);
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
          <View testID="tour-layer" style={styles.layer} pointerEvents="box-none">
            {/* A plain View rather than Paper's Card: Card's inner container may
                shrink inside this full-screen layer, letting long AI text spill out. */}
            <View testID="tour-panel" style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
              <View style={styles.header}>
                <Avatar.Icon size={40} icon={step.icon} />
                <View style={styles.headerText}>
                  <Text variant="titleMedium" numberOfLines={1}>{step.title}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Guided tour · step {index + 1} of {steps.length}</Text>
                </View>
                <IconButton icon="close" onPress={() => void finish()} accessibilityLabel="Skip tour" />
              </View>
              {/* Plain track rather than Paper's ProgressBar, which sizes its wrapper to
                  the panel on web and pushes the tour content out of it. */}
              <View style={[styles.progress, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View style={[styles.progressFill, { width: `${Math.round(((index + 1) / steps.length) * 100)}%` as `${number}%`, backgroundColor: theme.colors.primary }]} />
              </View>

              <ScrollView testID="tour-scroll" style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                {explaining && explanations[index] === undefined ? (
                  <View style={styles.thinking}>
                    <ActivityIndicator size="small" />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Your assistant is tailoring this step…</Text>
                  </View>
                ) : (
                  <Text variant="bodyLarge" style={styles.explanation}>{explanations[index]}</Text>
                )}
                {asking ? <ActivityIndicator size="small" style={styles.answerLoading} /> : answer ? (
                  <View style={[styles.answer, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text variant="bodyMedium" style={styles.explanation}>{answer}</Text>
                  </View>
                ) : null}
              </ScrollView>

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
                <IconButton icon="send" mode="contained-tonal" disabled={!question.trim() || asking} onPress={() => void ask()} accessibilityLabel="Ask" />
              </View>

              <View style={styles.actions}>
                <Button onPress={() => void finish()}>Skip tour</Button>
                <View style={styles.spacer} />
                <Button disabled={index === 0} onPress={() => setIndex((i) => Math.max(0, i - 1))}>Back</Button>
                {index < steps.length - 1 ? (
                  <Button mode="contained" icon="arrow-right" contentStyle={styles.nextContent} onPress={() => setIndex((i) => i + 1)}>Next</Button>
                ) : (
                  <Button mode="contained" icon="check" onPress={() => void finish()}>Finish</Button>
                )}
              </View>
            </View>
          </View>
        </Portal>
      ) : null}
    </TutorialContext.Provider>
  );
}

const styles = StyleSheet.create({
  // Sits above the bottom tab bar so the panel never covers navigation.
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 76, paddingHorizontal: 12 },
  panel: {
    width: '100%',
    maxWidth: 520,
    flexShrink: 0,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    shadowColor: '#0B1B4D',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingTop: 12, paddingRight: 4 },
  headerText: { flex: 1 },
  progress: { marginHorizontal: 16, marginTop: 10, height: 4, borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2 },
  // Never shrink: in a height-constrained column the text area would collapse to 0.
  scroll: { maxHeight: 200, flexGrow: 0, flexShrink: 0 },
  body: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  explanation: { lineHeight: 24 },
  answerLoading: { alignSelf: 'flex-start' },
  answer: { padding: 10, borderRadius: 8 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 8, paddingTop: 6 },
  askInput: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 4 },
  spacer: { flex: 1 },
  nextContent: { flexDirection: 'row-reverse' },
});
