import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, type LoginInput, type RegisterInput } from '@/api/auth.api';
import { setAccessToken } from '@/api/client';
import type { User } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const queryClient = useQueryClient();

  const applySession = useCallback((payload: { user: User; accessToken: string }) => {
    setAccessToken(payload.accessToken);
    setUser(payload.user);
    setStatus('authenticated');
  }, []);

  // Clearing the session must also drop cached queries: query keys carry
  // no user id, so without this the next user to log in on a shared
  // machine briefly sees the previous user's links and stats.
  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
    queryClient.clear();
  }, [queryClient]);

  // Boot: restore the session from the httpOnly refresh cookie.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await authApi.refresh();
        if (active) applySession(payload);
      } catch {
        if (active) setStatus('unauthenticated');
      }
    })();
    return () => {
      active = false;
    };
  }, [applySession]);

  // The axios interceptor emits this when a refresh fails mid-session.
  useEffect(() => {
    const handler = () => clearSession();
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [clearSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      const payload = await authApi.login(input);
      applySession(payload);
    },
    [applySession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const payload = await authApi.register(input);
      applySession(payload);
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore network errors on logout */
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
