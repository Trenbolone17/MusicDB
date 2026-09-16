import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onSessionEnded, refreshSession, setAccessToken } from '../api/client.js';

const AuthContext = createContext(null);

const LOGGED_OUT = { status: 'anonymous', user: null };

// Holds who is logged in. status is 'loading' until the first refresh answers (so the nav
// doesn't flash "Log in" for someone who is signed in), then 'authenticated' or 'anonymous'.
export function AuthProvider({ children }) {
  const [session, setSession] = useState({ status: 'loading', user: null });
  const queryClient = useQueryClient();

  const applySession = useCallback((result) => {
    setAccessToken(result?.accessToken ?? null);
    setSession(result?.user ? { status: 'authenticated', user: result.user } : LOGGED_OUT);
  }, []);

  useEffect(() => {
    let active = true;
    refreshSession()
      .then((result) => active && applySession(result))
      .catch(() => active && applySession(null));
    const unsubscribe = onSessionEnded(() => applySession(null));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [applySession]);

  const value = useMemo(
    () => ({
      ...session,
      async login(credentials) {
        applySession(await api('/auth/login', { method: 'POST', body: credentials }));
      },
      async signup(fields) {
        applySession(await api('/auth/signup', { method: 'POST', body: fields }));
      },
      // After the profile changes (name, picture), keep the nav and pages in step.
      setUser(user) {
        setSession({ status: 'authenticated', user });
      },
      // After the password changes, the server issues new tokens; keep using them.
      setAccessToken,
      async logout() {
        // Even if the request fails, forget the session locally.
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        applySession(null);
        // Drop cached responses that may have been fetched as this user.
        queryClient.clear();
      },
    }),
    [session, applySession, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
