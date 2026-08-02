import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics.api';

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: analyticsApi.overview,
  });
}

export function useUrlStats(urlId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['analytics', urlId, days],
    queryFn: () => analyticsApi.urlStats(urlId as string, days),
    enabled: Boolean(urlId),
  });
}
