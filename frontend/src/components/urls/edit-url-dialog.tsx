import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateUrl } from '@/hooks/use-urls';
import type { ShortUrl } from '@/types';

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
  // The future-date rule lives in onSubmit, not here: the pre-filled value
  // may already be past (the link expired after it was created), and that
  // must not block saving an unrelated change.
  expiresAt: z
    .string()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), 'Enter a valid date'),
  maxClicks: z
    .string()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1_000_000), 'Enter a whole number 1–1,000,000'),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** Convert an ISO timestamp to the value expected by <input type="datetime-local">. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditUrlDialog({
  url,
  open,
  onOpenChange,
}: {
  url: ShortUrl | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateUrl = useUpdateUrl();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      originalUrl: '',
      customAlias: '',
      expiresAt: '',
      maxClicks: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (url && open) {
      reset({
        originalUrl: url.originalUrl,
        customAlias: url.shortCode,
        expiresAt: toLocalInputValue(url.expiresAt),
        maxClicks: url.maxClicks ? String(url.maxClicks) : '',
        isActive: url.isActive,
      });
    }
  }, [url, open, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!url) return;
    // Only a *changed* expiry must be in the future: an already-expired
    // link keeps its original (past) value until the user edits it.
    if (
      values.expiresAt &&
      values.expiresAt !== toLocalInputValue(url.expiresAt) &&
      new Date(values.expiresAt).getTime() <= Date.now()
    ) {
      setError('expiresAt', { type: 'validate', message: 'Expiry must be a future date' });
      return;
    }
    try {
      await updateUrl.mutateAsync({
        id: url.id,
        input: {
          originalUrl: values.originalUrl,
          customAlias: values.customAlias || undefined,
          expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
          maxClicks: values.maxClicks ? Number(values.maxClicks) : null,
          isActive: values.isActive,
        },
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
          <DialogTitle>Edit short link</DialogTitle>
          <DialogDescription>Update the destination, alias or expiry settings.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-url">Destination URL</Label>
            <Input id="edit-url" placeholder="https://example.com" {...register('originalUrl')} />
            {errors.originalUrl && <p className="text-xs text-destructive">{errors.originalUrl.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-alias">Short code</Label>
            <Input id="edit-alias" placeholder="my-campaign" {...register('customAlias')} />
            {errors.customAlias && <p className="text-xs text-destructive">{errors.customAlias.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-expires">Expires on</Label>
              <Input id="edit-expires" type="datetime-local" {...register('expiresAt')} />
              {errors.expiresAt && <p className="text-xs text-destructive">{errors.expiresAt.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-max">Max clicks</Label>
              <Input id="edit-max" type="number" min={1} placeholder="1000" {...register('maxClicks')} />
              {errors.maxClicks && <p className="text-xs text-destructive">{errors.maxClicks.message}</p>}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Link active</p>
              <p className="text-xs text-muted-foreground">Disabled links show a friendly unavailable page.</p>
            </div>
            <Switch checked={watch('isActive')} onCheckedChange={(v) => setValue('isActive', v)} />
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
