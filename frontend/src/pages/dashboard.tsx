import { useState } from 'react';
import { BarChart3, Link2, MousePointerClick, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/topbar';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateUrlDialog } from '@/components/urls/create-url-dialog';
import { EditUrlDialog } from '@/components/urls/edit-url-dialog';
import { DeleteUrlDialog } from '@/components/urls/delete-url-dialog';
import { UrlTable } from '@/components/urls/url-table';
import { UrlToolbar } from '@/components/urls/url-toolbar';
import { Pagination } from '@/components/pagination';
import { RecentActivity } from '@/components/recent-activity';
import { useUrls } from '@/hooks/use-urls';
import { useOverview } from '@/hooks/use-analytics';
import type { ShortUrl } from '@/types';

export default function DashboardPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [filters, setFilters] = useState<{
    search?: string;
    status?: 'all' | 'active' | 'expired';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }>({ status: 'all', sortBy: 'createdAt', sortOrder: 'desc' });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ShortUrl | null>(null);
  const [deleting, setDeleting] = useState<ShortUrl | null>(null);

  const urlsQuery = useUrls({ page, limit, ...filters });
  const overviewQuery = useOverview();

  const handleFilterChange = (patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const stats = overviewQuery.data?.overview;

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Monitor your links, clicks and visitor growth."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MousePointerClick} label="Total clicks" value={stats?.totalClicks ?? 0} loading={overviewQuery.isLoading} />
        <StatCard icon={Users} label="Unique visitors" value={stats?.totalUniqueVisitors ?? 0} loading={overviewQuery.isLoading} />
        <StatCard icon={Link2} label="Active links" value={stats?.activeLinks ?? 0} loading={overviewQuery.isLoading} />
        <StatCard icon={BarChart3} label="Total links" value={stats?.totalLinks ?? 0} loading={overviewQuery.isLoading} />
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your links</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <UrlToolbar
            filters={filters}
            onChange={handleFilterChange}
            onCreate={() => setCreateOpen(true)}
          />
          <UrlTable
            urls={urlsQuery.data?.items ?? []}
            loading={urlsQuery.isLoading}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
          <div className="mt-4">
            <Pagination
              page={urlsQuery.data?.meta.page ?? page}
              totalPages={urlsQuery.data?.meta.totalPages ?? 1}
              total={urlsQuery.data?.meta.total ?? 0}
              onChange={setPage}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity data={overviewQuery.data} loading={overviewQuery.isLoading} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top performing links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {overviewQuery.isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  </div>
                ))
              : overviewQuery.data?.topLinks.slice(0, 4).map((link, i) => (
                  <a
                    key={link.id}
                    href={`/links/${link.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono-code text-sm font-medium">{link.shortCode}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {link.originalUrl.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">{link.clicks.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">#{i + 1}</p>
                    </div>
                  </a>
                ))}
          </CardContent>
        </Card>
      </div>

      <CreateUrlDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUrlDialog url={editing} open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} />
      <DeleteUrlDialog url={deleting} open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)} />
    </AppShell>
  );
}
