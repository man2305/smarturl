import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface QrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  shortUrl: string;
}

export function QrDialog({ open, onOpenChange, value, shortUrl }: QrDialogProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const download = () => {
    const canvas = wrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${shortUrl.replace(/[^\w-]/g, '-')}-qrcode.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription className="break-all">Scan to open {shortUrl}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border bg-white p-4" ref={wrapperRef}>
            <QRCodeCanvas value={value} size={196} marginSize={1} />
          </div>
          <Button onClick={download} className="w-full">
            <Download className="mr-2 h-4 w-4" /> Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
