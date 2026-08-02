import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 7; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function Hero() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<{ short: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const valid = useMemo(() => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, [url]);

  const shorten = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setResult({ short: `${window.location.origin}/${generateCode()}` });
    setCopied(false);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.short);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <section className="pt-32 pb-24 md:pt-40 md:pb-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            A shorter link, in seconds
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Paste a long URL below and get a clean link you can share anywhere. Create a free
            account to keep it, add an alias, and track every click.
          </p>

          <form onSubmit={shorten} className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/a/very/long/url"
              className="h-12 flex-1"
            />
            <Button type="submit" size="lg" disabled={!valid} className="sm:w-auto">
              Shorten
            </Button>
          </form>

          {result && (
            <div className="mx-auto mt-5 flex max-w-xl items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <span className="truncate font-mono-code text-sm text-primary">{result.short}</span>
              <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Want to keep it?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create a free account
            </Link>{' '}
            or{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
