import { Logo } from '@/components/logo';

export function LandingFooter() {
  return (
    <footer className="border-t">
      <div className="relative container flex items-center justify-center py-8">
        <div className="absolute left-0">
          <Logo />
        </div>
        <p className="text-center text-sm text-muted-foreground">Made by: Manish Rai</p>
        <div className="absolute right-0">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} SmartURL</p>
        </div>
      </div>
    </footer>
  );
}
