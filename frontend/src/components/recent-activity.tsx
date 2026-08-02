import { formatDistanceToNow } from 'date-fns';
import { MonitorSmartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/empty-state';
import type { OverviewData } from '@/types';

export function RecentActivity({ data, loading }: { data?: OverviewData; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data?.recentActivity?.length ? (
          <EmptyState
            icon={MonitorSmartphone}
            title="No clicks yet"
            description="When someone visits your links, their activity will show up here."
            className="py-10"
          />
        ) : (
          <ul className="space-y-1">
            {data.recentActivity.slice(0, 6).map((item, i) => (
              <li
                key={`${item.clickedAt}-${i}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{item.browser.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.shortCode}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.browser} · {item.os} · {item.country}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.clickedAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
