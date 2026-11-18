import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getErrorMessage,
  useCreateUrl,
  useDeleteUrl,
  useUpdateUrl,
  useUrls,
} from './use-urls';
import { urlsApi } from '@/api/urls.api';
import type { Paginated, ShortUrl } from '@/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

  it('surfaces field-level validation errors instead of the generic message', () => {
    const err = {
      response: {
        data: {
          message: 'Validation failed',
          errors: [
            { field: 'originalUrl', message: 'Enter a valid URL' },
            { field: 'customAlias', message: 'Alias already taken' },
          ],
        },
      },
    };
    expect(getErrorMessage(err, 'fallback')).toBe('Enter a valid URL; Alias already taken');
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

describe('mutations invalidate the right queries', () => {
  let queryClient: QueryClient;

  const link: ShortUrl = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Seed the caches the mutations must invalidate.
    queryClient.setQueryData(['urls'], { items: [], meta: {} });
    queryClient.setQueryData(['overview'], {});
    queryClient.setQueryData(['analytics', '1'], {});
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  function invalidated(key: unknown[]) {
    return queryClient.getQueryState(key)?.isInvalidated === true;
  }

  it('create invalidates urls + overview', async () => {
    mocked.create.mockResolvedValue(link);
    const { result } = renderHook(() => useCreateUrl(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ originalUrl: 'https://example.com' });
    });
    expect(invalidated(['urls'])).toBe(true);
    expect(invalidated(['overview'])).toBe(true);
  });

  it('update invalidates urls + overview + the link analytics', async () => {
    mocked.update.mockResolvedValue(link);
    const { result } = renderHook(() => useUpdateUrl(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: '1', input: { isActive: false } });
    });
    expect(invalidated(['urls'])).toBe(true);
    expect(invalidated(['overview'])).toBe(true);
    expect(invalidated(['analytics', '1'])).toBe(true);
  });

  it('delete invalidates urls + overview + the link analytics', async () => {
    mocked.remove.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteUrl(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('1');
    });
    expect(invalidated(['urls'])).toBe(true);
    expect(invalidated(['overview'])).toBe(true);
    expect(invalidated(['analytics', '1'])).toBe(true);
  });
});
