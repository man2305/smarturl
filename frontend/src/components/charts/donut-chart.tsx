import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { EmptyState } from '@/components/empty-state';
import { PieChart as PieIcon } from 'lucide-react';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import type { DimensionItem } from '@/types';

const COLORS = [
  'hsl(var(--primary))',
  '#22c55e',
  '#f59e0b',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
];

export function DonutChart({
  data,
  title,
  total,
}: {
  data: DimensionItem[];
  title: string;
  total?: number;
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={PieIcon}
        title={`No ${title.toLowerCase()} data`}
        description="Wait for clicks to see this breakdown."
        className="h-56 py-8"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={80}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {total !== undefined && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{total.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {data.map((item, i) => (
          <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="truncate">{item.name || 'Unknown'}</span>
            </span>
            <span className="font-medium">{item.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
