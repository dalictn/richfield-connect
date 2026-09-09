import { createHash } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb as db } from './firebaseAdmin';
import { runAi, AI_API_KEY } from './ai';
import { APP_CHECK_ENFORCEMENT } from './appCheck';

const REGION = 'africa-south1';
const MAX_TEXT = 30000;

function requireSignedIn(request: { auth?: { uid?: string | null } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}

function cleanJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? raw).trim();
}

function parseResult(raw: string, sourceTextHash: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch {
    throw new HttpsError('internal', 'The CV analysis returned an invalid structured response.');
  }
  if (!parsed || typeof parsed !== 'object') throw new HttpsError('internal', 'The CV analysis returned an invalid response.');
  const item = parsed as Record<string, unknown>;
  const skills = Array.isArray(item.skills) ? Array.from(new Set(item.skills.map(String).map((x) => x.trim().toLowerCase()).filter(Boolean))).slice(0, 50) : [];
  const qualifications = Array.isArray(item.qualifications) ? item.qualifications.slice(0, 20).map((q) => {
    const row = (q ?? {}) as Record<string, unknown>;
    return { title: String(row.title ?? '').trim().slice(0, 160), institution: String(row.institution ?? '').trim().slice(0, 160), yearCompleted: Number(row.yearCompleted) || 0 };
  }).filter((q) => q.title && q.institution) : [];
  const workExperience = Array.isArray(item.workExperience) ? item.workExperience.slice(0, 20).map((q) => {
    const row = (q ?? {}) as Record<string, unknown>;
    return { company: String(row.company ?? '').trim().slice(0, 160), role: String(row.role ?? '').trim().slice(0, 160), startDate: String(row.startDate ?? '').trim().slice(0, 30), endDate: row.endDate ? String(row.endDate).trim().slice(0, 30) : undefined, description: String(row.description ?? '').trim().slice(0, 1000) };
  }).filter((q) => q.company && q.role && q.description) : [];
  const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
  return {
    headline: String(item.headline ?? '').trim().slice(0, 180),
    summary: String(item.summary ?? '').trim().slice(0, 2000),
    skills,
    qualifications,
    workExperience,
    confidence,
    sourceTextHash,
  };
}

const SYSTEM_PROMPT = `You are Richfield Connect's CV-to-portfolio extraction engine. Extract only information explicitly supported by the supplied CV text. Never invent dates, employers, qualifications, skills, URLs, identities, or achievements. Return ONLY valid JSON with this exact shape: {"headline":string,"summary":string,"skills":string[],"qualifications":[{"title":string,"institution":string,"yearCompleted":number}],"workExperience":[{"company":string,"role":string,"startDate":string,"endDate":string|null,"description":string}],"confidence":number}. Confidence is 0..1 and represents extraction confidence, not candidate quality. Keep the summary professional and concise.`;

export const extractCvProfile = onCall({
  region: REGION,
  ...APP_CHECK_ENFORCEMENT,
  secrets: [AI_API_KEY],
}, async (request) => {
  try {
    const uid = requireSignedIn(request);
    const profileSnap = await db.collection('users').doc(uid).get();
    if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'User profile is not provisioned.');
    const text = String(request.data?.text ?? '').trim();
    if (text.length < 80) throw new HttpsError('invalid-argument', 'Provide at least 80 characters of CV text.');
    if (text.length > MAX_TEXT) throw new HttpsError('invalid-argument', `CV text must not exceed ${MAX_TEXT} characters.`);

    const hash = createHash('sha256').update(text).digest('hex');
    const raw = await runAi([{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }], 2200);
    const result = parseResult(raw, hash);
    await db.collection('users').doc(uid).set({
      lastCvExtraction: { sourceTextHash: hash, confidence: result.confidence, extractedAt: Date.now() },
      updatedAt: Date.now(),
    }, { merge: true });
    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('extractCvProfile failed', error instanceof Error ? error.message : 'unknown error');
    throw new HttpsError('internal', 'CV extraction is temporarily unavailable.');
  }
});
