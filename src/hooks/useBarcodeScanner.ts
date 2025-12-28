import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export const useBarcodeScanner = (onScan: (barcode: string) => void, enabled: boolean = true) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const processingRef = useRef(false);
  const onScanRef = useRef(onScan);
  
  // Keep callback ref updated to avoid stale closures
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    // Ultra-fast USB barcode scanner handling
    let barcodeBuffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // Reset buffer if more than 30ms between keys (USB scanners are very fast)
      if (currentTime - lastKeyTime > 30) {
        barcodeBuffer = '';
      }
      
      lastKeyTime = currentTime;

      // Enter key signals end of barcode - INSTANT processing
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const scannedBarcode = barcodeBuffer;
        barcodeBuffer = '';
        // Fire immediately - no delays
        onScanRef.current(scannedBarcode);
        return;
      }
      
      // Only add printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer += e.key;
      }
    };

    // Use keydown instead of keypress for faster response
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled]);

  const startCameraScanning = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!videoElement) return;

    try {
      setIsScanning(true);
      setError(null);
      videoRef.current = videoElement;
      processingRef.current = false;

      // Ultra-fast camera settings
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60, min: 30 } // Higher FPS = faster detection
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = stream;

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      await codeReader.decodeFromVideoDevice(undefined, videoElement, (result) => {
        // INSTANT processing - no debounce, no delays
        if (result && !processingRef.current) {
          processingRef.current = true;
          onScanRef.current(result.getText());
          // Allow next scan after just 100ms (prevents double-scans)
          setTimeout(() => {
            processingRef.current = false;
          }, 100);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start camera');
      setIsScanning(false);
    }
  }, []);

  const stopCameraScanning = () => {
    processingRef.current = false;
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (codeReaderRef.current) {
      codeReaderRef.current = null;
    }
    setIsScanning(false);
  };

  return {
    isScanning,
    error,
    startCameraScanning,
    stopCameraScanning,
  };
};
