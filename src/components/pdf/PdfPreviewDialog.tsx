import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MinimizableDialog } from '@/components/ui/minimizable-dialog';
import { toast } from 'sonner';

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blob: Blob | null;
  fileName: string;
  title?: string;
}

/**
 * Reusable PDF preview dialog — renders the generated PDF in an iframe
 * before download. Minimizable like other app dialogs.
 */
export function PdfPreviewDialog({
  open,
  onOpenChange,
  blob,
  fileName,
  title = 'PDF Preview',
}: PdfPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const download = () => {
    if (!blob || !url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success('PDF exported');
  };

  return (
    <MinimizableDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      icon={FileText}
      className="max-w-4xl h-[85vh] flex flex-col"
    >
      <div className="flex-1 min-h-0">
        {url ? (
          <iframe
            src={url}
            title={title}
            className="w-full h-full rounded-md border bg-white"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Generating preview...
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button onClick={download} disabled={!blob}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>
    </MinimizableDialog>
  );
}
