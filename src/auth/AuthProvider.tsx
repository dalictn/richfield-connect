import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ClientUser } from '../firebaseApi';
import { callFunction, currentUser, getCurrentUserIdToken, signOutCurrentUser, subscribeAuth, subscribeUserProfile } from '../firebaseApi';
import type { UserProfile } from '../types/auth';

type AuthState = {
  loading: boolean;
  firebaseUser: ClientUser | null;
  profile: UserProfile | null;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<ClientUser | null>(currentUser());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const user = currentUser();
    if (!user) {
      setProfile(null);
      return;
    }
    await getCurrentUserIdToken(true);
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = subscribeAuth((user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      setFirebaseUser(user);
      setProfileError(null);

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeProfile = subscribeUserProfile<UserProfile>(
        user.uid,
        (nextProfile) => {
          if (!nextProfile) {
            setProfile(null);
            setProfileError('Your account profile is still being provisioned.');
          } else {
            setProfile(nextProfile);
            setProfileError(null);
            void getCurrentUserIdToken(true).catch((error) => {
              console.warn('Unable to refresh role claims after profile sync', error);
            });
          }
          void callFunction<Record<string, never>, { ok: boolean }>('recordUserActivity', {}).catch((error) => console.warn('Activity heartbeat failed', error));
          setLoading(false);
        },
        (error) => {
          console.error('User profile listener failed', error);
          setProfileError('We could not synchronise your account profile.');
          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error('Sign out failed', error);
      throw error;
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, firebaseUser, profile, profileError, refreshProfile, logout }),
    [loading, firebaseUser, profile, profileError, refreshProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
