import { useSearchParams, Link } from 'react-router-dom';
import { Clock, ShieldBan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';

export default function LinkUnavailablePage() {
  const [params] = useSearchParams();
  const reason = params.get('reason');

  const isExpired = reason === 'expired';
  const Icon = isExpired ? Clock : ShieldBan;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Logo className="mb-10 justify-center" />
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/50">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">This link is {isExpired ? 'no longer active' : 'unavailable'}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isExpired
            ? 'This link has expired or reached its click limit. Ask the owner for a new one.'
            : 'The owner has disabled this link. It may have been paused or removed.'}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link to="/">Go to SmartURL</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
