import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  to = '/',
  collapsed = false,
}: {
  className?: string;
  to?: string;
  collapsed?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn('flex items-center gap-2.5', collapsed && 'justify-center', className)}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Link2 className="h-4 w-4" strokeWidth={2.5} />
      </span>
      {!collapsed && <span className="text-lg font-semibold tracking-tight">SmartURL</span>}
    </Link>
  );
}
