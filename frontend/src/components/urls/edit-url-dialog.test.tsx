import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditUrlDialog } from './edit-url-dialog';
import type { ShortUrl } from '@/types';

const mockMutation = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('@/hooks/use-urls', () => ({
  useUpdateUrl: () => mockMutation,
}));

const expiredLink: ShortUrl = {
  id: '1',
  originalUrl: 'https://example.com',
  shortCode: 'abc1234',
  shortUrl: 'http://localhost:5000/abc1234',
  isCustom: false,
  clicks: 5,
  uniqueVisitors: 3,
  isActive: true,
  expiresAt: '2020-01-01T00:00:00.000Z',
  maxClicks: null,
};

describe('EditUrlDialog expiry validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation.mutateAsync.mockResolvedValue(undefined);
  });

  function renderDialog(url: ShortUrl = expiredLink) {
    return render(<EditUrlDialog url={url} open onOpenChange={vi.fn()} />);
  }

  function save() {
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  }

  it('lets an already-expired link be saved without touching its expiry', async () => {
    renderDialog();
    save();
    await waitFor(() => expect(mockMutation.mutateAsync).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Expiry must be a future date')).not.toBeInTheDocument();
  });

  it('rejects a newly entered past expiry', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Expires on'), {
      target: { value: '2021-06-01T10:00' },
    });
    save();
    await waitFor(() =>
      expect(screen.getByText('Expiry must be a future date')).toBeInTheDocument()
    );
    expect(mockMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('accepts a newly entered future expiry', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Expires on'), {
      target: { value: '2999-06-01T10:00' },
    });
    save();
    await waitFor(() => expect(mockMutation.mutateAsync).toHaveBeenCalledTimes(1));
  });
});
