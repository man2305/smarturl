import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/empty-state';
import { BarChart2 } from 'lucide-react';
import type { DimensionItem } from '@/types';

/**
 * Ranked horizontal breakdown (browsers, OS, referrers, ...) rendered as
 * progress bars scaled to the top value.
 */
export function BreakdownList({ data, unit = 'clicks' }: { data: DimensionItem[]; unit?: string }) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        title="No data yet"
        description="This breakdown will populate as clicks arrive."
        className="h-48 py-8"
      />
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-4">
      {data.map((item) => {
        const percent = Math.round((item.value / max) * 100);
        return (
          <li key={item.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate">{item.name || 'Unknown'}</span>
              <span className="font-medium">
                {item.value.toLocaleString()} <span className="text-xs text-muted-foreground">{unit}</span>
              </span>
            </div>
            <Progress value={percent} className="h-2" />
          </li>
        );
      })}
    </ul>
  );
}
