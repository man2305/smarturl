import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateUrl } from '@/hooks/use-urls';

const schema = z.object({
  originalUrl: z
    .string()
    .min(1, 'A URL is required')
    .url('Enter a valid URL')
    .refine((v) => /^https?:\/\//i.test(v), 'URL must start with http:// or https://'),
  customAlias: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[a-zA-Z0-9_-]{3,32}$/.test(v), 'Alias: 3-32 chars, letters/numbers/-/_'),
  expiresAt: z.string().refine((v) => !v || new Date(v).getTime() > Date.now(), 'Expiry must be a future date'),
  maxClicks: z
    .string()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1_000_000), 'Enter a whole number 1–1,000,000'),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = { originalUrl: '', customAlias: '', expiresAt: '', maxClicks: '' };

export function CreateUrlDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createUrl = useCreateUrl();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  useEffect(() => {
    if (!open) reset(emptyValues);
  }, [open, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      await createUrl.mutateAsync({
        originalUrl: values.originalUrl,
        customAlias: values.customAlias || undefined,
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
        maxClicks: values.maxClicks ? Number(values.maxClicks) : undefined,
      });
      onOpenChange(false);
    } catch {
      /* toast handled by mutation */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a short link</DialogTitle>
          <DialogDescription>Shorten a URL with optional custom alias and expiry rules.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="originalUrl">Destination URL</Label>
            <Input
              id="originalUrl"
              placeholder="https://example.com/very/long/path"
              {...register('originalUrl')}
            />
            {errors.originalUrl && <p className="text-xs text-destructive">{errors.originalUrl.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customAlias">
              Custom alias <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="customAlias" placeholder="my-campaign" {...register('customAlias')} />
            {errors.customAlias && <p className="text-xs text-destructive">{errors.customAlias.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expiresAt">
                Expires on <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="expiresAt" type="datetime-local" {...register('expiresAt')} />
              {errors.expiresAt && <p className="text-xs text-destructive">{errors.expiresAt.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxClicks">
                Max clicks <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="maxClicks" type="number" min={1} placeholder="1000" {...register('maxClicks')} />
              {errors.maxClicks && <p className="text-xs text-destructive">{errors.maxClicks.message}</p>}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
