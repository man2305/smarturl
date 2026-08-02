import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ExternalLink, Link2, MousePointerClick, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/topbar';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopyButton } from '@/components/copy-button';
import { QrDialog } from '@/components/qr-dialog';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { ClicksAreaChart } from '@/components/charts/clicks-area-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { BreakdownList } from '@/components/charts/breakdown-list';
import { useUrlStats } from '@/hooks/use-analytics';

export default function LinkDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [days, setDays] = useState(30);
  const [qrOpen, setQrOpen] = useState(false);

  const { data, isLoading } = useUrlStats(id, days);

  if (isLoading) {
    return (
      <AppShell>
        <PageHeader title="Loading…" />
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <EmptyState
          icon={Link2}
          title="Link not found"
          description="This link may have been deleted or you don't have access to it."
          action={
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const url = data.url;
  const avgPerDay = days > 0 ? Math.round(data.totalClicks / days) : 0;

  return (
    <AppShell>
      <PageHeader
        title="Link analytics"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="max-w-[320px] truncate text-muted-foreground md:max-w-md">{url.originalUrl}</span>
            {url.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="warning">Expired</Badge>}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" /> Dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
              QR code
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={url.shortUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate font-mono-code text-lg text-primary hover:underline"
            >
              {url.shortUrl}
            </a>
            <CopyButton value={url.shortUrl} />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              Expires {url.expiresAt ? new Date(url.expiresAt).toLocaleDateString() : 'never'}
            </span>
            <a href={url.originalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              Open <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-1 flex-1 gap-4 sm:grid-cols-3">
          <StatCard icon={MousePointerClick} label="Total clicks" value={data.totalClicks} />
          <StatCard icon={Users} label="Unique visitors" value={url.uniqueVisitors} />
          <StatCard icon={CalendarDays} label="Avg clicks / day" value={avgPerDay} />
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-36 sm:mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Click trends</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ClicksAreaChart data={data.daily} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Browsers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DonutChart data={data.browsers} title="Browser" total={data.totalClicks} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Devices</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DonutChart data={data.devices} title="Device" total={data.totalClicks} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operating systems</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BreakdownList data={data.os} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referrers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BreakdownList data={data.referrers} />
          </CardContent>
        </Card>
      </div>

      <QrDialog open={qrOpen} onOpenChange={setQrOpen} value={url.shortUrl} shortUrl={url.shortUrl} />
    </AppShell>
  );
}
