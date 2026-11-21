import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ListUrlParams } from '@/api/urls.api';

interface ToolbarProps {
  filters: Pick<ListUrlParams, 'search' | 'status' | 'sortBy' | 'sortOrder'>;
  onChange: (patch: Partial<ToolbarProps['filters']>) => void;
  onCreate: () => void;
}

export function UrlToolbar({ filters, onChange, onCreate }: ToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search ?? '')) onChange({ search: searchInput || undefined });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative flex-1 lg:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search links…"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(value) => onChange({ status: value as 'all' | 'active' | 'expired' })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={`${filters.sortBy ?? 'createdAt'}:${filters.sortOrder ?? 'desc'}`}
          onValueChange={(value) => {
            const [sortBy, sortOrder] = value.split(':') as [string, 'asc' | 'desc'];
            onChange({ sortBy, sortOrder });
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt:desc">Newest first</SelectItem>
            <SelectItem value="createdAt:asc">Oldest first</SelectItem>
            <SelectItem value="clicks:desc">Most clicks</SelectItem>
            <SelectItem value="clicks:asc">Least clicks</SelectItem>
            <SelectItem value="uniqueVisitors:desc">Most unique visitors</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" /> New link
        </Button>
      </div>
    </div>
  );
}
