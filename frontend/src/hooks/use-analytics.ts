import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics.api';

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: analyticsApi.overview,
    refetchInterval: 20_000,
  });
}

export function useUrlStats(urlId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['analytics', urlId, days],
    queryFn: () => analyticsApi.urlStats(urlId as string, days),
    enabled: Boolean(urlId),
    // Keep the previous range visible while the new one loads instead of
    // flashing a full-page skeleton on every 7/30/90 switch.
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });
}
