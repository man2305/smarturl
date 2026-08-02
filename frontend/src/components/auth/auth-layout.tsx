import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm rounded-xl border bg-card p-8">
        {children}
      </div>
    </div>
  );
}
