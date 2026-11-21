import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero } from './hero';
import { urlsApi } from '@/api/urls.api';
import type { AuthStatus } from '@/context/auth-context';
import type { ShortUrl, User } from '@/types';

const mockAuth = vi.hoisted(() => ({
  status: 'unauthenticated' as AuthStatus,
  user: null as User | null,
}));

vi.mock('@/context/auth-context', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/api/urls.api', () => ({
  urlsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mocked = vi.mocked(urlsApi);

const link: ShortUrl = {
  id: '1',
  originalUrl: 'https://example.com/a/very/long/url',
  shortCode: 'abc1234',
  shortUrl: 'http://localhost:5000/abc1234',
  isCustom: false,
  clicks: 0,
  uniqueVisitors: 0,
  isActive: true,
  expiresAt: null,
  maxClicks: null,
};

function LocationProbe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

describe('Hero', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.status = 'unauthenticated';
    mockAuth.user = null;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function renderHero() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Hero />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  function typeUrl(value: string) {
    fireEvent.change(screen.getByPlaceholderText('https://example.com/a/very/long/url'), {
      target: { value },
    });
  }

  it('disables the button for an invalid URL', () => {
    renderHero();
    typeUrl('not-a-url');
    expect(screen.getByRole('button', { name: /shorten/i })).toBeDisabled();
  });

  it('sends guests to signup instead of fabricating a link', async () => {
    renderHero();
    typeUrl('https://example.com/a/very/long/url');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up to shorten' }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/register'));
    expect(mocked.create).not.toHaveBeenCalled();
    expect(screen.queryByText(/localhost:5000/)).not.toBeInTheDocument();
  });

  it('creates a real link for signed-in users and shows its URL', async () => {
    mockAuth.status = 'authenticated';
    mocked.create.mockResolvedValue(link);
    renderHero();
    typeUrl('https://example.com/a/very/long/url');
    fireEvent.click(screen.getByRole('button', { name: 'Shorten' }));
    await waitFor(() =>
      expect(screen.getByText('http://localhost:5000/abc1234')).toBeInTheDocument()
    );
    expect(mocked.create).toHaveBeenCalledWith({
      originalUrl: 'https://example.com/a/very/long/url',
    });
  });

  it('shows no result when creation fails', async () => {
    mockAuth.status = 'authenticated';
    mocked.create.mockRejectedValue(new Error('network down'));
    renderHero();
    typeUrl('https://example.com/a/very/long/url');
    fireEvent.click(screen.getByRole('button', { name: 'Shorten' }));
    await waitFor(() => expect(mocked.create).toHaveBeenCalled());
    expect(screen.queryByText(/localhost:5000/)).not.toBeInTheDocument();
  });
});
