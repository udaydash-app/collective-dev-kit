import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
}

export const BarcodeScanner = ({ onScan }: BarcodeScannerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isScanning, error, startCameraScanning, stopCameraScanning } = useBarcodeScanner(
    (barcode) => {
      onScan(barcode);
      handleClose();
    },
    isOpen
  );

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => {
      if (videoRef.current) {
        startCameraScanning(videoRef.current);
      }
    }, 100);
  };

  const handleClose = () => {
    stopCameraScanning();
    setIsOpen(false);
  };

  return (
    <>
      <Button onClick={handleOpen} variant="outline" size="sm">
        <Camera className="h-4 w-4 mr-2" />
        Scan Barcode
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Scan Product Barcode</DialogTitle>
            <DialogDescription>Position the barcode within the camera view to scan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
              />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <p className="text-muted-foreground">Initializing camera...</p>
                </div>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Position the barcode within the camera view. The system will automatically detect and scan it.
            </p>
            <Button onClick={handleClose} variant="outline" className="w-full">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
