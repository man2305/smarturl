import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart3 } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card py-6 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <Logo to="/dashboard" collapsed={collapsed} className={cn('mb-8', collapsed ? 'px-0' : 'px-2')} />
        <nav className={cn('flex flex-1 flex-col gap-1', collapsed && 'items-center')}>
          {navItems.map((item) => {
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                    collapsed ? 'justify-center px-0 w-10' : 'gap-3 px-3',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {!collapsed && item.label}
              </NavLink>
            );
            return collapsed ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </nav>
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-4' : 'justify-between px-2')}>
          {!collapsed && <span className="text-xs text-muted-foreground">SmartURL v1.0</span>}
          <ThemeToggle />
        </div>
      </aside>
    </TooltipProvider>
  );
}
