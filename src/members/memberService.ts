import { useEffect, useState } from 'react';
import { callFunction } from '../firebaseApi';

export interface MemberSummary {
  uid: string;
  displayName: string;
  role: string;
  headline: string;
  companyName: string;
  avatarUrl: string;
}

/**
 * Other members' profile documents are unreadable from the client, so lists that
 * only hold uids (requests, connections, conversations) resolve names through a
 * callable. Results are cached for the session because names rarely change.
 */
const cache = new Map<string, MemberSummary>();

export async function lookupMembers(uids: string[]): Promise<Record<string, MemberSummary>> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const missing = unique.filter((uid) => !cache.has(uid));
  for (let i = 0; i < missing.length; i += 100) {
    const response = await callFunction<{ uids: string[] }, { members: MemberSummary[] }>('lookupMembers', { uids: missing.slice(i, i + 100) });
    for (const member of response.members) cache.set(member.uid, member);
  }
  return Object.fromEntries(unique.filter((uid) => cache.has(uid)).map((uid) => [uid, cache.get(uid)!]));
}

export function useMembers(uids: string[]): Record<string, MemberSummary> {
  const key = Array.from(new Set(uids.filter(Boolean))).sort().join('|');
  const [members, setMembers] = useState<Record<string, MemberSummary>>(() =>
    Object.fromEntries(key ? key.split('|').filter((uid) => cache.has(uid)).map((uid) => [uid, cache.get(uid)!]) : []),
  );

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    lookupMembers(key.split('|'))
      .then((result) => { if (alive) setMembers(result); })
      .catch((error) => console.warn('Member lookup failed', error));
    return () => { alive = false; };
  }, [key]);

  return members;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  alumni: 'Alumnus',
  business: 'Employer',
  administrator: 'Richfield staff',
};
