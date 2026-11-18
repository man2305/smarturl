import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getErrorMessage, useUrls } from './use-urls';
import { urlsApi } from '@/api/urls.api';
import type { Paginated, ShortUrl } from '@/types';

vi.mock('@/api/urls.api', () => ({
  urlsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const mocked = vi.mocked(urlsApi);

describe('getErrorMessage', () => {
  it('prefers the server message from an axios-style error', () => {
    const err = { response: { data: { message: 'Alias already taken' } } };
    expect(getErrorMessage(err, 'fallback')).toBe('Alias already taken');
  });

  it('falls back to the Error message', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('falls back for unknown shapes', () => {
    expect(getErrorMessage('weird', 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage({}, 'fallback')).toBe('fallback');
    expect(getErrorMessage({ response: { data: {} } }, 'fallback')).toBe('fallback');
  });
});

describe('useUrls', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('fetches the list with the given params', async () => {
    const page: Paginated<ShortUrl> = {
      items: [
        {
          id: '1',
          originalUrl: 'https://example.com',
          shortCode: 'abc123',
          shortUrl: 'http://localhost:5000/abc123',
          isCustom: false,
          clicks: 5,
          uniqueVisitors: 3,
          isActive: true,
          expiresAt: null,
          maxClicks: null,
        },
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    mocked.list.mockResolvedValue(page);

    const { result } = renderHook(() => useUrls({ page: 1, limit: 10, search: 'example' }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocked.list).toHaveBeenCalledWith({ page: 1, limit: 10, search: 'example' });
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].shortCode).toBe('abc123');
    expect(result.current.data?.meta.total).toBe(1);
  });

  it('surfaces fetch errors', async () => {
    mocked.list.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useUrls({ page: 1, limit: 10 }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: 'network down' });
  });
});
