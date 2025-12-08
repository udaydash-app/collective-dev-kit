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
    let lastKeyTime = 0;
    let scanTimeout: NodeJS.Timeout | null = null;

    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // Reset buffer if more than 50ms between keys (balanced for speed and reliability)
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = '';
      }
      
      lastKeyTime = currentTime;

      // Clear any existing timeout
      if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
      }

      // Enter key signals end of barcode - immediate processing
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const scannedBarcode = barcodeBuffer;
        barcodeBuffer = '';
        // Process immediately without any delay
        onScan(scannedBarcode);
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        
        // Auto-submit after 100ms of no input (for scanners that don't send Enter)
        scanTimeout = setTimeout(() => {
          if (barcodeBuffer.length >= 4) {
            const scannedBarcode = barcodeBuffer;
            barcodeBuffer = '';
            onScan(scannedBarcode);
          }
        }, 100);
      }
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, [onScan, enabled]);

  const startCameraScanning = async (videoElement: HTMLVideoElement) => {
    if (!videoElement) return;

    try {
      setIsScanning(true);
      setError(null);
      videoRef.current = videoElement;
      processingRef.current = false;

      // Optimize camera settings for maximum scanning speed
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 480, max: 640 }, // Lower resolution = faster processing
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 30, max: 30 } // Higher FPS for faster detection
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = stream;

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      await codeReader.decodeFromVideoDevice(undefined, videoElement, (result, error) => {
        // Immediate processing for maximum speed
        if (result && !processingRef.current) {
          processingRef.current = true;
          // Process immediately without any delay
          onScan(result.getText());
          // Reset after minimal delay to allow next scan
          setTimeout(() => {
            processingRef.current = false;
          }, 50);
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
