import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export const useBarcodeScanner = (onScan: (barcode: string) => void, enabled: boolean = true) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Listen for keyboard input from USB barcode scanners
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();
    let debounceTimeout: NodeJS.Timeout | null = null;

    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // Reset buffer if more than 50ms between keys (human typing speed)
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = '';
      }
      
      lastKeyTime = currentTime;

      // Enter key signals end of barcode - immediate processing
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault();
        if (debounceTimeout) clearTimeout(debounceTimeout);
        onScan(barcodeBuffer);
        barcodeBuffer = '';
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        
        // Instant processing for barcode scanners (no debounce needed)
        if (debounceTimeout) clearTimeout(debounceTimeout);
        if (barcodeBuffer.length >= 3) { // Minimum 3 chars
          debounceTimeout = setTimeout(() => {
            onScan(barcodeBuffer);
            barcodeBuffer = '';
          }, 1); // 1ms for near-instant processing
        }
      }
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, [onScan, enabled]);

  const startCameraScanning = async (videoElement: HTMLVideoElement) => {
    if (!videoElement) return;

    try {
      setIsScanning(true);
      setError(null);
      videoRef.current = videoElement;
      processingRef.current = false;

      // Optimize camera settings for faster scanning
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640, max: 1280 }, // Lower resolution = faster
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 20 } // Lower FPS = less processing
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = stream;

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      let lastProcessTime = 0;
      const processInterval = 50; // Process every 50ms for faster scanning

      await codeReader.decodeFromVideoDevice(undefined, videoElement, (result, error) => {
        // Throttle processing to reduce CPU load
        const now = Date.now();
        if (processingRef.current || now - lastProcessTime < processInterval) {
          return;
        }

        if (result) {
          processingRef.current = true; // Prevent multiple scans
          lastProcessTime = now;
          onScan(result.getText());
        }
        
        if (error && !(error.name === 'NotFoundException')) {
          console.error('Barcode scanning error:', error);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start camera');
      setIsScanning(false);
    }
  };

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
