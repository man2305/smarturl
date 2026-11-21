import { useState, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth-context';
import { authApi } from '@/api/auth.api';
import type { User } from '@/types';

vi.mock('@/api/auth.api', () => ({
  authApi: {
    refresh: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

const mocked = vi.mocked(authApi);

const user: User = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  isEmailVerified: false,
};

function Probe() {
  const { user: current, status, login, register, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{current?.email ?? 'none'}</span>
      {error && <span data-testid="error">{error}</span>}
      <button onClick={() => login({ email: 'a@b.com', password: 'pw' }).catch(() => setError('login failed'))}>
        login
      </button>
      <button
        onClick={() => register({ name: 'N', email: 'a@b.com', password: 'pw' }).catch(() => setError('register failed'))}
      >
        register
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

let queryClient: QueryClient;

function renderProvider() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('restores the session on boot when refresh succeeds', async () => {
    mocked.refresh.mockResolvedValue({ user, accessToken: 'tok' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  it('becomes unauthenticated on boot when refresh fails', async () => {
    mocked.refresh.mockRejectedValue(new Error('no session'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('authenticates on login', async () => {
    mocked.refresh.mockRejectedValue(new Error('no session'));
    mocked.login.mockResolvedValue({ user, accessToken: 'tok' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  it('stays unauthenticated when login fails', async () => {
    mocked.refresh.mockRejectedValue(new Error('no session'));
    mocked.login.mockRejectedValue(new Error('bad credentials'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('login failed'));
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });

  it('authenticates on register', async () => {
    mocked.refresh.mockRejectedValue(new Error('no session'));
    mocked.register.mockResolvedValue({ user, accessToken: 'tok' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    fireEvent.click(screen.getByText('register'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
  });

  it('clears the session on logout', async () => {
    mocked.refresh.mockResolvedValue({ user, accessToken: 'tok' });
    mocked.logout.mockResolvedValue(undefined);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(mocked.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('clears the session even when the logout request fails', async () => {
    mocked.refresh.mockResolvedValue({ user, accessToken: 'tok' });
    mocked.logout.mockRejectedValue(new Error('network down'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });

  it('clears cached queries on logout', async () => {
    mocked.refresh.mockResolvedValue({ user, accessToken: 'tok' });
    mocked.logout.mockResolvedValue(undefined);
    queryClient.setQueryData(['urls', { page: 1 }], { items: [], meta: {} });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(queryClient.getQueryCache().findAll()).toHaveLength(1);
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    // Without this, the next user on a shared machine briefly sees the
    // previous user's cached links and stats.
    expect(queryClient.getQueryCache().findAll()).toHaveLength(0);
  });

  it('clears the session on the auth:unauthorized event', async () => {
    mocked.refresh.mockResolvedValue({ user, accessToken: 'tok' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});
