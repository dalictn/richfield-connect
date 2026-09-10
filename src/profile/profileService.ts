import { callFunction, subscribeUserProfile } from '../firebaseApi';
import type { CvExtractionResult, EditablePortfolioProfile, PortfolioProfile, ProfileAssistantMessage, ProfileCompleteness, VisibleProfile } from '../types/portfolio';
import { normaliseVisibility } from '../types/portfolio';

export class ProfileDomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProfileDomainError';
    this.code = code;
  }
}

function assertText(value: unknown, field: string, maxLength: number): string {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) throw new ProfileDomainError('invalid-argument', `${field} is too long.`);
  return text;
}

function normaliseProfilePatch(patch: EditablePortfolioProfile): EditablePortfolioProfile {
  const skills = Array.from(new Set(patch.skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean))).slice(0, 50);
  if (skills.some((skill) => skill.length > 80)) throw new ProfileDomainError('invalid-argument', 'Each skill must be 80 characters or fewer.');
  if (patch.qualifications.length > 20 || patch.workExperience.length > 20) {
    throw new ProfileDomainError('invalid-argument', 'Too many portfolio entries.');
  }
  // Deliberately a pass-through for the structured lists: the callable owns
  // validation, and duplicating those rules here only creates two places for
  // them to drift. This trims the cheap things and normalises visibility.
  return {
    ...patch,
    displayName: assertText(patch.displayName, 'Display name', 120),
    headline: assertText(patch.headline, 'Headline', 180),
    summary: assertText(patch.summary, 'Summary', 2000),
    skills,
    careerInterests: Array.from(new Set((patch.careerInterests ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean))).slice(0, 20),
    visibility: normaliseVisibility(patch.visibility),
  };
}

export function subscribePortfolio(uid: string, onData: (profile: PortfolioProfile | null) => void, onError: (error: Error) => void): () => void {
  return subscribeUserProfile<PortfolioProfile>(uid, onData, onError);
}

export async function savePortfolio(uid: string, patch: EditablePortfolioProfile): Promise<void> {
  try {
    const clean = normaliseProfilePatch(patch);
    await callFunction<EditablePortfolioProfile, { ok: true }>('upsertPortfolioProfile', clean);
  } catch (error) {
    if (error instanceof ProfileDomainError) throw error;
    console.error('savePortfolio failed', error);
    throw new ProfileDomainError('profile-save-failed', 'We could not save your profile. Please try again.');
  }
}

export async function completeOnboarding(): Promise<void> {
  try {
    await callFunction<Record<string, never>, { ok: true }>('completeOnboarding', {});
  } catch (error) {
    console.error('completeOnboarding failed', error);
    throw new ProfileDomainError('onboarding-failed', 'We could not complete onboarding. Please try again.');
  }
}

export async function endorseSkill(targetUid: string, skill: string): Promise<void> {
  try {
    await callFunction<{ targetUid: string; skill: string }, { ok: true }>('endorseSkill', { targetUid, skill: skill.trim().toLowerCase() });
  } catch (error) {
    console.error('endorseSkill failed', error);
    throw new ProfileDomainError('endorsement-failed', 'The skill endorsement could not be completed.');
  }
}

export async function calculateProfileCompleteness(uid: string): Promise<ProfileCompleteness> {
  try {
    return await callFunction<{ uid: string }, ProfileCompleteness>('evaluateProfileCompleteness', { uid });
  } catch (error) {
    console.error('calculateProfileCompleteness failed', error);
    throw new ProfileDomainError('completeness-failed', 'Profile completeness is temporarily unavailable.');
  }
}

export async function extractCvFromText(text: string): Promise<CvExtractionResult> {
  try {
    if (text.trim().length < 80) throw new ProfileDomainError('invalid-cv', 'Please provide enough CV text for meaningful extraction.');
    if (text.length > 30000) throw new ProfileDomainError('invalid-cv', 'CV text exceeds the 30,000 character limit.');
    return await callFunction<{ text: string }, CvExtractionResult>('extractCvProfile', { text });
  } catch (error) {
    if (error instanceof ProfileDomainError) throw error;
    console.error('extractCvFromText failed', error);
    throw new ProfileDomainError('cv-extraction-failed', 'We could not analyse this CV. Please try again.');
  }
}

export async function getVisibleProfile(targetUid: string): Promise<VisibleProfile> {
  try {
    return await callFunction<{ targetUid: string }, VisibleProfile>('getVisibleProfile', { targetUid });
  } catch (error) {
    console.error('getVisibleProfile failed', error);
    throw new ProfileDomainError('profile-read-failed', 'We could not load this profile.');
  }
}

export async function sendProfileAssistantMessage(uid: string, message: string, history: ProfileAssistantMessage[]): Promise<ProfileAssistantMessage> {
  try {
    const cleanMessage = message.trim();
    if (!cleanMessage || cleanMessage.length > 2000) throw new ProfileDomainError('invalid-message', 'Message must contain 1–2,000 characters.');
    const result = await callFunction<{ message: string; history: Array<{ role: 'user' | 'assistant'; content: string }>; uid: string }, { reply: string }>('profileAssistant', {
      uid,
      message: cleanMessage,
      history: history.slice(-12).map(({ role, content }) => ({ role, content })),
    });
    return { id: `${Date.now()}-assistant`, role: 'assistant', content: result.reply, createdAt: Date.now() };
  } catch (error) {
    if (error instanceof ProfileDomainError) throw error;
    console.error('sendProfileAssistantMessage failed', error);
    throw new ProfileDomainError('assistant-failed', 'The profile assistant is temporarily unavailable.');
  }
}

export async function writeRecommendation(targetUid: string, relationship: string, body: string): Promise<{ updated: boolean }> {
  const text = body.trim();
  if (text.length < 40) throw new ProfileDomainError('invalid-recommendation', 'A recommendation must be at least 40 characters.');
  if (text.length > 2000) throw new ProfileDomainError('invalid-recommendation', 'A recommendation must be 2,000 characters or fewer.');
  try {
    return await callFunction<{ targetUid: string; relationship: string; body: string }, { ok: true; updated: boolean }>(
      'writeRecommendation', { targetUid, relationship: relationship.trim(), body: text },
    );
  } catch (error) {
    if (error instanceof ProfileDomainError) throw error;
    console.error('writeRecommendation failed', error);
    throw new ProfileDomainError('recommendation-failed', 'We could not save this recommendation.');
  }
}

export async function removeRecommendation(targetUid: string, authorUid: string): Promise<void> {
  try {
    await callFunction<{ targetUid: string; authorUid: string }, { ok: true }>('removeRecommendation', { targetUid, authorUid });
  } catch (error) {
    console.error('removeRecommendation failed', error);
    throw new ProfileDomainError('recommendation-failed', 'We could not remove this recommendation.');
  }
}
