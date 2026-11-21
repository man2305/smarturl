import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Catches render errors (including failed lazy chunk loads after a deploy)
 * that would otherwise unmount the whole app into a white screen, and
 * offers a reload instead.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] uncaught render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            This page failed to load. It can happen right after a new deploy — reloading
            usually fixes it.
          </p>
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
