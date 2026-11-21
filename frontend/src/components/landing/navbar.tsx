import { Link } from 'react-router-dom';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/context/auth-context';

export function LandingNavbar() {
  const { status } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b bg-background">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {status === 'authenticated' ? (
            <Button asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
