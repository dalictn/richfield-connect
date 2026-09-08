import { callFunction } from './firebaseApi';
import type { StudentAnalytics, BusinessAnalytics, AdminAnalytics } from './types/analytics';
export const getStudentAnalytics = () => callFunction<Record<string, never>, StudentAnalytics>('getStudentAnalytics', {});
export const getBusinessAnalytics = () => callFunction<Record<string, never>, BusinessAnalytics>('getBusinessAnalytics', {});
export const getAdminAnalytics = () => callFunction<Record<string, never>, AdminAnalytics>('getAdminAnalytics', {});
export const recordProfileView = (profileUid: string) => callFunction<{ profileUid: string }, { ok: boolean }>('recordProfileView', { profileUid });
