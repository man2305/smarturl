import { MousePointerClick, Users, Link2, Globe2 } from 'lucide-react';
import { AppShell } from '@/components/layout/topbar';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ClicksAreaChart } from '@/components/charts/clicks-area-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { BreakdownList } from '@/components/charts/breakdown-list';
import { useOverview } from '@/hooks/use-analytics';

export default function AnalyticsPage() {
  const { data, isLoading } = useOverview();
  const totalClicks = data?.overview.totalClicks ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description="Cross-link performance for the last 30 days."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MousePointerClick} label="Total clicks" value={totalClicks} loading={isLoading} />
        <StatCard icon={Users} label="Unique visitors" value={data?.overview.totalUniqueVisitors ?? 0} loading={isLoading} />
        <StatCard icon={Link2} label="Active links" value={data?.overview.activeLinks ?? 0} loading={isLoading} />
        <StatCard icon={Globe2} label="Countries reached" value={data?.countries.length ?? 0} loading={isLoading} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Click trends</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ClicksAreaChart data={data?.daily ?? []} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Browsers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? <Skeleton className="h-56 w-full" /> : <DonutChart data={data?.browsers ?? []} title="Browser" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Devices</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <DonutChart data={data?.devices ?? []} title="Device" total={totalClicks} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operating systems</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? <Skeleton className="h-56 w-full" /> : <BreakdownList data={data?.os ?? []} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Countries</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? <Skeleton className="h-56 w-full" /> : <BreakdownList data={data?.countries ?? []} />}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
