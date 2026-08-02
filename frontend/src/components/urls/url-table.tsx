import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  BarChart3,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  QrCode,
  Trash2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/copy-button';
import { QrDialog } from '@/components/qr-dialog';
import { EmptyState } from '@/components/empty-state';
import type { ShortUrl } from '@/types';
import { Link2, MousePointerClick } from 'lucide-react';

function StatusBadge({ url }: { url: ShortUrl }) {
  if (!url.isActive) {
    return <Badge variant="warning">Expired</Badge>;
  }
  if (url.expiresAt && new Date(url.expiresAt).getTime() <= Date.now()) {
    return <Badge variant="warning">Expired</Badge>;
  }
  return <Badge variant="success">Active</Badge>;
}

function RowActions({
  url,
  onEdit,
  onDelete,
}: {
  url: ShortUrl;
  onEdit: (url: ShortUrl) => void;
  onDelete: (url: ShortUrl) => void;
}) {
  const navigate = useNavigate();
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Row actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate(`/links/${url.id}`)}>
            <BarChart3 className="mr-2" /> Analytics
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQrOpen(true)}>
            <QrCode className="mr-2" /> QR code
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(url)}>
            <Pencil className="mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(url)}
          >
            <Trash2 className="mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <QrDialog open={qrOpen} onOpenChange={setQrOpen} value={url.shortUrl} shortUrl={url.shortUrl} />
    </>
  );
}

export function UrlTable({
  urls,
  loading,
  onEdit,
  onDelete,
}: {
  urls: ShortUrl[];
  loading: boolean;
  onEdit: (url: ShortUrl) => void;
  onDelete: (url: ShortUrl) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (urls.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No links yet"
        description="Create your first short link to start tracking clicks and visitors."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Short link</TableHead>
          <TableHead className="hidden md:table-cell">Original URL</TableHead>
          <TableHead className="text-right">Clicks</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Unique</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Expires</TableHead>
          <TableHead className="hidden xl:table-cell">Created</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {urls.map((url) => (
          <TableRow key={url.id}>
            <TableCell className="max-w-[200px]">
              <div className="flex items-center gap-1.5">
                <a
                  href={url.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono-code text-sm text-primary hover:underline"
                  title={url.shortUrl}
                >
                  {url.shortCode}
                </a>
                <CopyButton value={url.shortUrl} className="h-7 w-7" />
              </div>
            </TableCell>
            <TableCell className="hidden max-w-[240px] md:table-cell">
              <a
                href={url.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 truncate text-muted-foreground hover:text-foreground"
                title={url.originalUrl}
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{url.originalUrl.replace(/^https?:\/\//, '')}</span>
              </a>
            </TableCell>
            <TableCell className="text-right font-medium">
              <span className="inline-flex items-center gap-1">
                <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                {url.clicks.toLocaleString()}
              </span>
            </TableCell>
            <TableCell className="hidden text-right sm:table-cell">{url.uniqueVisitors.toLocaleString()}</TableCell>
            <TableCell>
              <StatusBadge url={url} />
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
              {url.expiresAt ? format(new Date(url.expiresAt), 'MMM d, yyyy') : 'Never'}
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
              {url.createdAt ? format(new Date(url.createdAt), 'MMM d, yyyy') : '—'}
            </TableCell>
            <TableCell>
              <RowActions url={url} onEdit={onEdit} onDelete={onDelete} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
