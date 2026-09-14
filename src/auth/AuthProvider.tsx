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
      // Per sign-in state. The profile listener fires on every write to the
      // user's document, and the activity heartbeat itself writes to it, so both
      // side effects below must be guarded or they feed each other in a loop.
      let heartbeatSent = false;
      let claimsKey = '';
      unsubscribeProfile = subscribeUserProfile<UserProfile>(
        user.uid,
        (nextProfile) => {
          if (!nextProfile) {
            setProfile(null);
            setProfileError('Your account profile is still being provisioned.');
            // A missing profile can also mean this session belongs to an account
            // that no longer exists (for example after the demo data is re-seeded).
            // A forced refresh fails for deleted accounts; sign out so the member
            // lands on Login instead of a provisioning screen they can't complete.
            void getCurrentUserIdToken(true).catch((error: { code?: string }) => {
              // The auth backend answers a deleted account's refresh with
              // INVALID_REFRESH_TOKEN, which the web SDK reports as invalid-user-token.
              if (['auth/user-not-found', 'auth/user-token-expired', 'auth/user-disabled', 'auth/invalid-user-token'].includes(error?.code ?? '')) {
                console.warn('Signed-in account no longer exists; signing out.', error.code);
                void signOutCurrentUser();
              }
            });
          } else {
            setProfile(nextProfile);
            setProfileError(null);
            // Only refresh the ID token when a claim-backed field changes.
            const status = (nextProfile as { accountStatus?: string }).accountStatus ?? '';
            const nextClaimsKey = `${nextProfile.role}|${nextProfile.isApproved}|${status}`;
            if (nextClaimsKey !== claimsKey) {
              const firstSync = claimsKey === '';
              claimsKey = nextClaimsKey;
              if (!firstSync) {
                void getCurrentUserIdToken(true).catch((error) => {
                  console.warn('Unable to refresh role claims after profile sync', error);
                });
              }
            }
            if (!heartbeatSent) {
              heartbeatSent = true;
              void callFunction<Record<string, never>, { ok: boolean }>('recordUserActivity', {}).catch((error) => console.warn('Activity heartbeat failed', error));
            }
          }
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
