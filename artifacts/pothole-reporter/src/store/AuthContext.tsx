import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetCurrentUser,
  useSignUp,
  useLogIn,
  useLogOut,
  getGetCurrentUserQueryKey,
  getListPotholesQueryKey,
  type User,
} from '@workspace/api-client-react';

interface AuthStore {
  /** The signed-in user, or null when browsing anonymously. */
  user: User | null;
  /** True only while the very first "who am I" call is in flight. */
  isLoading: boolean;
  isSignedIn: boolean;
  isSubmitting: boolean;
  signUp: (params: { email: string; password: string; displayName: string }) => Promise<void>;
  logIn: (params: { email: string; password: string }) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthStore | null>(null);

/**
 * Reading PatchWork never requires an account, so being signed out is a
 * perfectly normal state here rather than an error to recover from. This
 * provider exists to answer "can this person write?", not to gate the app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetCurrentUser({
    query: {
      // The generated option type demands queryKey even though the hook
      // supplies its own default; passing the generator's own key is the
      // no-op that satisfies it.
      queryKey: getGetCurrentUserQueryKey(),
      // An anonymous visitor is a valid answer, so a failure here means the
      // server is unreachable, not that the session is bad — retrying twice
      // and then settling on "signed out" is the right shape.
      retry: 1,
      staleTime: 60_000,
    },
  });

  const user = data?.user ?? null;

  // Both the session and the data it lets you write change on sign-in and
  // sign-out, so refresh both rather than leaving a stale list behind. On sign
  // out that matters for a different reason: cached confirm state belongs to
  // the person who just left.
  const refreshAuthAndData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListPotholesQueryKey() }),
    ]);
  }, [queryClient]);

  const signUpMutation = useSignUp();
  const logInMutation = useLogIn();
  const logOutMutation = useLogOut();

  const signUp = useCallback(
    async (params: { email: string; password: string; displayName: string }) => {
      await signUpMutation.mutateAsync({ data: params });
      await refreshAuthAndData();
    },
    [signUpMutation, refreshAuthAndData],
  );

  const logIn = useCallback(
    async (params: { email: string; password: string }) => {
      await logInMutation.mutateAsync({ data: params });
      await refreshAuthAndData();
    },
    [logInMutation, refreshAuthAndData],
  );

  const logOut = useCallback(async () => {
    await logOutMutation.mutateAsync();
    await refreshAuthAndData();
  }, [logOutMutation, refreshAuthAndData]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isSignedIn: user !== null,
      isSubmitting:
        signUpMutation.isPending || logInMutation.isPending || logOutMutation.isPending,
      signUp,
      logIn,
      logOut,
    }),
    [
      user,
      isLoading,
      signUpMutation.isPending,
      logInMutation.isPending,
      logOutMutation.isPending,
      signUp,
      logIn,
      logOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
