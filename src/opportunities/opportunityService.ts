import { callFunction } from '../firebaseApi';
import { collection, getFirestore, onSnapshot, orderBy, query, where } from '@react-native-firebase/firestore';
import type { Opportunity, OpportunityMatch } from '../types/opportunity';
const db = getFirestore();
export function createOpportunity(input: Record<string, unknown>) { return callFunction<Record<string, unknown>, { ok: boolean; opportunityId: string; status: string }>('createOpportunity', input); }
export function reviewOpportunity(opportunityId: string, status: 'approved' | 'rejected' | 'closed') { return callFunction<{ opportunityId: string; status: string }, { ok: boolean }>('reviewOpportunity', { opportunityId, status }); }
export function applyToOpportunity(opportunityId: string) { return callFunction<{ opportunityId: string }, { ok: boolean; status: string }>('applyToOpportunity', { opportunityId }); }
export function recordOpportunityView(opportunityId: string) { return callFunction<{ opportunityId: string }, { ok: boolean }>('recordOpportunityView', { opportunityId }); }
export function recordSkillSearch(skill: string) { return callFunction<{ skill: string }, { ok: boolean }>('recordSkillSearch', { skill }); }
export function subscribeApprovedOpportunities(onNext: (items: Opportunity[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(collection(db, 'opportunities'), where('status', '==', 'approved'), orderBy('createdAt', 'desc')), snap => onNext(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Opportunity, 'id'>) }))), onError);
}
export function subscribePendingOpportunities(onNext: (items: Opportunity[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(collection(db, 'opportunities'), where('status', '==', 'pending'), orderBy('createdAt', 'desc')), snap => onNext(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Opportunity, 'id'>) }))), onError);
}
export function subscribeMyMatches(uid: string, onNext: (items: OpportunityMatch[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(collection(db, 'matches', uid, 'opportunities'), orderBy('score', 'desc')), snap => onNext(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<OpportunityMatch, 'id'>) }))), onError);
}
