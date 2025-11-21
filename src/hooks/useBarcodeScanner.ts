import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export const useBarcodeScanner = (onScan: (barcode: string) => void, enabled: boolean = true) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Listen for keyboard input from USB barcode scanners
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();
    let debounceTimeout: NodeJS.Timeout | null = null;

    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // Reset buffer if more than 20ms between keys (faster detection)
      if (currentTime - lastKeyTime > 20) {
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
        
        // Auto-process if no Enter key after 5ms (instant for scanners without Enter)
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          if (barcodeBuffer.length >= 3) { // Minimum 3 chars to avoid false triggers
            onScan(barcodeBuffer);
            barcodeBuffer = '';
          }
        }, 5);
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

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      await codeReader.decodeFromVideoDevice(undefined, videoElement, (result, error) => {
        if (result) {
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
