import { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('clears the session on the auth:unauthorized event', async () => {
    mocked.refresh.mockResolvedValue({ user, accessToken: 'tok' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});
