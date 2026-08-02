import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteUrl } from '@/hooks/use-urls';
import type { ShortUrl } from '@/types';

export function DeleteUrlDialog({
  url,
  open,
  onOpenChange,
}: {
  url: ShortUrl | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteUrl = useDeleteUrl();
  const isPending = deleteUrl.isPending;

  const confirm = async () => {
    if (!url) return;
    try {
      await deleteUrl.mutateAsync(url.id);
      onOpenChange(false);
    } catch {
      /* toast handled by mutation */
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this link?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="break-all font-mono-code text-foreground">{url?.shortCode}</span> and its
            analytics history will be permanently removed. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
