import api from './client';
import type { OverviewData, UrlAnalytics } from '@/types';

export const analyticsApi = {
  async overview(): Promise<OverviewData> {
    const { data } = await api.get('/analytics/overview');
    return data.data as OverviewData;
  },

  async urlStats(id: string, days = 30): Promise<UrlAnalytics> {
    const { data } = await api.get(`/analytics/urls/${id}`, { params: { days } });
    return data.data as UrlAnalytics;
  },
};
