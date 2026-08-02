import api from './client';
import type { Paginated, ShortUrl } from '@/types';

export interface CreateUrlInput {
  originalUrl: string;
  customAlias?: string;
  expiresAt?: string;
  maxClicks?: number;
}

export interface UpdateUrlInput {
  originalUrl?: string;
  customAlias?: string;
  expiresAt?: string | null;
  maxClicks?: number | null;
  isActive?: boolean;
}

export interface ListUrlParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'all' | 'active' | 'expired';
}

export const urlsApi = {
  async list(params: ListUrlParams): Promise<Paginated<ShortUrl>> {
    const { data } = await api.get('/urls', { params });
    return { items: data.data as ShortUrl[], meta: data.meta as Paginated<ShortUrl>['meta'] };
  },

  async create(input: CreateUrlInput): Promise<ShortUrl> {
    const { data } = await api.post('/urls', input);
    return data.data as ShortUrl;
  },

  async get(id: string): Promise<ShortUrl> {
    const { data } = await api.get(`/urls/${id}`);
    return data.data as ShortUrl;
  },

  async update(id: string, input: UpdateUrlInput): Promise<ShortUrl> {
    const { data } = await api.patch(`/urls/${id}`, input);
    return data.data as ShortUrl;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/urls/${id}`);
  },
};
